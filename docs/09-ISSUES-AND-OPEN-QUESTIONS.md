# Issues and Open Questions

Findings from reading the whole codebase. First written at commit `73c9b7b`; updated for `225654c` on `main`, which added the HR-policy feature. No source code was changed while writing this. The one non-documentation edit is the `.gitignore` line described below. Items are grouped by kind and ordered roughly by impact within each group.

Each item says how it was established: **Verified** means confirmed by running something or by reading SDK source; **By reading** means it follows from the code but was not executed.

Contents: [Read this first](#read-this-first) · [Bugs](#bugs) · [Missing error handling](#missing-error-handling) · [Risky patterns](#risky-patterns) · [Inconsistencies](#inconsistencies) · [Stale documentation](#stale-documentation) · [Dead code](#dead-code) · [Gaps](#gaps) · [Open questions](#open-questions)

---

## Read this first

### `docs/` was git-ignored (resolved in the working tree)

**Verified** with `git check-ignore`.

At commit `73c9b7b` the root `.gitignore` began with the pattern `*docs`, which matched `docs/` and also `.claude/skills/update-docs/` (its name ends in "docs"). On 2026-10-10 that one line was removed at the repository owner's request so the documentation and the skill can be committed. The change is in the working tree and is not committed yet.

---

## Bugs

### B1. Hallucination fast-path regexes for currency and percentages almost never match

**Verified** by running the patterns in Node.

[server/src/guardrails/hallucination.guardrail.ts:8](../server/src/guardrails/hallucination.guardrail.ts#L8) is `/\b[₹$]\s?[\d,]+(\.\d+)?\b/` and [line 11](../server/src/guardrails/hallucination.guardrail.ts#L11) is `/\b\d{1,3}(\.\d+)?%\b/`.

`\b` matches only between a word character and a non-word character. `₹`, `$`, and `%` are non-word characters. So `\b` before `₹` requires a letter or digit immediately before the symbol, and `\b` after `%` requires one immediately after it.

| Text | Currency pattern | Percent pattern |
| --- | --- | --- |
| `The salary is ₹810,425.` | no match | |
| `CTC: $5000` | no match | |
| `x₹500` | match | |
| `attendance is 95.5%.` | | no match |
| `95% of days` | | no match |

**Effect:** the "specific claim but no tool called" fast path fires only for employee and department IDs. Answers with invented amounts or percentages fall through to the classifier, which is slower and probabilistic. Not a hole, since the classifier still runs, but the fast path does not do what its comment says.

### B2. A pruned pending approval is reported to the requester as "approved"

**By reading.**

Approvals are capped at 200 rows regardless of status ([server/src/approvals/approvalStore.ts:66-71](../server/src/approvals/approvalStore.ts#L66-L71)). If a pending row is pruned, the requester's poll finds it missing from the list. The client treats "not in the pending list" as resolved, looks up its status, gets `undefined`, and falls into the `else` branch: "Your request was approved" ([client/src/hooks/use-chat.ts:111-120](../client/src/hooks/use-chat.ts#L111-L120)). No reply ever arrives.

Needs 200 newer approvals to trigger, so it is unlikely at this scale.

### B3. Empty `ManagerID` becomes `""`, not `null`

**By reading**; 10 of 100 employees have an empty `ManagerID` (**verified** by counting).

[server/src/services/employee.service.ts:13](../server/src/services/employee.service.ts#L13) is `managerId: row.ManagerID ?? null`. `csv-parser` yields an empty string for an empty field, and `??` only replaces `null` and `undefined`. The `Employee` type promises `string | null`.

### B4. `/metrics` groups by full URL, so per-session polling floods the top paths

**By reading.**

`httpLogger` stores `req.originalUrl`, including path parameters and query strings ([server/src/middleware/httpLogger.ts:22](../server/src/middleware/httpLogger.ts#L22)). `computeMetrics` groups by that value ([server/src/logging/metricsService.ts:36-40](../server/src/logging/metricsService.ts#L36-L40)). `/chat/<uuid>/approvals` is polled every 4 seconds per waiting chat, and `/approvals?status=pending` every 15. With only 1000 rows retained, polling also evicts the interesting requests quickly.

### B5. Post-login redirect target is saved but never used

**By reading.**

`ProtectedRoute` passes `state={{ from: location }}` when redirecting to `/login` ([client/src/components/protected-route.tsx:18](../client/src/components/protected-route.tsx#L18)). `LoginPage` always navigates to `/chat` ([client/src/pages/login-page.tsx:37](../client/src/pages/login-page.tsx#L37)). A deep link such as `/chat/<id>` or `/approvals` is lost when the user has to sign in.

### B6. A failed turn leaves an unanswered user message in history

**By reading.**

The user message is saved before the run ([server/src/controllers/chat.controller.ts:123](../server/src/controllers/chat.controller.ts#L123)). On a 502 or 500 nothing is saved after it. On the next turn the model receives two user messages in a row, and the transcript shows a question with no answer after a reload.

### B7. A policy search that fails on the database has already paid for an embedding

**By reading.**

`searchPolicies` embeds the query before it asks for the connection pool ([server/src/services/knowledgeRetrieval.service.ts:63-67](../server/src/services/knowledgeRetrieval.service.ts#L63-L67)). With `DATABASE_URL` unset, `getVectorPool()` throws only after the OpenAI call has completed, on every policy question. Small cost per call; it adds up if the database is misconfigured for a while.

---

## Missing error handling

### E1. A resumed run that throws leaves the requester with nothing

**By reading**; SDK behaviour **verified** in `@openai/agents-core` 0.13.5.

[server/src/controllers/approvals.controller.ts:48](../server/src/controllers/approvals.controller.ts#L48) awaits `resumeEmployeeAgent` with no try/catch. The runner has already flipped the approval to `approved` or `rejected` before running ([server/src/orchestrator/runner.ts:181-188](../server/src/orchestrator/runner.ts#L181-L188)). Output guardrails apply to the resumed run, so a tripwire, an OpenAI error, or a state that fails to deserialize all throw.

Result: Express's default handler answers the approver with a generic 500; no assistant message is written; the requester's chat toasts "approved" and shows no answer; the approval cannot be retried because it is no longer pending.

Compare with `chatController`, which catches the same errors and turns tripwires into declines ([server/src/controllers/chat.controller.ts:174-187](../server/src/controllers/chat.controller.ts#L174-L187)). [Exercise 3](08-SELF-CHECK.md#exercise-3--handle-a-failed-resume) is about fixing this.

### E2. No error-handling or 404 middleware

[server/src/app.ts](../server/src/app.ts) registers neither. Unhandled errors and unknown routes get Express's default responses, which are HTML or plain text rather than the API's `{ success, message }` JSON. In non-production mode the default error page includes a stack trace.

### E3. `login` has no try/catch

[server/src/controllers/auth.controller.ts:13](../server/src/controllers/auth.controller.ts#L13). If `users.csv` is missing or unreadable, the rejection goes to the default handler (E2).

### E4. `httpLogger` writes to SQLite inside a `finish` listener with no guard

[server/src/middleware/httpLogger.ts:17-31](../server/src/middleware/httpLogger.ts#L17-L31). A failing insert throws from an event listener, outside any request's error path. That is an uncaught exception.

### E5. Domain controllers report every failure as "Unable to read CSV"

For example [server/src/controllers/salaries.controller.ts:8-10](../server/src/controllers/salaries.controller.ts#L8-L10). The caught error is discarded and never logged, so a real cause cannot be diagnosed from logs.

### E6. No graceful shutdown

[server/src/server.ts](../server/src/server.ts) has no signal handlers. The HTTP server, the SQLite handle, and the Postgres pool are never closed, and the trace processor's `shutdown` and `forceFlush` are empty ([server/src/tracing/structuredLoggingProcessor.ts:104-106](../server/src/tracing/structuredLoggingProcessor.ts#L104-L106)).

### E7. No React error boundary

A render error anywhere in the client blanks the whole page. See [client-app-shell.md](04-modules/client-app-shell.md#why-it-is-built-this-way-and-trade-offs).

### E8. Malformed SSE data throws a raw `SyntaxError`

[client/src/lib/api.ts:176](../client/src/lib/api.ts#L176) calls `JSON.parse` on each event without a guard. The user would see the parser's message as the chat error.

### E9. Policy search fails quietly and is never checked at startup

**By reading.**

Every failure in the policy path is caught by `safeToolExecute` and becomes a generic "something went wrong" string for the model ([server/src/tools/policy.tool.ts:22](../server/src/tools/policy.tool.ts#L22), [server/src/utils/safeToolExecute.ts:13-18](../server/src/utils/safeToolExecute.ts#L13-L18)). The cause is printed with `console.error` and nowhere else. That covers:

- `DATABASE_URL` missing ([server/src/db/vectorDb.ts:16-21](../server/src/db/vectorDb.ts#L16-L21));
- Postgres unreachable, after a 5-second wait per question ([server/src/db/vectorDb.ts:25](../server/src/db/vectorDb.ts#L25));
- ingestion never run, so `knowledge.chunks` does not exist. The server never creates it ([server/src/db/knowledgeSchema.ts:9-11](../server/src/db/knowledgeSchema.ts#L9-L11));
- the pgvector extension not installed.

Nothing verifies any of this when the server starts, and there is no health endpoint. A fresh checkout that skips ingestion looks healthy until someone asks a policy question, and then it looks like a flaky assistant.

A related case returns no error at all: if `EMBEDDING_MODEL` is changed without re-running ingestion, the `embedding_model` filter matches zero rows and every search reports "no relevant passages" ([server/src/services/knowledgeRetrieval.service.ts:65-70](../server/src/services/knowledgeRetrieval.service.ts#L65-L70)). That is the designed behaviour, and safer than comparing incompatible vectors, but it is indistinguishable from "the policies do not cover this".

---

## Risky patterns

### R1. Tool outputs are stored in traces and exported to OpenAI

**By reading**; the SDK default `traceIncludeSensitiveData: true` **verified** in `agents-core/dist/run.js`.

- Function spans keep tool `input` and `output` ([server/src/tracing/structuredLoggingProcessor.ts:29-32](../server/src/tracing/structuredLoggingProcessor.ts#L29-L32)), so salary rows land in `spans.extra` and in stdout.
- `GET /traces/:traceId` returns them to any manager or admin for **any** session ([server/src/routes/traces.route.ts:76](../server/src/routes/traces.route.ts#L76)), while transcripts are owner-only.
- The SDK's default processor also sends traces to OpenAI's dashboard, and nothing here turns off sensitive data or tracing.

### R2. Self-approval

Nothing compares the approver with the requester ([server/src/controllers/approvals.controller.ts:37-40](../server/src/controllers/approvals.controller.ts#L37-L40)). A manager can raise a request and approve it themselves. `client/TESTING.md` documents this as known. The decision also records no approver id, so there is no audit trail.

### R3. Role rules are duplicated

REST routes ([server/src/middleware/authorize.ts](../server/src/middleware/authorize.ts)) and tools ([server/src/tools/roleAccess.ts](../server/src/tools/roleAccess.ts), plus inline checks in [performance.tool.ts](../server/src/tools/performance.tool.ts)) each implement the rules. They agree today. A future change has to be made in both.

### R4. A missing run context means "unrestricted" in tool role checks

[server/src/tools/salary.tool.ts:44-47](../server/src/tools/salary.tool.ts#L44-L47), [server/src/tools/roleAccess.ts:28-30](../server/src/tools/roleAccess.ts#L28-L30). The check is `role === "employee"`, so an absent user passes. The HTTP path always supplies a user, so this is only reachable from scripts. A new entry point that forgot to pass `context` would silently drop the per-record restrictions (the approval pause would still apply).

### R5. Guardrail identity by string comparison

[server/src/controllers/chat.controller.ts:42](../server/src/controllers/chat.controller.ts#L42) picks the decline message by comparing `guardrail.name` with a literal that must match [server/src/guardrails/hallucination.guardrail.ts:79](../server/src/guardrails/hallucination.guardrail.ts#L79).

### R6. Token and session lifetime

- JWT in `localStorage`: readable by any XSS. The trade-off is argued in [client/src/lib/auth-storage.ts:1-22](../client/src/lib/auth-storage.ts#L1-L22).
- No revocation and no server-side logout. Role changes in `users.csv` do not affect tokens already issued.

### R7. In-memory, single-instance assumptions

Rate-limit counters ([server/src/middleware/rateLimiters.ts](../server/src/middleware/rateLimiters.ts)) and the CSV cache live in process memory, and SQLite is opened by one process. Also, `trust proxy` is not configured, so behind a reverse proxy every client would share one IP for `loginLimiter`.

### R8. Prune on every insert

Each HTTP request runs an insert plus a `DELETE ... NOT IN (SELECT ...)` ([server/src/logging/requestLogStore.ts:61-71](../server/src/logging/requestLogStore.ts#L61-L71)). Each trace start runs two deletes ([server/src/tracing/traceStore.ts:150-152](../server/src/tracing/traceStore.ts#L150-L152)). All synchronous on the event loop. Fine at this size.

### R9. `GET /traces` is an N+1 query

`list` loads every span of every listed trace to compute summaries ([server/src/tracing/traceStore.ts:177-187](../server/src/tracing/traceStore.ts#L177-L187)).

### R10. Serialized runs are tied to SDK version and agent names

Upgrading `@openai/agents` or renaming an agent may make existing `pending` approvals impossible to resume ([server/src/orchestrator/runner.ts:196-199](../server/src/orchestrator/runner.ts#L196-L199)). Combined with E1, the failure would be silent for the requester.

### R11. Deleting a session leaves related rows and frees the id

[server/src/conversation/session.store.ts:130-133](../server/src/conversation/session.store.ts#L130-L133). Resolved approvals and traces for the session remain. The id becomes unowned, so anyone who knows it can claim it; its old traces would then share a `session_id` with the new owner's.

### R12. Unvalidated `message` on a decision

[server/src/controllers/approvals.controller.ts:22](../server/src/controllers/approvals.controller.ts#L22) checks `approve` but passes `message` through as-is to `state.reject` ([server/src/orchestrator/runner.ts:214-217](../server/src/orchestrator/runner.ts#L214-L217)). A non-string value is not rejected. The text is shown to the model, so an approver can inject instructions through it; approvers are trusted users, so the exposure is small.

### R13. No limit on chat message length

Only Express's default 100 kB JSON body limit applies ([server/src/app.ts:30](../server/src/app.ts#L30)). A very long message is sent to the model several times per turn.

### R14. Policy knowledge goes stale silently

Ingestion is manual. Editing, adding, or deleting a file in `data/policies/` changes nothing until someone runs `npm run ingest:policies`, and nothing compares the database with the files or records when ingestion last ran. The assistant will quote superseded rules with a policy name and version attached.

### R15. The Policy Agent must search before it can do anything else

[server/src/agents/domains/policy.agent.ts:61-66](../server/src/agents/domains/policy.agent.ts#L61-L66) forces the first model turn to call `search_hr_policies`. That fixed skipped searches, but it also means a request routed to the Policy Agent by mistake, or the out-of-scope half of a mixed request, costs an embedding call and a database query before the agent is able to hand back. The forced call's query is whatever the model invents for a question that is not about policy.

### R16. The list of policies is written out in five prompts

Leave, work from home, expenses, and code of conduct are named in the tool description ([server/src/tools/policy.tool.ts:9-13](../server/src/tools/policy.tool.ts#L9-L13)), the Policy Agent's instructions, the Orchestrator's instructions ([server/src/agents/orchestrator.agent.ts:44-46](../server/src/agents/orchestrator.agent.ts#L44-L46)), the input classifier's prompt ([server/src/guardrails/inputSafety.guardrail.ts:60-64](../server/src/guardrails/inputSafety.guardrail.ts#L60-L64)), and the decline message ([server/src/controllers/chat.controller.ts:22-23](../server/src/controllers/chat.controller.ts#L22-L23)). Ingestion picks up any `.md` file automatically, but a fifth policy on a new topic would be ingested and then routed away or declined as out of scope until those prompts are edited.

---

## Inconsistencies

| # | What | Where |
| --- | --- | --- |
| I1 | `client/TESTING.md` says `users.csv` is "read on every login, so no restart is needed". The CSV cache makes that false. | [server/src/services/csv.service.ts:17-19](../server/src/services/csv.service.ts#L17-L19) |
| I2 | Swagger text for `/approvals` and `/traces` says "in-memory ... does not survive a server restart". Both are SQLite-backed. | [approvals.route.ts:15-17](../server/src/routes/approvals.route.ts#L15-L17), [traces.route.ts:13-14](../server/src/routes/traces.route.ts#L13-L14) |
| I3 | The input classifier prompt says "You will be shown a single user message", but it is passed the full recent history. | [inputSafety.guardrail.ts:66](../server/src/guardrails/inputSafety.guardrail.ts#L66) vs. [line 113](../server/src/guardrails/inputSafety.guardrail.ts#L113) |
| I4 | Two styles of tool role check: shared helpers vs. inline. | [roleAccess.ts](../server/src/tools/roleAccess.ts) vs. [performance.tool.ts:23-25](../server/src/tools/performance.tool.ts#L23-L25) |
| I5 | `employeeId` vs. `employeeID`, `departmentId` vs. `departmentID` across models. | [types/employee.ts:2](../server/src/types/employee.ts#L2) vs. [types/salary.ts:2](../server/src/types/salary.ts#L2) |
| I6 | `*CsvRow` interfaces declare `number` fields that are strings at runtime. | e.g. [types/salary.ts:10-17](../server/src/types/salary.ts#L10-L17) |
| I7 | Route file names mix `.route.ts` and `.routes.ts`; service exports mix singular and plural. | `server/src/routes/`, `server/src/services/` |
| I8 | pino for HTTP lines and policy-search events, `console.*` for everything else. `LOG_LEVEL` affects only the former. | [structuredLoggingProcessor.ts:58](../server/src/tracing/structuredLoggingProcessor.ts#L58), [safeToolExecute.ts:14](../server/src/utils/safeToolExecute.ts#L14) |
| I9 | `runEmployeeAgentStream` does not stream; it returns a complete string. | [runner.ts:103](../server/src/orchestrator/runner.ts#L103) |
| I10 | The folder `server/src/orchestrator/` holds the runner; the Orchestrator agent is in `server/src/agents/`. | |
| I11 | Text mode retries an empty answer once; JSON mode does not. | [runner.ts:113-127](../server/src/orchestrator/runner.ts#L113-L127) vs. [146-152](../server/src/orchestrator/runner.ts#L146-L152) |
| I12 | REST returns `attendancePercentage: null` with 200 for an unknown employee; the tool returns an error. | [attendance.controller.ts:34-41](../server/src/controllers/attendance.controller.ts#L34-L41) vs. [attendance.tool.ts:78-82](../server/src/tools/attendance.tool.ts#L78-L82) |
| I13 | In JSON mode, assistant turns are stored as stringified JSON and replayed to the model that way; declines are stored as plain text. | [chat.controller.ts:147-151](../server/src/controllers/chat.controller.ts#L147-L151), [157](../server/src/controllers/chat.controller.ts#L157) |
| I14 | The hallucination guardrail checks only `summary` in structured output, on the stated assumption that `employees` and `metrics` come from tools. They are written by the model. | [hallucination.guardrail.ts:37-42](../server/src/guardrails/hallucination.guardrail.ts#L37-L42) |
| I15 | `admin` and `manager` are separate roles with identical permissions everywhere. | every `requireRole(["manager", "admin"])` |
| I16 | Three agents know the caller's identity; the Employee, Department, and Project agents do not, so "my projects" needs an ID. | [project.agent.ts:27-32](../server/src/agents/domains/project.agent.ts#L27-L32) |
| I17 | A code comment describes "an employee whose request is paused". Employees can no longer raise approvals. | [chat.controller.ts:281-283](../server/src/controllers/chat.controller.ts#L281-L283) |
| I18 | `server/package.json` has `"main": "app.ts"`; the entry is `src/server.ts`. | [server/package.json:4](../server/package.json#L4) |
| I19 | Two schema styles side by side: SQLite tables are created as an import side effect; the Postgres table is created only by a script. Each is explained in comments, but a newcomer has to learn both. | [database.ts:19-84](../server/src/db/database.ts#L19-L84) vs. [knowledgeSchema.ts:9-11](../server/src/db/knowledgeSchema.ts#L9-L11) |
| I20 | `search_hr_policies` reports "nothing found" as `{ results: [], note }`; every other tool reports it as `{ error }`. | [policy.tool.ts:24-29](../server/src/tools/policy.tool.ts#L24-L29) vs. [employee.tool.ts:30-34](../server/src/tools/employee.tool.ts#L30-L34) |
| I21 | The relaxed groundedness prompt ("a straightforward deduction" is fine) was written for policy answers but applies to every agent's output. | [hallucination.guardrail.ts:63-71](../server/src/guardrails/hallucination.guardrail.ts#L63-L71) |

---

## Stale documentation

The earlier version of this section listed claims in `client/README.md` and the chat UI about a policy agent, Postgres, `npm run ingest:policies`, and `DATABASE_URL` that did not match the code on the `React-Application` branch. All of those are accurate on `main` and have been removed from this list. What remains:

| Claim | Where | Reality |
| --- | --- | --- |
| "A 404 for `/chat/<id>/messages` ... on a new chat" is expected | `client/README.md` troubleshooting table | A new chat does not fetch history at all ([use-chat.ts:68-69](../client/src/hooks/use-chat.ts#L68-L69)). |
| The architecture diagram's SQLite node lists "sessions, messages, approvals, traces" | `client/README.md` | `request_logs` is stored there too. |

See also I1 and I2 above.

---

## Dead code

| Item | Where | Note |
| --- | --- | --- |
| `CsvService.clearCache` | [csv.service.ts:38-45](../server/src/services/csv.service.ts#L38-L45) | Never called. |
| `isValidDateString` | [validators.ts:34-47](../server/src/guardrails/validators.ts#L34-L47) | Comment says it is kept for a future tool. |
| `import type { AgentInputItem }` | [conversation/types.ts:1](../server/src/conversation/types.ts#L1) | Unused import. |
| `departmentId` parameter | [salary.service.ts:41-44](../server/src/services/salary.service.ts#L41-L44) | Accepted, never read. |
| `messages.user_id` column | [database.ts:31](../server/src/db/database.ts#L31) | Written, never queried. |
| `Separator`, `Tooltip` UI components | [client/src/components/ui/](../client/src/components/ui/) | Generated, not imported. |
| `.vscode/launch.json` | [.vscode/launch.json:14](../.vscode/launch.json#L14) | Launches `runner.ts`, which is not an entry point, using a Windows-style path. |
| Redundant name-match clauses | [employee.service.ts:34-36](../server/src/services/employee.service.ts#L34-L36) | The full-name `includes` already covers first and last name. |
| Stale header comment | [inputSafety.guardrail.ts:2-3](../server/src/guardrails/inputSafety.guardrail.ts#L2-L3) | Refers to two files deleted from the repo. |
| `get_salaries` tool | [salary.tool.ts:14-27](../server/src/tools/salary.tool.ts#L14-L27) | Reachable by the model, but no instruction mentions it. Not dead, just undocumented to the agent. |
| `topK` and `maxDistance` parameters | [knowledgeRetrieval.service.ts:54-58](../server/src/services/knowledgeRetrieval.service.ts#L54-L58) | The only caller passes neither, so the clamp to `MAX_TOP_K` never does anything. |
| `effective_date`, `owner`, `approx_tokens` in chunk metadata | [chunker.ts:196](../server/src/knowledge/chunker.ts#L196) | Stored in Postgres, never read back. |
| Oversized-section splitting | [chunker.ts:82-145](../server/src/knowledge/chunker.ts#L82-L145) | No section in the four current documents exceeds 500 tokens (largest chunk is about 238), so `splitOversized`, `splitWithOverlap`, and `hardSplit` never take their splitting branches. Kept for future documents. |

---

## Gaps

- **No automated tests** on either side. `server/scripts/` are manual scenarios without assertions, each costing API calls. None of them covers the Policy Agent. The chunker is a pure function and the easiest thing in the repo to unit test; it has no tests either.
- **No `server/.env.example`.** The three required variables are only listed in `client/README.md` and in these docs.
- **No setup for Postgres.** Nothing creates the database or checks for pgvector beyond `CREATE EXTENSION IF NOT EXISTS`, which needs the extension to be installed on the server already.
- **No CI, no Dockerfile, no deployment configuration.**
- **No `build`, `start`, `lint`, or `typecheck` script for the server.** `tsx` does not type-check, so server type errors are only visible in the editor.
- **No database migrations**, for SQLite or Postgres. Schema changes do not apply to an existing `data/app.db` ([database.md](04-modules/database.md#schema-creation-is-an-import-side-effect)).
- **No root `README.md`.** The only readme is `client/README.md`. (The brief allowed adding a link to `docs/00-OVERVIEW.md` in a root readme "if one exists"; none does, so none was added.)
- **No user management.** Accounts are edited by hand in a CSV.

---

## Open questions

Things the code alone cannot answer.

1. **Does policy search work on this machine?** The chunker was run with `--dry-run` (49 chunks). The embedding, Postgres, and Policy Agent paths were read but not executed, so whether the database exists, has pgvector, and has been ingested is unknown.
2. **What was `*docs` in `.gitignore` originally meant to ignore?** The line has been removed; if it was protecting some other folder, that folder is now visible to git.
3. **Which model runs in practice?** No agent sets one. The installed SDK defaults to `gpt-5.4-mini` unless `OPENAI_DEFAULT_MODEL` is set; the comment at [runner.ts:34](../server/src/orchestrator/runner.ts#L34) agrees. Whether the environment overrides it is not visible from the repo.
4. **Is `admin` meant to differ from `manager`?** Today it does not.
5. **Are department budgets meant to be visible to every employee?** They are, through both the tool and `GET /departments`. `client/TESTING.md` says the directory and projects are open "by design" and does not mention budgets.
6. **Is exporting traces with tool outputs to OpenAI intended?** It is the SDK default and nothing opts out.
7. **Who consumes JSON mode?** The React client never sends `format: "json"`.
8. **Does `run()` honour an `outputGuardrails` option?** [test-sensitive-info-guardrail.ts:15-17](../server/scripts/test-sensitive-info-guardrail.ts#L15-L17) passes one behind `as any`. Not checked against the SDK.
9. **What should happen to a pending approval that is never decided?** There is no expiry; it is eventually pruned (see B2).
10. **What are the passwords for `admin` and the four employee accounts?** `client/TESTING.md` lists them as unknown. Only the manager accounts are usable without editing a hash, so the employee-role chat path could not be exercised.
11. **Was the hour-long token with no refresh a deliberate limit, or a placeholder?**
12. **How is this meant to be deployed, if at all?** Several choices (in-memory limits, single SQLite file, `tsx` runtime) only suit one local process.
13. **How were the retrieval thresholds measured?** Comments cite "10 sample questions" for the merge threshold and distance ranges for the cutoff ([chunker.ts:10-13](../server/src/knowledge/chunker.ts#L10-L13), [knowledgeRetrieval.service.ts:19-25](../server/src/services/knowledgeRetrieval.service.ts#L19-L25)). The questions and the script that produced the numbers are not in the repo, so they cannot be re-checked after a change.
14. **Should policy answers depend on who is asking?** Many rules differ by employment type and designation. The Policy Agent is not told the caller's identity and is instructed to answer for every category instead. Whether it should look the caller up is a product decision.
15. **Who owns re-ingestion?** Nothing triggers it when a policy file changes.
