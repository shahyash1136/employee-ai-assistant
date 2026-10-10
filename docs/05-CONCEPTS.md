# Concepts

Libraries, patterns, and ideas used in this codebase, each with a short explanation and the exact place it is used.

> **Assumed reader level.** The documentation request left "MY LEVEL" unfilled, so this file assumes: comfortable with TypeScript and React, newer to backend work and to LLM agent tooling. Agent and backend concepts get the most space; React-side entries are limited to the less common ones. If that assumption is wrong, this is the file to adjust.

Contents: [LLM and agent basics](#1-llm-and-agent-basics) · [OpenAI Agents SDK](#2-openai-agents-sdk) · [Backend and HTTP](#3-backend-and-http) · [Persistence](#4-persistence) · [TypeScript and Node](#5-typescript-and-node) · [Design patterns](#6-design-patterns-used-here) · [Frontend](#7-frontend)

---

## 1. LLM and agent basics

### Agent

An LLM plus instructions plus a set of things it may do. The "agent loop" is: send the conversation to the model; if the model asks to call a tool, run it and send the result back; repeat until the model produces a final answer. The SDK runs this loop for you.

Used: every `new Agent({...})`, for example [server/src/agents/orchestrator.agent.ts:75-88](../server/src/agents/orchestrator.agent.ts#L75-L88).

### Instructions (system prompt)

Text given to the model before the conversation that defines its role and rules. In this SDK it is the `instructions` field. It may be a string or a function that builds the string per run.

Used: static in [server/src/agents/domains/employee.agent.ts:5-30](../server/src/agents/domains/employee.agent.ts#L5-L30); dynamic in [server/src/agents/domains/salary.agent.ts:42-50](../server/src/agents/domains/salary.agent.ts#L42-L50).

### Tool calling (function calling)

The model cannot run code or read files. Instead you describe functions to it (name, description, parameter schema). When it wants one, it outputs a structured request; your code executes the function and returns the result as text. The model decides *when* and *with what arguments*; your code decides *what actually happens*.

Used: all of [server/src/tools/](../server/src/tools/). Deep dive: [04-modules/tools.md](04-modules/tools.md).

### Multi-agent orchestration and handoffs

Instead of one agent with every tool, split the work: a router agent decides which specialist should handle a request and transfers control. A **handoff** is that transfer. The specialist continues the same conversation with its own instructions and tools.

Used: [server/src/agents/orchestrator.agent.ts:79-87](../server/src/agents/orchestrator.agent.ts#L79-L87) and the back-wiring at [lines 135-140](../server/src/agents/orchestrator.agent.ts#L135-L140). Deep dive: [04-modules/agents.md](04-modules/agents.md).

### Structured output

Asking the model to answer with JSON matching a schema instead of free text, so code can consume it. With OpenAI's strict mode every field must be present, so "unknown" is expressed as `null` rather than by omitting the field.

Used: `outputType: StructuredResponseSchema` in [server/src/agents/shared/createDomainAgent.ts:52-58](../server/src/agents/shared/createDomainAgent.ts#L52-L58); the schema in [server/src/types/structuredResponse.ts](../server/src/types/structuredResponse.ts); classifier outputs such as [server/src/guardrails/inputSafety.guardrail.ts:51-55](../server/src/guardrails/inputSafety.guardrail.ts#L51-L55).

### Hallucination and grounding

A model can state things that sound right and are not. **Grounding** means tying each claim to a source, here tool results. An answer with a salary figure that no tool returned is ungrounded.

Used: [server/src/guardrails/hallucination.guardrail.ts](../server/src/guardrails/hallucination.guardrail.ts), and the repeated instruction "Never make up data; always call a tool before answering."

### Prompt injection

User text that tries to override the system's instructions ("ignore previous instructions and..."). Because instructions and user input are both just text to the model, this cannot be fully prevented by prompting alone. Defences here are layered: detect it on input, and make sure the things that matter (roles, approvals) are enforced in code the model cannot talk its way past.

Used: [server/src/guardrails/inputSafety.guardrail.ts:14-25](../server/src/guardrails/inputSafety.guardrail.ts#L14-L25); role enforcement in [server/src/tools/roleAccess.ts:45-54](../server/src/tools/roleAccess.ts#L45-L54).

### LLM-as-classifier

Using a second, small LLM call whose only job is to answer yes/no questions about a piece of text, with a structured output. Cheaper to build than a trained classifier and handles paraphrase; it is also probabilistic and adds latency.

Used: three classifier agents, one per tripwire guardrail, for example [server/src/guardrails/sensitiveInfo.guardrail.ts:56-73](../server/src/guardrails/sensitiveInfo.guardrail.ts#L56-L73).

### Context window and history truncation

A model can only read a limited amount of text per call, and cost grows with it. Chat apps therefore send only part of the history.

Used: `RECENT_HISTORY_LIMIT = 20` in [server/src/conversation/conversation.service.ts:5](../server/src/conversation/conversation.service.ts#L5).

### Reasoning effort

A model setting that controls how much internal reasoning it does before answering. Lower is faster and cheaper.

Used: `reasoning: { effort: "low" }` in [server/src/orchestrator/runner.ts:40-43](../server/src/orchestrator/runner.ts#L40-L43), with a comment explaining the bug it fixed.

### Human-in-the-loop (HITL)

Pausing an automated process so a person can approve or reject a specific action before it happens.

Used: `needsApproval` on salary tools; the whole of [04-modules/approvals.md](04-modules/approvals.md).

### Retrieval-augmented generation (RAG)

Instead of hoping the model knows something, you look it up first and put the text in front of the model. Three steps: **retrieve** passages relevant to the question, **augment** the prompt with them, **generate** an answer restricted to them. Here the retrieval step is exposed to the agent as a tool, so the model decides what to search for.

Used: [server/src/tools/policy.tool.ts:22-39](../server/src/tools/policy.tool.ts#L22-L39) and the "answer only from the passages" rules in [server/src/agents/domains/policy.agent.ts:23-42](../server/src/agents/domains/policy.agent.ts#L23-L42). Module: [policy-knowledge.md](04-modules/policy-knowledge.md).

### Embeddings and vector similarity

An **embedding** is a list of numbers (here 1536 of them) produced by a model so that texts with similar meaning get lists that point in similar directions. Search becomes geometry: embed the question, then find the stored texts whose vectors are closest. This finds "sick leave entitlement" for a question about "days off when ill", which keyword search would miss.

**Cosine distance** measures the angle between two vectors: 0 for the same direction, 1 for unrelated, 2 for opposite. Smaller is closer. Vectors from different embedding models live in different spaces and cannot be compared.

Used: [server/src/knowledge/embedder.ts:9-31](../server/src/knowledge/embedder.ts#L9-L31), [server/src/services/knowledgeRetrieval.service.ts:67-74](../server/src/services/knowledgeRetrieval.service.ts#L67-L74).

### Chunking

Cutting documents into pieces before embedding them. One vector for a whole document is too vague to match a specific question; one per sentence loses context. The right size depends on the documents. This project uses one markdown section per chunk and merges very small ones.

Used: [server/src/knowledge/chunker.ts](../server/src/knowledge/chunker.ts), reasoning at [lines 3-7](../server/src/knowledge/chunker.ts#L3-L7).

### Tool choice

A model-API setting that controls whether the model may, must, or must not call a tool on a turn, and optionally names the tool. `auto` is the default. Naming a tool forces that call.

Used: [server/src/agents/domains/policy.agent.ts:66](../server/src/agents/domains/policy.agent.ts#L66), to make the Policy Agent search before it says anything.

---

## 2. OpenAI Agents SDK

Package `@openai/agents` (version 0.13.5 installed). The pieces this project uses:

| SDK concept | What it is | Where |
| --- | --- | --- |
| `Agent` | Name, instructions, tools, handoffs, optional `outputType` and guardrails. | [orchestrator.agent.ts:75](../server/src/agents/orchestrator.agent.ts#L75) |
| `tool({...})` | Defines a function tool from a zod schema and an `execute` function. | [salary.tool.ts:29-64](../server/src/tools/salary.tool.ts#L29-L64) |
| `Runner` / `run()` | Executes the agent loop. A `Runner` instance carries shared config; `run()` uses a default runner. | [runner.ts:40-43](../server/src/orchestrator/runner.ts#L40-L43), [inputSafety.guardrail.ts:113](../server/src/guardrails/inputSafety.guardrail.ts#L113) |
| `user()`, `assistant()` | Helpers that build input message items. | [runner.ts:25-31](../server/src/orchestrator/runner.ts#L25-L31) |
| Run **context** | Any object you pass as `{ context }`. Delivered to tools, `needsApproval`, and dynamic instructions as `runContext.context`. **Never sent to the model.** | [runner.ts:114-116](../server/src/orchestrator/runner.ts#L114-L116) |
| `RunContext<T>` | The wrapper type around your context object. Hence `context?.context?.role`. | [roleAccess.ts:28-30](../server/src/tools/roleAccess.ts#L28-L30) |
| `result.finalOutput` | The last agent's answer: a string, or a parsed object when `outputType` is set. | [runner.ts:120](../server/src/orchestrator/runner.ts#L120) |
| `result.lastAgent` | Which agent produced the answer. | [test-orchestrator.ts:14](../server/scripts/test-orchestrator.ts#L14) |
| **Input guardrail** | Runs on the input of the first agent. Returns `tripwireTriggered`. | [inputSafety.guardrail.ts:90-122](../server/src/guardrails/inputSafety.guardrail.ts#L90-L122) |
| **Output guardrail** | Runs on the final output. Receives `details.output`, the run's generated items. | [hallucination.guardrail.ts:78-111](../server/src/guardrails/hallucination.guardrail.ts#L78-L111) |
| **Tool input guardrail** | Runs on one tool call's arguments. Returns `allow()` or `rejectContent(msg)`. | [toolMisuse.guardrail.ts:14-43](../server/src/guardrails/toolMisuse.guardrail.ts#L14-L43) |
| **Tripwire** | A guardrail verdict that aborts the run by throwing `InputGuardrailTripwireTriggered` or `OutputGuardrailTripwireTriggered`. | Caught in [chat.controller.ts:25-48](../server/src/controllers/chat.controller.ts#L25-L48) |
| `needsApproval` | On a tool: boolean or async function. If true, the run stops before executing and reports an **interruption**. | [salary.tool.ts:85](../server/src/tools/salary.tool.ts#L85) |
| `result.interruptions` | Pending approval items on a paused run. | [runner.ts:117](../server/src/orchestrator/runner.ts#L117) |
| `RunState` | The complete, serializable state of a run. `state.toString()` to save, `RunState.fromString(agent, str)` to restore, `state.approve(item)` / `state.reject(item)` to decide. | [runner.ts:84](../server/src/orchestrator/runner.ts#L84), [runner.ts:196-219](../server/src/orchestrator/runner.ts#L196-L219) |
| **Trace / span** | A trace is one logical operation; spans are its timed steps (agent, generation, function, handoff, guardrail). | [structuredLoggingProcessor.ts:18-48](../server/src/tracing/structuredLoggingProcessor.ts#L18-L48) |
| `withTrace(name, fn, { groupId })` | Runs `fn` inside a named trace. `groupId` links related traces, here by session. | [runner.ts:109-133](../server/src/orchestrator/runner.ts#L109-L133) |
| `TracingProcessor` / `addTraceProcessor` | An interface for receiving trace events, and the call that registers one. | [registerTracing.ts:11](../server/src/tracing/registerTracing.ts#L11) |
| `promptWithHandoffInstructions` | Prepends the SDK's recommended text about handoffs to your prompt. | [orchestrator.agent.ts:30](../server/src/agents/orchestrator.agent.ts#L30) |
| `modelSettings` on an `Agent` | Per-agent model options. `toolChoice` forces a tool call; the SDK resets it to automatic after the tool has run (`resetToolChoice`, on by default) so the agent does not loop. | [policy.agent.ts:66](../server/src/agents/domains/policy.agent.ts#L66), passed through at [createDomainAgent.ts:49-50](../server/src/agents/shared/createDomainAgent.ts#L49-L50) |

---

## 3. Backend and HTTP

### Express middleware

A function `(req, res, next)` that runs for matching requests. It can end the request by sending a response, or pass it on with `next()`. Middleware runs in the order it was registered with `app.use`. That ordering is how this app expresses "public above this line, authenticated below it".

Used: [server/src/app.ts:28-62](../server/src/app.ts#L28-L62). A **middleware factory** is a function that returns middleware configured by its arguments, like `requireRole(["manager", "admin"])` in [server/src/middleware/authorize.ts:4-19](../server/src/middleware/authorize.ts#L4-L19).

### Router → controller → service

A common layering. The **router** maps URLs to handlers and attaches per-route middleware. The **controller** reads the request, calls business code, and shapes the response. The **service** holds logic and data access and knows nothing about HTTP.

Used throughout `server/src/routes`, `controllers`, `services`.

### Express 5 async handlers

In Express 5, if an `async` handler's promise rejects, Express forwards the error to the error-handling middleware automatically. In Express 4 it would hang. This project has no custom error middleware, so the default one answers with a 500.

Relevant: [server/src/controllers/approvals.controller.ts:48](../server/src/controllers/approvals.controller.ts#L48), which has no try/catch.

### JWT (JSON Web Token)

A signed string with three dot-separated parts: header, payload, signature. The payload is readable by anyone (it is only base64-encoded). The signature, made with a server-side secret, proves the payload was not altered. The server needs no session storage: it verifies the signature on each request and trusts the payload.

Used: signing and verifying in [server/src/services/auth.service.ts:47-63](../server/src/services/auth.service.ts#L47-L63); decoding without verifying in [client/src/lib/jwt.ts:11-35](../client/src/lib/jwt.ts#L11-L35).

### Bearer token

The convention of sending a token as `Authorization: Bearer <token>`.

Used: [server/src/middleware/authenticate.ts:5-15](../server/src/middleware/authenticate.ts#L5-L15); [client/src/lib/api.ts:46-49](../client/src/lib/api.ts#L46-L49).

### bcrypt

A deliberately slow, salted password hash. You store the hash; at login you hash the attempt with the same salt (embedded in the stored hash) and compare. `$2b$10$...` means version 2b with cost factor 10.

Used: [server/src/services/auth.service.ts:43](../server/src/services/auth.service.ts#L43); hashes in `data/users.csv`.

### Authentication vs. authorization

Authentication: who are you? Authorization: are you allowed to do this? They are separate steps and separate middleware here.

Used: `authenticate` vs. `requireRole` / `requireOwnRecordOrRole`. Also **RBAC** (role-based access control): permissions attach to roles, and users have a role.

### CORS

Browsers block a page on one origin (`localhost:5173`) from reading responses from another (`localhost:3000`) unless the server opts in with CORS headers. For requests with custom headers or JSON bodies, the browser first sends a **preflight** `OPTIONS` request to ask permission.

Used: [server/src/app.ts:21-28](../server/src/app.ts#L21-L28). The comment explains why it is registered first.

### Rate limiting

Refusing requests beyond a count per time window, per key. The key decides who shares a budget.

Used: [server/src/middleware/rateLimiters.ts](../server/src/middleware/rateLimiters.ts).

### Server-Sent Events (SSE)

A simple streaming format over one long HTTP response with `Content-Type: text/event-stream`. Each event is one or more `data: ...` lines followed by a blank line. The connection stays open until the server ends it.

Used: written in [server/src/controllers/chat.controller.ts:212-224](../server/src/controllers/chat.controller.ts#L212-L224); parsed in [client/src/lib/api.ts:153-181](../client/src/lib/api.ts#L153-L181). Here it is a **replay** of an already-finished answer. `[DONE]` is a convention borrowed from OpenAI's API, not part of SSE.

### OpenAPI / Swagger

OpenAPI is a standard format for describing an HTTP API. Swagger UI renders it as an interactive page. `swagger-jsdoc` builds the description from YAML written in `@openapi` code comments.

Used: [server/src/openapi/swagger.ts](../server/src/openapi/swagger.ts); comments above every `router.<method>` in `server/src/routes/`.

### Structured logging (pino)

Logging JSON objects instead of free text so logs can be filtered and aggregated by field.

Used: [server/src/logging/logger.ts](../server/src/logging/logger.ts), called in [server/src/middleware/httpLogger.ts:29](../server/src/middleware/httpLogger.ts#L29).

### Response `finish` event

Node emits `finish` on the response object when the last byte has been handed to the OS. Listening for it lets code run after the whole request has been handled.

Used: [server/src/middleware/httpLogger.ts:17](../server/src/middleware/httpLogger.ts#L17).

---

## 4. Persistence

### SQLite and `node:sqlite`

SQLite is a database engine that lives in a single file with no server process. `node:sqlite` is the driver built into recent Node versions. Its API (`DatabaseSync`) is synchronous: calls block until done.

Used: [server/src/db/database.ts](../server/src/db/database.ts).

### Prepared statements and bound parameters

`db.prepare(sql)` compiles SQL once. `?` placeholders are filled in by `.run(a, b)`, `.get(a)`, or `.all(a)`. Values are sent separately from the SQL text, which prevents SQL injection and is faster on reuse.

Used: every store, for example [server/src/conversation/session.store.ts:10-53](../server/src/conversation/session.store.ts#L10-L53).

### WAL (write-ahead logging)

A SQLite journal mode where writes go to a separate log file first. Readers are not blocked by a writer.

Used: [server/src/db/database.ts:15-17](../server/src/db/database.ts#L15-L17).

### Upsert with `ON CONFLICT DO NOTHING`

"Insert this row unless one with the same key exists." Used to create a session on its first message and leave it untouched afterwards.

Used: [server/src/conversation/session.store.ts:10-14](../server/src/conversation/session.store.ts#L10-L14).

### Conditional update as a lock

`UPDATE ... WHERE id = ? AND status = 'pending'` changes a row only if it is still pending. Checking how many rows changed tells you whether you won. This is a compare-and-set, an atomic claim without explicit locks.

Used: [server/src/approvals/approvalStore.ts:61-64](../server/src/approvals/approvalStore.ts#L61-L64) and [112-119](../server/src/approvals/approvalStore.ts#L112-L119).

### JSON column

Storing varying fields as a JSON string in one text column instead of many nullable columns.

Used: `spans.extra` in [server/src/tracing/traceStore.ts:159-170](../server/src/tracing/traceStore.ts#L159-L170).

### Capped table

Keeping only the newest N rows by deleting the rest on each insert. A cheap substitute for retention jobs.

Used: [server/src/logging/requestLogStore.ts:35-38](../server/src/logging/requestLogStore.ts#L35-L38).

### In-memory cache

Keeping computed or loaded data in a `Map` for the life of the process.

Used: [server/src/services/csv.service.ts:11](../server/src/services/csv.service.ts#L11).

### PostgreSQL, pgvector, and connection pools

PostgreSQL is a database server: a separate process the app connects to over the network, unlike SQLite's single file. **pgvector** is an extension that adds a `vector(n)` column type and distance operators; `<=>` is cosine distance. With it, "nearest passages" is an ordinary `ORDER BY ... LIMIT` query.

`pg` is the Node driver. A **pool** keeps a few connections open and lends one out per query, because opening a connection is slow. A pool keeps the Node process alive until it is closed, which is why scripts must end it.

Used: [server/src/db/vectorDb.ts:13-40](../server/src/db/vectorDb.ts#L13-L40), [server/src/db/knowledgeSchema.ts:16-34](../server/src/db/knowledgeSchema.ts#L16-L34).

### Transaction

A group of statements that either all take effect or none do. `BEGIN` starts one, `COMMIT` applies it, `ROLLBACK` discards it. Other connections never see the half-finished state.

Used: [server/src/knowledge/ingest.ts:55-89](../server/src/knowledge/ingest.ts#L55-L89), so a failed ingestion leaves the previous policy data intact.

### Lazy initialisation

Creating a resource the first time it is needed instead of when the module loads. It trades a slower first use for not depending on import order and not failing at startup.

Used: [server/src/db/vectorDb.ts:7-14](../server/src/db/vectorDb.ts#L7-L14). Contrast with [server/src/db/database.ts:13](../server/src/db/database.ts#L13), which opens SQLite at import.

---

## 5. TypeScript and Node

### ES modules with `NodeNext`

`"type": "module"` makes `.js`/`.ts` files ES modules. With `moduleResolution: "NodeNext"`, relative imports must include the extension of the **output** file, so TypeScript source says `./app.js` for a file named `app.ts`.

Used: every server import, for example [server/src/server.ts:3](../server/src/server.ts#L3).

### Import-time side effects and evaluation order

A module's top-level code runs the first time it is imported. Imports are evaluated in source order, depth first, before the importing module's own body. This codebase relies on that for loading `.env` first, opening the database, preparing statements, and constructing agents.

Used: [server/src/server.ts:1-4](../server/src/server.ts#L1-L4); [server/src/db/database.ts:13-84](../server/src/db/database.ts#L13-L84).

### `__dirname` in ES modules

ES modules do not have `__dirname`. It is rebuilt from `import.meta.url`.

Used: [server/src/services/csv.service.ts:6-8](../server/src/services/csv.service.ts#L6-L8).

### `tsx` and `nodemon`

`tsx` runs TypeScript files directly by stripping types on the fly (no type checking). `nodemon` restarts a command when files change.

Used: [server/package.json:7](../server/package.json#L7).

### `dotenv`

Reads `KEY=value` lines from `.env` into `process.env`. Importing `dotenv/config` does it as a side effect.

Used: [server/src/server.ts:1](../server/src/server.ts#L1).

### zod

A schema library: you describe a shape once and get both runtime validation and a TypeScript type (`z.infer`). `.describe()` text is passed to the model as field documentation.

Used: tool parameters, for example [server/src/tools/employee.tool.ts:24-26](../server/src/tools/employee.tool.ts#L24-L26); [server/src/types/structuredResponse.ts:32](../server/src/types/structuredResponse.ts#L32).

### Declaration merging (module augmentation)

Adding fields to a type declared by a library. A `.d.ts` file re-opens Express's `Request` interface to add `user`.

Used: [server/src/types/express.d.ts](../server/src/types/express.d.ts).

### Discriminated union

A union of object types that share a literal field (`status`, `kind`). Checking that field narrows the type, and the compiler makes you handle each case.

Used: `RunOutcome` in [server/src/orchestrator/runner.ts:48-58](../server/src/orchestrator/runner.ts#L48-L58); `ChatSendResult` in [client/src/lib/api.ts:99-103](../client/src/lib/api.ts#L99-L103).

### Type guard

A function returning `value is T` that narrows a type when it returns true.

Used: `isNonEmptyString` in [server/src/controllers/chat.controller.ts:18-20](../server/src/controllers/chat.controller.ts#L18-L20); the filter callbacks in [server/src/guardrails/hallucination.guardrail.ts:21-26](../server/src/guardrails/hallucination.guardrail.ts#L21-L26).

### `Extract<Union, Shape>`

A utility type that picks the union members matching a shape.

Used: [server/src/controllers/chat.controller.ts:55](../server/src/controllers/chat.controller.ts#L55).

---

## 6. Design patterns used here

| Pattern | Idea | Where |
| --- | --- | --- |
| Singleton module instance | Export one shared instance of a class. | `export const csvService = new CsvService()` [csv.service.ts:48](../server/src/services/csv.service.ts#L48), and every service and store |
| Factory function | A function that builds configured objects. | `createDomainAgent` [createDomainAgent.ts:41-61](../server/src/agents/shared/createDomainAgent.ts#L41-L61); `createArgumentValidationGuardrail` [toolMisuse.guardrail.ts:14](../server/src/guardrails/toolMisuse.guardrail.ts#L14) |
| Higher-order function (wrapper) | Take a function, return an enhanced one. | `safeToolExecute` [safeToolExecute.ts:6-20](../server/src/utils/safeToolExecute.ts#L6-L20); `denyEmployees` [roleAccess.ts:45-54](../server/src/tools/roleAccess.ts#L45-L54) |
| Fail fast | Crash at startup on bad configuration rather than misbehave later. | `JWT_SECRET` check [auth.service.ts:16-20](../server/src/services/auth.service.ts#L16-L20) |
| Errors as values | Return an error object instead of throwing, so the consumer (the model) can react. | Tool `{ error }` strings, e.g. [employee.tool.ts:30-34](../server/src/tools/employee.tool.ts#L30-L34) |
| Two-tier check | Cheap deterministic test first, expensive model test second. | All tripwire guardrails, e.g. [inputSafety.guardrail.ts:99-120](../server/src/guardrails/inputSafety.guardrail.ts#L99-L120) |
| Defence in depth | The same rule enforced at several layers. | Roles on REST routes, in tools, and (cosmetically) in the UI |
| Facade | A small interface in front of a more detailed one. | `ConversationService` over `SessionStore` [conversation.service.ts](../server/src/conversation/conversation.service.ts) |
| Late wiring to break a cycle | Connect two mutually dependent objects after both exist. | [orchestrator.agent.ts:135-140](../server/src/agents/orchestrator.agent.ts#L135-L140) |
| Callback registration (inversion of control) | A low-level module exposes a hook; a high-level module fills it. | `setUnauthorizedHandler` [api.ts:28-31](../client/src/lib/api.ts#L28-L31) |
| Optimistic UI | Show the expected result immediately, fix up when the server replies. | [use-chat.ts:144-148](../client/src/hooks/use-chat.ts#L144-L148) |
| Polling | Ask repeatedly on a timer instead of being pushed updates. | [use-chat.ts:106-129](../client/src/hooks/use-chat.ts#L106-L129); [use-approvals.ts:42](../client/src/hooks/use-approvals.ts#L42) |

---

## 7. Frontend

Only the less common items.

### Layout routes and `<Outlet />`

A `<Route>` with an `element` but no `path` wraps its child routes. The matched child renders where the parent places `<Outlet />`.

Used: [client/src/App.tsx:19-26](../client/src/App.tsx#L19-L26); [client/src/components/protected-route.tsx:23](../client/src/components/protected-route.tsx#L23).

### Router `state` and `location.key`

`navigate(path, { state })` attaches data to a history entry without putting it in the URL. `location.key` is a unique id per navigation.

Used: the seed in [client/src/pages/chat-page.tsx:129-136](../client/src/pages/chat-page.tsx#L129-L136); the remount key at [line 89](../client/src/pages/chat-page.tsx#L89).

### `key` to reset state

Changing a component's `key` makes React unmount it and mount a new one with fresh state.

Used: [client/src/pages/chat-page.tsx:89](../client/src/pages/chat-page.tsx#L89); [client/src/components/approvals/reject-dialog.tsx:29](../client/src/components/approvals/reject-dialog.tsx#L29).

### `AbortController`

Creates a `signal` you pass to `fetch`. Calling `abort()` cancels the request, which rejects with an `AbortError`. Used in effect cleanups so a stale response never updates state after unmount.

Used: [client/src/hooks/use-chat.ts:70](../client/src/hooks/use-chat.ts#L70) and every data-fetching effect.

### Reload key

A counter in state used only as an effect dependency. Incrementing it reruns the effect.

Used: [client/src/hooks/use-chat-sessions.ts:11-12](../client/src/hooks/use-chat-sessions.ts#L11-L12).

### Lazy state initialiser

`useState(fn)` calls `fn` once on mount to compute the initial value.

Used: [client/src/components/auth-provider.tsx:41](../client/src/components/auth-provider.tsx#L41); [client/src/hooks/use-chat.ts:43](../client/src/hooks/use-chat.ts#L43).

### `useSyncExternalStore`

Subscribes a component to a value that lives outside React, given a subscribe function and a getter.

Used: OS colour scheme in [client/src/components/theme-provider.tsx:39](../client/src/components/theme-provider.tsx#L39).

### Reading a streamed `fetch` body

`response.body` is a `ReadableStream`. `pipeThrough(new TextDecoderStream())` converts bytes to text; `getReader().read()` yields chunks.

Used: [client/src/lib/api.ts:158-164](../client/src/lib/api.ts#L158-L164).

### React Compiler

A build-time transform that memoizes components and values automatically.

Used: [client/vite.config.ts:9-13](../client/vite.config.ts#L9-L13).

### StrictMode double effects

In development, React mounts, unmounts, and remounts components once to surface missing cleanups. Effects therefore run twice.

Used: [client/src/main.tsx:7](../client/src/main.tsx#L7).

### shadcn/ui, Base UI, `cva`, `cn`, Tailwind v4

Covered in [04-modules/client-ui-kit.md](04-modules/client-ui-kit.md).

### `satisfies`

Checks that an expression matches a type without changing the expression's inferred type.

Used: [client/src/pages/chat-page.tsx:133](../client/src/pages/chat-page.tsx#L133).
