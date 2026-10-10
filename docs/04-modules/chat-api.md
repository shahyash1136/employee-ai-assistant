# Chat API

## Purpose and responsibility

The HTTP face of the assistant. It validates a chat turn, enforces session ownership, saves messages, calls the [Agent Runner](agent-runner.md), and translates the result into one of four response shapes. It also serves the endpoints behind the history sidebar.

## Where it sits

API layer, between [Auth and Access Control](auth-and-access-control.md) and the [Agent Runner](agent-runner.md). See [Architecture 2.1](../03-ARCHITECTURE-AND-LIFECYCLE.md#21-server), the flow in [4.2](../03-ARCHITECTURE-AND-LIFECYCLE.md#42-user-sends-a-chat-message), and the error map in [6.1](../03-ARCHITECTURE-AND-LIFECYCLE.md#61-server-side-of-a-chat-turn).

## Endpoints

| Method and path | Handler | Notes |
| --- | --- | --- |
| `POST /chat` | `chatController` [chat.controller.ts:75-240](../../server/src/controllers/chat.controller.ts#L75-L240) | Rate limited ([chat.route.ts:58](../../server/src/routes/chat.route.ts#L58)). |
| `GET /chat/sessions` | `listSessions` [chat.controller.ts:292-302](../../server/src/controllers/chat.controller.ts#L292-L302) | Caller's own sessions, newest activity first, max 100. |
| `GET /chat/:sessionId/messages` | `getSessionMessages` [chat.controller.ts:275-279](../../server/src/controllers/chat.controller.ts#L275-L279) | Full transcript. Owner only. |
| `GET /chat/:sessionId/approvals` | `getSessionApprovals` [chat.controller.ts:284-288](../../server/src/controllers/chat.controller.ts#L284-L288) | Approvals raised in this session. Owner only. |
| `DELETE /chat/:sessionId` | `deleteSession` [chat.controller.ts:304-321](../../server/src/controllers/chat.controller.ts#L304-L321) | 409 while an approval is pending. |

## `POST /chat` request and responses

Request body: `{ sessionId: string (UUID), message: string, format?: "text" | "json" }`.

| Outcome | Status | Body | Saved to history? |
| --- | --- | --- | --- |
| Normal answer, text mode | 200 | `text/event-stream`: `data: {"token":"..."}` events, then `data: [DONE]` | User + assistant |
| Normal answer, JSON mode | 200 | `{ success, response: { summary, employees, metrics } }` | User + assistant (as a JSON string) |
| Guardrail declined | 200 | Text mode: `{ success, response: "<decline>" }`. JSON mode: the same wrapped in the structured shape | User + decline text |
| Tool paused for approval | 200 | `{ success, requiresApproval: true, approvalId, message, pendingTool }` | User only |
| Validation failure | 400 / 403 | `{ success: false, message }` | Nothing |
| Run failed or empty | 502 | `{ success: false, message }` | User only |
| Unexpected | 500 | `{ success: false, message }` or an SSE `error` event | User, possibly |

## Key functions

| Function | Location | What it does |
| --- | --- | --- |
| `isNonEmptyString` | [chat.controller.ts:18-20](../../server/src/controllers/chat.controller.ts#L18-L20) | Type guard used for body validation. |
| `describeGuardrailFailure` | [chat.controller.ts:25-48](../../server/src/controllers/chat.controller.ts#L25-L48) | Maps a thrown tripwire to a user-facing sentence, or `null` if the error is something else. |
| `approvalRequiredPayload` | [chat.controller.ts:54-66](../../server/src/controllers/chat.controller.ts#L54-L66) | Builds the JSON body for a paused turn. Shared by both modes. |
| `authorizeSessionAccess` | [chat.controller.ts:245-270](../../server/src/controllers/chat.controller.ts#L245-L270) | Guard for the read and delete endpoints. Sends the error response itself and returns `null`. |

## Non-obvious logic, step by step

### 1. Validation order

[chat.controller.ts:82-120](../../server/src/controllers/chat.controller.ts#L82-L120):

1. `req.user` present (defensive; the global middleware should guarantee it).
2. `sessionId` and `message` are non-empty strings.
3. `format`, if given, is `"json"` or `"text"`.
4. `sessionId` is a UUID ([sessionId.ts:4-9](../../server/src/conversation/sessionId.ts#L4-L9)).
5. If the session already has an owner, it must be the caller.

### 2. Session ownership

The client chooses the session id. The first user to write to an id owns it ([chat.controller.ts:114-120](../../server/src/controllers/chat.controller.ts#L114-L120)). Without the check, any signed-in user could post into someone else's session and have the model read that history back to them.

The UUID requirement is the other half: if ids could be `session-1`, someone could claim predictable ids ahead of time and lock others out ([sessionId.ts:1-3](../../server/src/conversation/sessionId.ts#L1-L3)).

`POST /chat` and the read endpoints treat an unknown session differently on purpose. Posting to an unknown id creates it. Reading an unknown id returns 404 instead of an empty list, so the response does not confirm which ids exist ([chat.controller.ts:242-244](../../server/src/controllers/chat.controller.ts#L242-L244)).

### 3. Save first, then run

`addUserMessage` runs before the agent ([chat.controller.ts:123](../../server/src/controllers/chat.controller.ts#L123)), and `getRecentHistory` then returns the last 20 messages including the new one. The consequence: if the run fails, the user message stays in history with no reply after it.

### 4. Two modes

- **JSON mode** ([chat.controller.ts:126-168](../../server/src/controllers/chat.controller.ts#L126-L168)) uses the structured agent variants. The output is an object matching `StructuredResponseSchema`. It is saved to history as `JSON.stringify(output)`, so on later turns the model sees its earlier answer as raw JSON text.
- **Text mode** ([chat.controller.ts:170-224](../../server/src/controllers/chat.controller.ts#L170-L224)) uses the plain variants and ends in the SSE replay.

The React client only ever uses text mode ([client/src/lib/api.ts:118-122](../../client/src/lib/api.ts#L118-L122)). JSON mode is reachable through the API and Swagger only.

### 5. Guardrail trips are answers, not errors

A tripwire throws out of the runner. `describeGuardrailFailure` recognises the two SDK error classes ([chat.controller.ts:26](../../server/src/controllers/chat.controller.ts#L26), [chat.controller.ts:35](../../server/src/controllers/chat.controller.ts#L35)) and picks one of three fixed messages:

- Any input guardrail: "I can only help with questions about employees, attendance..." ([chat.controller.ts:22-23](../../server/src/controllers/chat.controller.ts#L22-L23)).
- The hallucination guardrail, matched by its `name` string: "I wasn't able to fully verify..." ([chat.controller.ts:42-43](../../server/src/controllers/chat.controller.ts#L42-L43)).
- Any other output guardrail: "I wasn't able to safely return that response..." ([chat.controller.ts:44](../../server/src/controllers/chat.controller.ts#L44)).

The decline is saved as an assistant message and returned with status 200. The real reason is logged server-side only, so an attacker probing with injection attempts learns nothing about which check caught them.

### 6. The simulated stream

By the time headers are sent, the answer is complete, checked, and already saved ([chat.controller.ts:206-215](../../server/src/controllers/chat.controller.ts#L206-L215)). The loop slices 4 characters at a time with a 15 ms sleep ([chat.controller.ts:68-69](../../server/src/controllers/chat.controller.ts#L68-L69), [chat.controller.ts:217-221](../../server/src/controllers/chat.controller.ts#L217-L221)). A 400-character answer takes about 1.5 seconds to replay. Each token is `JSON.stringify`'d so newlines inside the text cannot break the SSE framing.

`res.flushHeaders()` ([chat.controller.ts:215](../../server/src/controllers/chat.controller.ts#L215)) sends headers immediately so the client can switch into stream-reading mode.

### 7. The outer catch has two personalities

[chat.controller.ts:225-239](../../server/src/controllers/chat.controller.ts#L225-L239). Before headers are sent it can still answer 500 JSON. After, the status line is gone, so it writes an SSE `error` event and `[DONE]`. `res.headersSent` decides which.

### 8. Delete is blocked while an approval is pending

A paused run is resumed from the approvals table and its reply is written into the session. Deleting the session underneath would leave the approver deciding something whose answer has nowhere to go ([chat.controller.ts:308-317](../../server/src/controllers/chat.controller.ts#L308-L317)).

## Inputs, outputs, side effects, dependencies

- **Inputs:** request body and params, `req.user`.
- **Outputs:** the response shapes above.
- **Side effects:** inserts into `sessions` and `messages`; indirectly, rows in `approvals`, `traces`, `spans`; OpenAI spend.
- **Depends on:** [Agent Runner](agent-runner.md), [Conversation Store](conversation-store.md), [Approvals](approvals.md) (read-only use of `approvalStore`), SDK error classes.

## Why it is built this way, and trade-offs

- **One endpoint, mixed content types.** `POST /chat` may answer with SSE or JSON. This keeps the server simple but forces the client to branch on `Content-Type` ([client/src/lib/api.ts:124-146](../../client/src/lib/api.ts#L124-L146)).
- **Replay over real streaming.** Safe, because guardrails see the full answer first. The cost is latency: the user waits for the entire run before the first character.
- **Declines returned as 200.** The UI shows them as a normal assistant bubble with no special handling. The downside is that clients and metrics cannot tell a decline from an answer without reading the text.
- **`chatController` is one 165-line function** with nested try/catch blocks per mode. It is readable top to bottom but the two modes repeat the same decline and 502 handling.

## Source files covered

- `server/src/controllers/chat.controller.ts`
- `server/src/routes/chat.route.ts`
