# Conversation Store

## Purpose and responsibility

Persist chat sessions and their messages, and answer the questions the rest of the server asks about them: who owns this session, what was said, what should the model see, and which sessions does this user have.

## Where it sits

Data layer, used by the [Chat API](chat-api.md) and the [Approvals](approvals.md) controller. See [Architecture 2.1](../03-ARCHITECTURE-AND-LIFECYCLE.md#21-server) and [state diagram 5.2](../03-ARCHITECTURE-AND-LIFECYCLE.md#52-chat-session-server).

## Key files

| File | Role |
| --- | --- |
| [conversation/types.ts](../../server/src/conversation/types.ts) | `ConversationRole` and `ConversationMessage` (`role`, `content`, `timestamp: Date`). |
| [conversation/sessionId.ts](../../server/src/conversation/sessionId.ts) | `isValidSessionId` and its error message. |
| [conversation/session.store.ts](../../server/src/conversation/session.store.ts) | All SQL. Class `SessionStore`, singleton `sessionStore`. |
| [conversation/conversation.service.ts](../../server/src/conversation/conversation.service.ts) | The API controllers use. Class `ConversationService`, singleton `conversationService`. |

## Two layers, and why

`ConversationService` is a thin facade over `SessionStore`. It adds two things: the `RECENT_HISTORY_LIMIT` policy and role-specific helpers (`addUserMessage`, `addAssistantMessage`) that stamp the time. Controllers import only the service, so SQL details stay in one file.

| Service method | Lines | Store call | Used for |
| --- | --- | --- | --- |
| `getHistory` | [8-10](../../server/src/conversation/conversation.service.ts#L8-L10) | `get` | Full transcript for the UI. |
| `getRecentHistory` | [14-16](../../server/src/conversation/conversation.service.ts#L14-L16) | `getRecent(id, 20)` | What the model is given. |
| `getSessionOwner` | [18-20](../../server/src/conversation/conversation.service.ts#L18-L20) | `getSessionOwner` | Ownership checks. |
| `listSessions` | [22-24](../../server/src/conversation/conversation.service.ts#L22-L24) | `listForUser(userId, 100)` | Sidebar. |
| `addUserMessage`, `addAssistantMessage` | [26-40](../../server/src/conversation/conversation.service.ts#L26-L40) | `append` | Writing a turn. |
| `clearConversation` | [42-44](../../server/src/conversation/conversation.service.ts#L42-L44) | `clear` | Delete. |

## Non-obvious logic, step by step

### Sessions are created by their first message

`append` runs two statements ([session.store.ts:91-100](../../server/src/conversation/session.store.ts#L91-L100)):

1. `INSERT INTO sessions ... ON CONFLICT(session_id) DO NOTHING` ([session.store.ts:10-14](../../server/src/conversation/session.store.ts#L10-L14)). On the first message this creates the row and records the owner. On every later message it does nothing, so the owner and `created_at` never change.
2. `INSERT INTO messages`.

There is no "create session" endpoint. A session with zero messages cannot exist, which is why the sidebar query can assume every session has a first message.

The two inserts are not wrapped in a transaction. `node:sqlite` is synchronous and nothing awaits between them, so another request cannot interleave, but a crash between them could leave a session row with no messages.

### Ownership

`getSessionOwner` returns the `user_id` from `sessions`, or `undefined` for an unknown id ([session.store.ts:115-118](../../server/src/conversation/session.store.ts#L115-L118)). Callers use the three-way result:

- `undefined`: nobody owns it yet. `POST /chat` proceeds and claims it; read endpoints answer 404.
- equals the caller: allowed.
- anything else: 403.

### Why session ids must be UUIDs

The client picks the id. If ids were guessable, someone could send a first message to `session-1` and own it forever. `isValidSessionId` accepts UUID versions 1 to 8 with the standard variant bits ([sessionId.ts:4-9](../../server/src/conversation/sessionId.ts#L4-L9)). The browser generates version 4 with `crypto.randomUUID()`.

### What the model sees vs. what the user sees

- `get` returns every message, oldest first ([session.store.ts:102-104](../../server/src/conversation/session.store.ts#L102-L104)).
- `getRecent` selects the newest N with `ORDER BY id DESC LIMIT ?`, then reverses in JavaScript to restore chronological order ([session.store.ts:108-111](../../server/src/conversation/session.store.ts#L108-L111)).

The limit is 20 messages, about ten turns ([conversation.service.ts:5](../../server/src/conversation/conversation.service.ts#L5)). In a long conversation the model silently forgets the beginning while the UI still shows it. It is a count of messages, not tokens.

Ordering uses the autoincrement `id`, not `timestamp`, so messages saved within the same millisecond still sort correctly.

### What gets stored as a "message"

Only `user` and `assistant` text. Not stored: tool calls, tool results, handoffs, or which agent answered. Those live in traces. Consequences:

- On the next turn the model sees its earlier *answer* but not the tool results behind it. A follow-up that needs the data again triggers a fresh tool call.
- Guardrail decline sentences are stored as assistant messages and replayed to the model.
- In JSON mode the stored content is the stringified structured object.
- A paused turn stores the user message only. The assistant message arrives when the approval is decided.

### The sidebar query

`selectForUser` ([session.store.ts:38-50](../../server/src/conversation/session.store.ts#L38-L50)) returns one row per session with two correlated subqueries: the first `user` message as the title, and `MAX(timestamp)` as `updated_at`, sorted by that descending.

`toTitle` collapses whitespace, truncates to 60 characters with an ellipsis, and falls back to "New conversation" ([session.store.ts:77-85](../../server/src/conversation/session.store.ts#L77-L85)). Titles are computed on read; there is no title column.

### Deleting

`clear` deletes messages, then the session row ([session.store.ts:130-133](../../server/src/conversation/session.store.ts#L130-L133)). Approvals and traces that reference the session id are left in place. After deletion the id is unowned again, so in principle it could be reused by anyone who knows it.

### Prepared statements at import

Every `db.prepare(...)` at the top of `session.store.ts` runs when the module is first imported ([session.store.ts:10-53](../../server/src/conversation/session.store.ts#L10-L53)). This requires the tables to exist already, which holds because importing `database.ts` creates them first.

The repeated `as unknown as MessageRow[]` casts exist because `node:sqlite` types rows as generic records.

## Inputs, outputs, side effects, dependencies

- **Inputs:** session id, user id, message text.
- **Outputs:** `ConversationMessage[]`, `SessionSummary[]`, owner id.
- **Side effects:** reads and writes `sessions` and `messages`.
- **Depends on:** [Database](database.md).

## Why it is built this way, and trade-offs

- **Client-generated ids** let the browser know the id before the first request, so the first `POST /chat` can carry it and the URL can be built without a round trip. The UUID rule and first-writer-wins ownership make that safe.
- **A message cap instead of summarization** is the simplest way to bound prompt size. Long conversations lose early context.
- **Text-only history** keeps the store independent of SDK item formats, at the cost of the model losing tool results between turns.
- **`user_id` on every message row** duplicates what `sessions` already knows. It is written but never queried.

## Source files covered

- `server/src/conversation/conversation.service.ts`
- `server/src/conversation/session.store.ts`
- `server/src/conversation/sessionId.ts`
- `server/src/conversation/types.ts`
