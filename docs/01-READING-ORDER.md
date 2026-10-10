# Reading Order

Read the files in this order. Each step says what to look for and what you should be able to explain before moving on. Keep [03-ARCHITECTURE-AND-LIFECYCLE.md](03-ARCHITECTURE-AND-LIFECYCLE.md) open beside the code.

The server comes first because the client only makes sense once you know what the API returns.

## Stage 1 — Server bootstrapping

| # | File | Look for | Understand before moving on |
| --- | --- | --- | --- |
| 1 | [server/package.json](../server/package.json) | The two scripts on lines 7-8, `"type": "module"` on line 5, the dependency list | The server runs TypeScript directly through `tsx`. `dev` starts the API; `ingest:policies` is a separate one-off program. There is no build, start, or test script. |
| 2 | [server/src/server.ts](../server/src/server.ts) | The import order: `dotenv/config` first, then `app`, then `registerTracing()` | Why `dotenv/config` must be the first import: other modules read `process.env` while they are being imported. |
| 3 | [server/src/app.ts](../server/src/app.ts) | The order of `app.use(...)` calls, and the comment at line 49 | Middleware order is the security model. Everything mounted after `authenticate` on line 50 requires a token. |
| 4 | [server/src/db/database.ts](../server/src/db/database.ts) | `new DatabaseSync(...)`, the WAL pragma, six `CREATE TABLE IF NOT EXISTS` statements | The schema is created as a side effect of importing this file. There are no migrations. |

## Stage 2 — Identity and access

| # | File | Look for | Understand before moving on |
| --- | --- | --- | --- |
| 5 | [server/src/types/user.ts](../server/src/types/user.ts) | `UserRole`, `User`, `AuthTokenPayload` | `AuthTokenPayload` is the identity object that travels everywhere: `req.user`, the agent run `context`, and tool role checks. |
| 6 | [server/src/services/auth.service.ts](../server/src/services/auth.service.ts) | The `JWT_SECRET` IIFE on lines 16-20, `validateCredentials`, `issueToken`, `verifyToken` | Users come from `data/users.csv`. A missing secret crashes startup on purpose. |
| 7 | [server/src/middleware/authenticate.ts](../server/src/middleware/authenticate.ts) | How `req.user` gets set on line 23 | The only place a token is verified. |
| 8 | [server/src/middleware/authorize.ts](../server/src/middleware/authorize.ts) | `requireRole` and `requireOwnRecordOrRole` | The two access rules used by REST routes: "role in list" and "your own record, or an elevated role". |
| 9 | [server/src/middleware/rateLimiters.ts](../server/src/middleware/rateLimiters.ts) | The two different `keyGenerator`s | Why login is limited per IP but chat is limited per user. |

## Stage 3 — Plain data layer (no AI yet)

| # | File | Look for | Understand before moving on |
| --- | --- | --- | --- |
| 10 | [server/src/services/csv.service.ts](../server/src/services/csv.service.ts) | The `cache` map and the `mapper` argument | Each CSV is parsed once per process and cached forever. |
| 11 | [server/src/services/salary.service.ts](../server/src/services/salary.service.ts) | One representative domain service | Services are thin: read CSV, filter or reduce. The other five follow the same shape. |
| 12 | [server/src/routes/salaries.routes.ts](../server/src/routes/salaries.routes.ts) and [server/src/controllers/salaries.controller.ts](../server/src/controllers/salaries.controller.ts) | Lines 43, 72, 102, 142, 185 of the routes file | The REST API exposes the same data as the agents, with the same role rules, and needs no model call. |

## Stage 4 — Tools: what the model is allowed to do

| # | File | Look for | Understand before moving on |
| --- | --- | --- | --- |
| 13 | [server/src/utils/safeToolExecute.ts](../server/src/utils/safeToolExecute.ts) | The try/catch that returns a JSON error string | A tool never throws into the agent run. Errors become data the model can read. |
| 14 | [server/src/tools/roleAccess.ts](../server/src/tools/roleAccess.ts) | `denyEmployees`, `needsApprovalUnlessEmployee`, the long comment on lines 32-36 | Role rules are enforced in code inside the tool, not by asking the model nicely. |
| 15 | [server/src/tools/salary.tool.ts](../server/src/tools/salary.tool.ts) | The shape of `tool({ name, description, parameters, needsApproval, inputGuardrails, execute })` | How one tool combines a zod schema, an approval rule, an argument guardrail, and a role check. |
| 16 | [server/src/guardrails/validators.ts](../server/src/guardrails/validators.ts) then [server/src/guardrails/toolMisuse.guardrail.ts](../server/src/guardrails/toolMisuse.guardrail.ts) | `rejectContent` vs `allow` | A tool input guardrail rejects a bad argument and tells the model why, without ending the run. |

## Stage 5 — Agents

| # | File | Look for | Understand before moving on |
| --- | --- | --- | --- |
| 17 | [server/src/types/structuredResponse.ts](../server/src/types/structuredResponse.ts) | The zod schema with `.nullable()` fields | The shape the "structured" agent variants must return. |
| 18 | [server/src/agents/shared/instructionFragments.ts](../server/src/agents/shared/instructionFragments.ts) | Four reusable prompt blocks | Prompts are assembled from shared fragments so all agents resolve names and stay in scope the same way. |
| 19 | [server/src/agents/shared/createDomainAgent.ts](../server/src/agents/shared/createDomainAgent.ts) | It returns two agents, `agent` and `structuredAgent` | Every domain agent exists in a plain-text and a structured variant with identical tools. |
| 20 | [server/src/agents/domains/salary.agent.ts](../server/src/agents/domains/salary.agent.ts) | `buildInstructions` on lines 42-50 | Instructions can be a function of the run context, which is how the model learns who "me" is. |
| 21 | [server/src/agents/orchestrator.agent.ts](../server/src/agents/orchestrator.agent.ts) | `handoffs`, `inputGuardrails`, and the loops on lines 135-140 | The Orchestrator has no tools, only handoffs. Specialists get a handoff back to it, wired here to avoid a circular import. |

## Stage 6 — Guardrails

| # | File | Look for | Understand before moving on |
| --- | --- | --- | --- |
| 22 | [server/src/guardrails/inputSafety.guardrail.ts](../server/src/guardrails/inputSafety.guardrail.ts) | The regex fast path, then the classifier agent, and `tripwireTriggered` | The two-tier pattern: free regex first, model call only if needed. |
| 23 | [server/src/guardrails/sensitiveInfo.guardrail.ts](../server/src/guardrails/sensitiveInfo.guardrail.ts) | `ALL_TOOL_NAMES` derived from the tool arrays | An answer that mentions an internal tool name is blocked. |
| 24 | [server/src/guardrails/hallucination.guardrail.ts](../server/src/guardrails/hallucination.guardrail.ts) | `extractToolResultText(details?.output)` | The final answer is checked against the raw tool results from the same run. |

## Stage 7 — The core flow: one chat turn

This is the heart of the app. Read these three together with [section 4.2 of the architecture doc](03-ARCHITECTURE-AND-LIFECYCLE.md#42-user-sends-a-chat-message).

| # | File | Look for | Understand before moving on |
| --- | --- | --- | --- |
| 25 | [server/src/conversation/session.store.ts](../server/src/conversation/session.store.ts) and [server/src/conversation/conversation.service.ts](../server/src/conversation/conversation.service.ts) | `append`, `getRecent`, `getSessionOwner`, `RECENT_HISTORY_LIMIT` | A session is owned by whoever writes to it first. The model only sees the last 20 messages. |
| 26 | [server/src/orchestrator/runner.ts](../server/src/orchestrator/runner.ts) | The `Runner` config on lines 40-43, `RunOutcome`, `recordApproval`, the retry loop on lines 113-127 | A run ends in exactly one of two states: `completed` or `needs_approval`. Guardrail trips arrive as thrown errors. |
| 27 | [server/src/controllers/chat.controller.ts](../server/src/controllers/chat.controller.ts) | Validation (lines 89-120), the two modes, `describeGuardrailFailure`, the SSE replay loop on lines 212-224 | The answer is fully generated and checked before a single byte is streamed. The "stream" is a replay. |
| 28 | [server/src/routes/chat.route.ts](../server/src/routes/chat.route.ts) | Lines 58, 94, 128, 159, 183 | The five chat endpoints. |

## Stage 8 — Human-in-the-loop approvals

| # | File | Look for | Understand before moving on |
| --- | --- | --- | --- |
| 29 | [server/src/approvals/approvalStore.ts](../server/src/approvals/approvalStore.ts) | `serializedState`, the conditional `UPDATE` on lines 61-64, `summarize` | The whole paused run is stored as a string. `resolve()` is the race guard. |
| 30 | [server/src/orchestrator/runner.ts](../server/src/orchestrator/runner.ts) lines 167-242 | `resumeEmployeeAgent`: claim, `RunState.fromString`, `clearTrace`, approve/reject, run again | Why the approval is claimed before the run is resumed, and why the same root agent variant must be used. |
| 31 | [server/src/controllers/approvals.controller.ts](../server/src/controllers/approvals.controller.ts) | Lines 76-87 | The resumed answer is written into the requester's session, not the approver's. |

## Stage 9 — Observability

| # | File | Look for | Understand before moving on |
| --- | --- | --- | --- |
| 32 | [server/src/middleware/httpLogger.ts](../server/src/middleware/httpLogger.ts) | `res.on("finish", ...)` | Why a middleware mounted before auth can still log `req.user`. |
| 33 | [server/src/tracing/structuredLoggingProcessor.ts](../server/src/tracing/structuredLoggingProcessor.ts) and [server/src/tracing/traceStore.ts](../server/src/tracing/traceStore.ts) | `onSpanEnd`, the `extra` JSON column | Every agent step, tool call, handoff, and guardrail becomes a span row. |
| 34 | [server/src/logging/metricsService.ts](../server/src/logging/metricsService.ts) | Five SQL aggregates | Metrics are computed on demand from `request_logs`. |

## Stage 10 — Policy knowledge (RAG)

The seventh specialist works differently from the other six: it searches documents by meaning instead of filtering CSV rows. Read with [section 4.5 of the architecture doc](03-ARCHITECTURE-AND-LIFECYCLE.md#45-policy-question-retrieval).

| # | File | Look for | Understand before moving on |
| --- | --- | --- | --- |
| 35 | [data/policies/leave-policy.md](../data/policies/leave-policy.md) | The frontmatter block and the numbered `##` sections | The shape the chunker depends on: one topic per short section. |
| 36 | [server/src/knowledge/chunker.ts](../server/src/knowledge/chunker.ts) | The header comment, `MIN_CHUNK_TOKENS`, `packSections`, what goes into `content` | Why a section is the unit of retrieval, and why tiny sections are merged. |
| 37 | [server/src/db/knowledgeSchema.ts](../server/src/db/knowledgeSchema.ts) and [server/src/knowledge/embedder.ts](../server/src/knowledge/embedder.ts) | `vector(1536)`, the `embedding_model` column, the dimension check | An embedding is a fixed-length list of numbers. Vectors from different models cannot be compared. |
| 38 | [server/src/db/vectorDb.ts](../server/src/db/vectorDb.ts) | `getVectorPool` and its comments | Why this pool is created lazily while `database.ts` opens SQLite at import. |
| 39 | [server/src/knowledge/ingest.ts](../server/src/knowledge/ingest.ts) | The order in `main`: embed, then one transaction that deletes and re-inserts | A second entry point. The server never writes this table; only this script does. |
| 40 | [server/src/services/knowledgeRetrieval.service.ts](../server/src/services/knowledgeRetrieval.service.ts), then [server/src/tools/policy.tool.ts](../server/src/tools/policy.tool.ts) and [server/src/agents/domains/policy.agent.ts](../server/src/agents/domains/policy.agent.ts) | The `<=>` query, the comment above `DEFAULT_MAX_DISTANCE`, `toolChoice` on line 66 of the agent | Search always returns the nearest passages, relevant or not. Deciding whether they answer the question is left to the agent's instructions. |

## Stage 11 — Client bootstrapping and auth

| # | File | Look for | Understand before moving on |
| --- | --- | --- | --- |
| 41 | [client/index.html](../client/index.html) and [client/src/main.tsx](../client/src/main.tsx) | The inline theme script on lines 8-22 | The theme class is set before React loads to avoid a flash. |
| 42 | [client/src/App.tsx](../client/src/App.tsx) | Provider nesting and nested `<Route>` elements | The route tree is the access model: `ProtectedRoute` wraps everything except `/login`. |
| 43 | [client/src/lib/api.ts](../client/src/lib/api.ts) | `send`, `setUnauthorizedHandler`, `sendChat`, `readTokenStream` | The only file that calls `fetch`. `sendChat` branches on `Content-Type`. |
| 44 | [client/src/lib/auth-storage.ts](../client/src/lib/auth-storage.ts), [client/src/lib/jwt.ts](../client/src/lib/jwt.ts), [client/src/components/auth-provider.tsx](../client/src/components/auth-provider.tsx) | `restoreSession`, the two `useEffect`s | The session is derived from the stored JWT. There is no separate "current user" copy. |
| 45 | [client/src/components/protected-route.tsx](../client/src/components/protected-route.tsx) | Two redirects | UX-only gate. The server is the real enforcement. |

## Stage 12 — Client chat and approvals

| # | File | Look for | Understand before moving on |
| --- | --- | --- | --- |
| 46 | [client/src/hooks/use-chat.ts](../client/src/hooks/use-chat.ts) | `draftId`, the three effects, `send` | One hook instance equals one conversation. Polling runs only while something is waiting for approval. |
| 47 | [client/src/pages/chat-page.tsx](../client/src/pages/chat-page.tsx) | `key={location.key}` on line 89, the navigate effect on lines 129-136 | Why `ChatView` is remounted per navigation, and how a new chat gets its own URL. |
| 48 | [client/src/hooks/use-approvals.ts](../client/src/hooks/use-approvals.ts) and [client/src/pages/approvals-page.tsx](../client/src/pages/approvals-page.tsx) | The 15-second interval, the `deciding` set | The manager dashboard polls and tracks a per-row busy state. |

## After reading

Work through [08-SELF-CHECK.md](08-SELF-CHECK.md), then read [09-ISSUES-AND-OPEN-QUESTIONS.md](09-ISSUES-AND-OPEN-QUESTIONS.md) with the code open. Several issues there are good first changes.
