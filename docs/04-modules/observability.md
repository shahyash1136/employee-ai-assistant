# Observability

## Purpose and responsibility

Record what the system did so a manager or admin can inspect it afterwards. Three kinds of record:

| Kind | Answers | Stored in | Read through |
| --- | --- | --- | --- |
| Request logs | Which HTTP calls happened, by whom, how long, what status? | `request_logs` + stdout | `GET /logs` |
| Metrics | Totals, error rate, slowest and busiest paths | Computed from `request_logs` | `GET /metrics` |
| Traces | Inside one agent run: which agents, tools, handoffs, guardrails, model calls? | `traces`, `spans` + stdout | `GET /traces`, `GET /traces/:traceId` |

All four endpoints require manager or admin.

## Where it sits

It hooks in at two points: an Express middleware in front of everything, and a trace processor inside the Agents SDK. See [Architecture 2.1](../03-ARCHITECTURE-AND-LIFECYCLE.md#21-server).

## Key files

| File | Role |
| --- | --- |
| [middleware/httpLogger.ts](../../server/src/middleware/httpLogger.ts) | Middleware that logs each finished response. |
| [logging/logger.ts](../../server/src/logging/logger.ts) | The pino instance. |
| [logging/requestLogStore.ts](../../server/src/logging/requestLogStore.ts) | Insert, prune to 1000, list. |
| [logging/metricsService.ts](../../server/src/logging/metricsService.ts) | `computeMetrics()`. |
| [tracing/registerTracing.ts](../../server/src/tracing/registerTracing.ts) | Adds the processor once. |
| [tracing/structuredLoggingProcessor.ts](../../server/src/tracing/structuredLoggingProcessor.ts) | Receives trace and span events. |
| [tracing/traceStore.ts](../../server/src/tracing/traceStore.ts) | Insert traces and spans, prune to 200 traces, read back. |
| [controllers/logs.controller.ts](../../server/src/controllers/logs.controller.ts), [metrics.controller.ts](../../server/src/controllers/metrics.controller.ts), [traces.controller.ts](../../server/src/controllers/traces.controller.ts) | Thin handlers. |
| [routes/logs.route.ts](../../server/src/routes/logs.route.ts), [metrics.route.ts](../../server/src/routes/metrics.route.ts), [traces.route.ts](../../server/src/routes/traces.route.ts) | Routes with `requireRole`. |

## Request logging, step by step

### How a middleware before auth can know the user

`httpLogger` is mounted before `authenticate` ([app.ts:33](../../server/src/app.ts#L33)), so when it runs, `req.user` is not set. It does not log then. It records a start time, registers a listener for the response's `finish` event, and calls `next()` ([httpLogger.ts:14-33](../../server/src/middleware/httpLogger.ts#L14-L33)).

`finish` fires after the response has been fully sent, which is after every later middleware and handler ran. By then `authenticate` has set `req.user` on the same request object, so `req.user?.userId` is available ([httpLogger.ts:25](../../server/src/middleware/httpLogger.ts#L25)). For a failed login or a 401 it is `null`.

### What is recorded

`method`, `path` (from `req.originalUrl`, so it includes the query string), `status`, `durationMs` from the nanosecond `process.hrtime.bigint()` clock rounded to two decimals, `userId`, and an ISO timestamp ([httpLogger.ts:20-27](../../server/src/middleware/httpLogger.ts#L20-L27)). The entry goes to pino and to SQLite ([httpLogger.ts:29-30](../../server/src/middleware/httpLogger.ts#L29-L30)).

For a chat turn, the duration covers the whole agent run plus the SSE replay.

### Store

`create` inserts and immediately deletes everything except the newest 1000 rows ([requestLogStore.ts:61-71](../../server/src/logging/requestLogStore.ts#L61-L71)). `list` picks one of two prepared statements depending on whether a `userId` filter was given ([requestLogStore.ts:73-84](../../server/src/logging/requestLogStore.ts#L73-L84)).

## Metrics

`computeMetrics` runs five aggregate queries each time it is called ([metricsService.ts:15-58](../../server/src/logging/metricsService.ts#L15-L58)): total count, count with `status >= 400`, average duration, count grouped by status, and the top 20 paths by request count with their average duration.

Things to keep in mind when reading the numbers:

- They cover only the last 1000 requests, because that is all the table holds.
- `errorRate` counts 401, 403, and 429 as errors along with 5xx.
- Guardrail declines are HTTP 200 and so do not count as errors.
- Paths are grouped by the full URL. `/chat/<uuid>/approvals` is a different path for every session, and the client polls it every 4 seconds, so the "top paths" list tends to fill with individual session URLs.

## Tracing, step by step

### What a trace is here

The SDK emits a **trace** per `withTrace` block and a **span** for each step inside it: an agent taking a turn, a model call ("generation"), a tool call ("function"), a handoff, a guardrail check. The runner opens one trace per chat turn and sets `groupId` to the session id ([runner.ts:109-133](../../server/src/orchestrator/runner.ts#L109-L133)).

### Registering

`addTraceProcessor` appends to the SDK's processor list ([registerTracing.ts:9-13](../../server/src/tracing/registerTracing.ts#L9-L13)). The default processor that exports to OpenAI's dashboard keeps running. The `registered` flag makes the function safe to call twice.

Because registration happens in `server.ts`, code that imports the agents without going through `server.ts` (the scripts in `server/scripts/`) gets no local traces unless it calls `registerTracing()` itself, as [test-hallucination-guardrail.ts:13](../../server/scripts/test-hallucination-guardrail.ts#L13) does.

### The processor

`StructuredLoggingProcessor` implements the SDK's `TracingProcessor` interface ([structuredLoggingProcessor.ts:53-107](../../server/src/tracing/structuredLoggingProcessor.ts#L53-L107)):

| Callback | What it does |
| --- | --- |
| `onTraceStart` | Remembers `traceId → groupId` in a `Map`, inserts the trace row, prints a JSON line. |
| `onSpanEnd` | Builds a `SpanRecord`, inserts it, prints a JSON line that includes the session id looked up from the map. |
| `onTraceEnd` | Sets `ended_at`, prints a line, removes the map entry. |
| `onSpanStart`, `shutdown`, `forceFlush` | Empty. Spans are only recorded when they end. |

The in-memory map exists because a span knows its `traceId` but not the trace's `groupId` ([structuredLoggingProcessor.ts:14-16](../../server/src/tracing/structuredLoggingProcessor.ts#L14-L16)).

`summarizeSpanData` picks a few fields per span type ([structuredLoggingProcessor.ts:18-48](../../server/src/tracing/structuredLoggingProcessor.ts#L18-L48)):

| Span type | Kept |
| --- | --- |
| `agent` | name, handoffs, tools, output type |
| `function` | tool name, **input, output** |
| `generation` | model, token usage |
| `guardrail` | name, triggered |
| `handoff` | from agent, to agent |
| anything else | nothing extra |

Function spans keep the tool's input and output. That means salary figures and other HR data returned by tools are written to `spans.extra` and to stdout.

### The store

Fixed columns hold what every span has (`span_id`, `trace_id`, `span_type`, start, end, `error`). Everything type-specific goes into one JSON text column, `extra` ([traceStore.ts:159-170](../../server/src/tracing/traceStore.ts#L159-L170)). On read, `rowToSpan` parses `extra` and spreads it back into the object, so callers see a flat record and never know about the split ([traceStore.ts:116-130](../../server/src/tracing/traceStore.ts#L116-L130)). This avoids a table per span type and tolerates new fields without a schema change.

`startTrace` inserts with `ON CONFLICT DO NOTHING`, prunes traces beyond the newest 200, then deletes orphaned spans ([traceStore.ts:144-153](../../server/src/tracing/traceStore.ts#L144-L153)).

`list` loads each trace **with all its spans** in order to compute the summary: duration, span count, whether any span has an error, and the names of guardrails that triggered ([traceStore.ts:33-52](../../server/src/tracing/traceStore.ts#L33-L52), [traceStore.ts:177-187](../../server/src/tracing/traceStore.ts#L177-L187)). Listing 50 traces runs 51 queries.

### Reading a trace

`GET /traces?sessionId=<id>` lists a conversation's runs; `GET /traces/<traceId>` returns every span in order. For a normal turn you will see roughly: guardrail span (Input Safety) → agent span (Orchestrator) → generation → handoff → agent span (specialist) → generation → function → generation → two guardrail spans. A paused-and-resumed turn appears as two traces, the second named "... (resumed)".

## Two logging styles

HTTP requests go through pino, and so do two policy-search events: `policy_search` after each search ([knowledgeRetrieval.service.ts:79-87](../../server/src/services/knowledgeRetrieval.service.ts#L79-L87)) and `vector_db_idle_client_error` from the Postgres pool ([vectorDb.ts:32-37](../../server/src/db/vectorDb.ts#L32-L37)). Everything else uses `console.*`: trace events ([structuredLoggingProcessor.ts:58](../../server/src/tracing/structuredLoggingProcessor.ts#L58)), guardrail trips ([chat.controller.ts:27](../../server/src/controllers/chat.controller.ts#L27)), tool failures ([safeToolExecute.ts:14](../../server/src/utils/safeToolExecute.ts#L14)), and the startup banner. `LOG_LEVEL` therefore only affects the pino lines.

## Inputs, outputs, side effects, dependencies

- **Inputs:** every HTTP request; every SDK trace event.
- **Outputs:** JSON lines on stdout; rows in three tables; four read endpoints.
- **Side effects:** two SQLite statements per HTTP request (insert + prune); three per trace start; one per span.
- **Depends on:** [Database](database.md), [Auth and Access Control](auth-and-access-control.md) for `requireRole`.

## Why it is built this way, and trade-offs

- **Local, queryable traces** make it possible to debug "why did the assistant say that?" from the API without leaving the app, and to correlate by session.
- **Capped tables** keep the database small with no background job. History is short.
- **Prune on every insert** is simple, and wasteful: most runs delete nothing.
- **Access is role-based only.** Any manager can read any session's traces, including tool outputs, even though transcripts themselves are owner-only. See [09](../09-ISSUES-AND-OPEN-QUESTIONS.md#risky-patterns).
- The Swagger descriptions for `/traces` still say "in-memory" ([traces.route.ts:13-14](../../server/src/routes/traces.route.ts#L13-L14)). The store is SQLite.

## Source files covered

- `server/src/middleware/httpLogger.ts`
- `server/src/logging/logger.ts`
- `server/src/logging/requestLogStore.ts`
- `server/src/logging/metricsService.ts`
- `server/src/tracing/registerTracing.ts`
- `server/src/tracing/structuredLoggingProcessor.ts`
- `server/src/tracing/traceStore.ts`
- `server/src/controllers/logs.controller.ts`
- `server/src/controllers/metrics.controller.ts`
- `server/src/controllers/traces.controller.ts`
- `server/src/routes/logs.route.ts`
- `server/src/routes/metrics.route.ts`
- `server/src/routes/traces.route.ts`
