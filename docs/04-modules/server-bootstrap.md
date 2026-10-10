# Server Bootstrap

## Purpose and responsibility

Start the process and assemble the Express application: load environment variables, register the trace processor, decide the order of middleware, mount every router, and serve API docs. It contains no business logic.

## Where it sits

The top of the server's API layer. See [Architecture 2.1](../03-ARCHITECTURE-AND-LIFECYCLE.md#21-server) and the startup sequence in [3.1](../03-ARCHITECTURE-AND-LIFECYCLE.md#31-server-startup).

## Key files

| File | What it does |
| --- | --- |
| [server/src/server.ts](../../server/src/server.ts) | Entry point. Twelve lines: import env, import app, register tracing, listen. |
| [server/src/app.ts](../../server/src/app.ts) | Builds and exports the Express app. |
| [server/src/openapi/swagger.ts](../../server/src/openapi/swagger.ts) | OpenAPI definition, shared schemas, and the route-file scan. |
| [server/src/config/openai.ts](../../server/src/config/openai.ts) | Exports a plain `OpenAI` client, built at import time from `OPENAI_API_KEY`. Its only user is [knowledge/embedder.ts](../../server/src/knowledge/embedder.ts), for policy embeddings. The agents do not use it: the Agents SDK creates its own client. |
| [server/package.json](../../server/package.json), [server/tsconfig.json](../../server/tsconfig.json) | Scripts and compiler settings. Two scripts: `dev` starts this module; `ingest:policies` starts a different entry point, described in [policy-knowledge.md](policy-knowledge.md#ingestion-step-by-step). |

## Middleware order in `app.ts`

Order is the whole design here. Read it top to bottom.

| Order | Line | What | Why it is at this position |
| --- | --- | --- | --- |
| 1 | [app.ts:25-28](../../server/src/app.ts#L25-L28) | `cors({ origin: allowedOrigins })` | Must be first so browser preflight `OPTIONS` requests are answered before `authenticate` can reject them with 401. |
| 2 | [app.ts:30](../../server/src/app.ts#L30) | `express.json()` | Parses JSON bodies for everything below. |
| 3 | [app.ts:33](../../server/src/app.ts#L33) | `httpLogger` | Before auth, so failed logins and unauthenticated requests are logged too. |
| 4 | [app.ts:35-39](../../server/src/app.ts#L35-L39) | `GET /` | Public health message. |
| 5 | [app.ts:42](../../server/src/app.ts#L42) | `/auth` router | Public. You cannot require a token to obtain a token. |
| 6 | [app.ts:47](../../server/src/app.ts#L47) | `/api-docs` | Public. Reading the API shape needs no login; calling it from Swagger UI needs a pasted token. |
| 7 | [app.ts:50](../../server/src/app.ts#L50) | `authenticate` | The boundary. Everything after this line has `req.user`. |
| 8 | [app.ts:52-62](../../server/src/app.ts#L52-L62) | Eleven protected routers | Each adds its own role checks where needed. |

## Non-obvious logic

### Why `import "dotenv/config"` is line 1

ES module imports are hoisted and evaluated in source order, depth first. `auth.service.ts` reads `process.env.JWT_SECRET` at the top level of the module ([auth.service.ts:16-20](../../server/src/services/auth.service.ts#L16-L20)). If `dotenv/config` were imported after `app.js`, that read would happen before `.env` was loaded and the server would crash claiming the secret is missing. Keeping it as the first import in [server.ts:1](../../server/src/server.ts#L1) guarantees the order.

### CORS is an allowlist, not `*`

`CLIENT_ORIGIN` is split on commas and trimmed ([app.ts:25-27](../../server/src/app.ts#L25-L27)). The comment on lines 21-24 gives the reason: the API authenticates with bearer tokens, so a wildcard would let a script on any site call it with a stolen token.

### Swagger scans source files at import time

`apis` points at `../routes/*.ts` ([swagger.ts:309](../../server/src/openapi/swagger.ts#L309)). `swaggerJsdoc(options)` runs when the module is imported ([swagger.ts:312](../../server/src/openapi/swagger.ts#L312)) and extracts every `@openapi` YAML comment. This works because the server runs from `.ts` sources through `tsx`. A compiled build would have no `.ts` route files at that path, so the docs page would be empty.

Global `security: [{ bearerAuth: [] }]` ([swagger.ts:18](../../server/src/openapi/swagger.ts#L18)) marks every endpoint as needing a token; the login route overrides it with `security: []` ([auth.route.ts:14](../../server/src/routes/auth.route.ts#L14)).

### TypeScript settings worth knowing

[server/tsconfig.json](../../server/tsconfig.json) is strict in ways that shape the code:

- `module` and `moduleResolution` are `NodeNext` (lines 9-10), which is why every relative import ends in `.js`.
- `verbatimModuleSyntax` (line 18) forces `import type` for type-only imports.
- `exactOptionalPropertyTypes` (line 22) is why some signatures spell out `| undefined`, for example [approvalStore.ts:125-126](../../server/src/approvals/approvalStore.ts#L125-L126), and why the traces controller builds its argument with a conditional spread ([traces.controller.ts:11](../../server/src/controllers/traces.controller.ts#L11)).
- `noUncheckedIndexedAccess` (line 21) is why `result.interruptions[0]!` has a non-null assertion ([runner.ts:73](../../server/src/orchestrator/runner.ts#L73)).
- `include` covers only `src/` (line 31), so `server/scripts/` is not type-checked by this config.

## Inputs, outputs, side effects, dependencies

- **Inputs:** `PORT`, `CLIENT_ORIGIN` from the environment.
- **Outputs:** a listening HTTP server; the exported `app`.
- **Side effects:** importing `app.ts` opens the SQLite database, constructs every agent, and constructs the `OpenAI` client in `config/openai.ts` (all through transitive imports). The last one throws if `OPENAI_API_KEY` is missing, so the key is checked at startup. The Postgres pool is not opened here.
- **Depends on:** every other server module, since it mounts them all.

## Why it is built this way, and trade-offs

- **One global `authenticate`** instead of per-route auth means a new router is protected by default. The cost is that public routes must be mounted above line 50; mounting one below it silently makes it private.
- **`app` and `server` are separate files**, the usual pattern for testing an Express app without binding a port. No tests use it yet.
- **No build step.** Simple for development, but there is no `start` or `build` script, so there is no defined way to run this in production.
- **No error-handling or 404 middleware.** Express's defaults apply. See [09](../09-ISSUES-AND-OPEN-QUESTIONS.md#missing-error-handling).

## Source files covered

- `server/src/server.ts`
- `server/src/app.ts`
- `server/src/openapi/swagger.ts`
- `server/src/config/openai.ts`
- `server/package.json`
- `server/tsconfig.json`
- `.vscode/launch.json`
- `.gitignore`
