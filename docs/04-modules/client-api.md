# Client API Layer

## Purpose and responsibility

The one place in the client that talks to the server. It builds requests, attaches the token, normalises every failure into a single error type, and parses the chat endpoint's two possible response formats. Hooks call `api.*` functions and never see `fetch`, headers, or SSE framing.

## Where it sits

Between the feature hooks and the network. See [Architecture 2.2](../03-ARCHITECTURE-AND-LIFECYCLE.md#22-client) and [error flow 6.2](../03-ARCHITECTURE-AND-LIFECYCLE.md#62-client-side).

## Key files

| File | Role |
| --- | --- |
| [client/src/lib/api.ts](../../client/src/lib/api.ts) | All requests. |
| [client/src/types/api.ts](../../client/src/types/api.ts) | Response shapes, hand-mirrored from the server. |

## The public surface

The `api` object ([api.ts:223-233](../../client/src/lib/api.ts#L223-L233)):

| Call | HTTP | Returns |
| --- | --- | --- |
| `api.auth.login(username, password)` | `POST /auth/login` | `LoginResponse` |
| `api.chat.send(sessionId, message, { onToken, signal })` | `POST /chat` | `ChatSendResult` |
| `api.chat.messages(sessionId, signal?)` | `GET /chat/:id/messages` | `{ data: ServerMessage[] }` |
| `api.chat.approvals(sessionId, signal?)` | `GET /chat/:id/approvals` | `{ data: ApprovalSummary[] }` |
| `api.chat.sessions(signal?)` | `GET /chat/sessions` | `{ data: ChatSessionSummary[] }` |
| `api.chat.deleteSession(sessionId)` | `DELETE /chat/:id` | `{ success }` |
| `api.approvals.list(status, signal?)` | `GET /approvals?status=` | `{ data: ApprovalSummary[] }` |
| `api.approvals.decide(approvalId, approve, message?)` | `POST /approvals/:id/decision` | `DecisionResponse` |

Also exported: `ApiError`, `setUnauthorizedHandler`, and the `ChatSendResult` type.

The client uses 8 of the server's roughly 30 endpoints. It never calls the domain REST routes, `/traces`, `/logs`, or `/metrics`.

## Non-obvious logic, step by step

### `send`: the core

[api.ts:42-71](../../client/src/lib/api.ts#L42-L71). Every request goes through it.

1. Set `Content-Type: application/json` only when there is a body.
2. If `auth` is true (the default) and a token exists, add `Authorization: Bearer <token>`.
3. `fetch`. If it rejects:
   - an `AbortError` is rethrown unchanged, so callers can recognise "I cancelled this" and stay quiet;
   - anything else becomes `ApiError(0, "Cannot reach the server. Is it running?")`. Status 0 means "no HTTP response at all".
4. If the status is not 2xx: on a 401 for an authenticated call, invoke the unauthorized handler; then throw `ApiError(status, message)`.
5. Otherwise return the raw `Response`, so the caller decides how to read the body.

`request<T>` is `send` plus `response.json()` ([api.ts:83-86](../../client/src/lib/api.ts#L83-L86)). The generic `T` is a compile-time promise only. Nothing validates the JSON at runtime, so if the server's shape changes the types here will be wrong without warning.

`readErrorMessage` tries to pull `message` from a JSON error body and falls back to `Request failed (<status>)` for non-JSON bodies such as Express's default HTML error pages ([api.ts:73-81](../../client/src/lib/api.ts#L73-L81)).

### The `auth: false` option

Used only by login ([api.ts:90-95](../../client/src/lib/api.ts#L90-L95)). It has two effects: no token header is sent, and a 401 does **not** trigger the logout handler. A 401 from login means "wrong password", not "your session expired".

### The 401 hook

`onUnauthorized` is a module-level variable holding at most one callback ([api.ts:28-31](../../client/src/lib/api.ts#L28-L31)). `AuthProvider` sets it. This keeps `api.ts` free of React imports while still letting any failed call end the session. See [client-auth.md](client-auth.md#three-ways-a-session-ends).

### `sendChat`: one endpoint, two formats

[api.ts:113-150](../../client/src/lib/api.ts#L113-L150). The server answers `POST /chat` with either an SSE stream or JSON, both with status 200. The function inspects the `Content-Type` header and returns a discriminated union:

| Server sent | Result |
| --- | --- |
| `text/event-stream` | `{ kind: "streamed" }`. The text was delivered through `onToken` as it arrived. |
| JSON with `requiresApproval`, `approvalId`, `pendingTool` | `{ kind: "approval", approvalId, pendingTool }` |
| Any other JSON | `{ kind: "reply", text }`. In practice a guardrail decline. A non-string `response` is stringified. |

The body it sends has no `format` field, so the server always uses text mode.

### `readTokenStream`: parsing SSE by hand

[api.ts:153-181](../../client/src/lib/api.ts#L153-L181).

Why not the browser's `EventSource`? It only does `GET` and cannot set an `Authorization` header. So the code reads the `fetch` response body as a stream.

1. `response.body.pipeThrough(new TextDecoderStream())` turns bytes into text and correctly handles multi-byte characters split across network chunks.
2. Each chunk is appended to `buffer`. A network chunk can contain half an event or several events.
3. While the buffer contains `\n\n` (the SSE event terminator), cut one complete event off the front.
4. Find the line starting with `data:` and take what follows.
5. `[DONE]` returns. Otherwise parse the JSON: `{ error }` throws `ApiError(500, ...)`, `{ token }` calls `onToken`.
6. If the stream ends without `[DONE]`, it returns normally.

The assignment inside the `while` condition, `(boundary = buffer.indexOf("\n\n")) !== -1`, finds and tests in one step.

### Cancellation

Read calls accept an optional `AbortSignal`. Hooks create an `AbortController` per effect and abort in cleanup. `send` passes the signal to `fetch`. Aborting during a stream makes `reader.read()` reject with an `AbortError`, which propagates up like any other.

### URL safety

Path parameters go through `encodeURIComponent` ([api.ts:185](../../client/src/lib/api.ts#L185), [api.ts:219](../../client/src/lib/api.ts#L219)). They are UUIDs in practice, but a session id comes from the URL bar and could be anything.

## The types file

[types/api.ts](../../client/src/types/api.ts) declares `UserRole`, `AuthUser`, `LoginResponse`, `ApprovalSummary`, `PendingTool`, `ApprovalRequiredResponse`, `DecisionResponse`, `ServerMessage`, and `ChatSessionSummary`. The header comment lists the server files they were copied from. There is no shared package or code generation, so these must be updated by hand whenever the server's responses change.

`DecisionResponse` is a union the caller narrows with `"requiresApproval" in result` ([use-approvals.ts:64](../../client/src/hooks/use-approvals.ts#L64)).

## Inputs, outputs, side effects, dependencies

- **Inputs:** call arguments; the stored token; `VITE_API_URL`.
- **Outputs:** parsed responses or a thrown `ApiError` / `AbortError`.
- **Side effects:** network requests; may invoke the unauthorized handler.
- **Depends on:** `authStorage` from [Client Auth](client-auth.md) for the token.

`api.ts` imports `authStorage`, and `auth-provider.tsx` imports `api.ts`. There is no cycle because `auth-storage.ts` imports nothing.

## Why it is built this way, and trade-offs

- **A single choke point** means auth headers, error shape, and base URL are decided once. Swapping `fetch` or adding retries would touch one file.
- **One error type** lets callers write `err instanceof ApiError && err.status === 404` and show `err.message` directly.
- **Branching on content type** is a consequence of the server's design. It works, but the contract is implicit: nothing in the types says which statuses carry which format.
- **Hand-written SSE parsing** is about 30 lines and avoids a dependency. It handles only the subset the server emits (single `data:` lines).
- **No retries, no timeouts.** A hung server leaves the typing indicator up until the user navigates away.

## Source files covered

- `client/src/lib/api.ts`
- `client/src/types/api.ts`
