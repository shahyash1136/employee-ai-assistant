# Approvals

## Purpose and responsibility

Human-in-the-loop (HITL) sign-off for sensitive tool calls. When a manager or admin asks a company-wide salary question, the run stops before the tool executes. This module stores the frozen run, lists pending requests for approvers, records the decision exactly once, and hands the run back to the [Agent Runner](agent-runner.md) to continue.

## Where it sits

It spans two layers: an HTTP controller in the API layer and a store in the data layer. See [Architecture 2.1](../03-ARCHITECTURE-AND-LIFECYCLE.md#21-server), [flow 4.4](../03-ARCHITECTURE-AND-LIFECYCLE.md#44-sensitive-tool-call-pause-approve-resume), and [state diagram 5.1](../03-ARCHITECTURE-AND-LIFECYCLE.md#51-approval).

## Endpoints

| Method and path | Handler | Access |
| --- | --- | --- |
| `GET /approvals?sessionId=&status=` | `listApprovals` [approvals.controller.ts:7-18](../../server/src/controllers/approvals.controller.ts#L7-L18) | manager, admin ([approvals.route.ts:46](../../server/src/routes/approvals.route.ts#L46)) |
| `POST /approvals/:approvalId/decision` | `decideApproval` [approvals.controller.ts:20-90](../../server/src/controllers/approvals.controller.ts#L20-L90) | manager, admin ([approvals.route.ts:99-103](../../server/src/routes/approvals.route.ts#L99-L103)) |
| `GET /chat/:sessionId/approvals` | In the [Chat API](chat-api.md) | The session's owner |

The third endpoint gives a session's owner a view of approvals raised in their own conversation, without needing the dashboard role. The chat UI polls it to learn that a request was decided ([chat.controller.ts:281-288](../../server/src/controllers/chat.controller.ts#L281-L288)). The code comment there talks about "an employee whose request is paused"; at this commit employees can no longer raise approvals at all (see [tools.md](tools.md#why-employees-skip-the-approval-pause)), so today the caller is always a manager or admin looking at their own session.

## Key types and functions

| Item | Location | What it is |
| --- | --- | --- |
| `ApprovalRecord` | [approvalStore.ts:3-14](../../server/src/approvals/approvalStore.ts#L3-L14) | Full row, including `serializedState`. Internal. |
| `ApprovalSummary` | [approvalStore.ts:16-26](../../server/src/approvals/approvalStore.ts#L16-L26) | The same minus `serializedState`. What every API returns. |
| `summarize` | [approvalStore.ts:28-31](../../server/src/approvals/approvalStore.ts#L28-L31) | Strips the state with a rest destructure. |
| `MAX_APPROVALS` | [approvalStore.ts:35](../../server/src/approvals/approvalStore.ts#L35) | 200. |
| `ApprovalStore.create` | [approvalStore.ts:89-103](../../server/src/approvals/approvalStore.ts#L89-L103) | Insert, then prune to the newest 200. |
| `ApprovalStore.get` | [approvalStore.ts:105-108](../../server/src/approvals/approvalStore.ts#L105-L108) | Full record by id. |
| `ApprovalStore.resolve` | [approvalStore.ts:112-119](../../server/src/approvals/approvalStore.ts#L112-L119) | The atomic claim. Returns whether this call changed the row. |
| `ApprovalStore.list` | [approvalStore.ts:121-143](../../server/src/approvals/approvalStore.ts#L121-L143) | Summaries, newest first, optional filters. |

## Non-obvious logic, step by step

### What is actually stored

A row holds display fields (tool name, arguments as a JSON string, agent name), bookkeeping (session id, status, timestamps, `format`), and `serialized_state`: the SDK's `RunState` as a string. That string contains the conversation so far, which agent was active, the pending tool call, and the run context (the requester's identity). It is everything needed to continue in a different HTTP request, minutes or hours later, possibly after a server restart.

`serializedState` never leaves the server. `list` maps every row through `summarize`, and `decideApproval` only reads display fields from the full record.

### The atomic claim

```sql
UPDATE approvals SET status = ?, resolved_at = ?
WHERE approval_id = ? AND status = 'pending'
```

([approvalStore.ts:61-64](../../server/src/approvals/approvalStore.ts#L61-L64)). `resolve` returns `changes > 0`. If two approvers click at the same instant, both requests pass the controller's "is it pending?" check ([approvals.controller.ts:41-46](../../server/src/controllers/approvals.controller.ts#L41-L46)), but only one `UPDATE` matches a row. The other caller gets `false`, the runner returns `not_found`, and the controller answers 404 ([approvals.controller.ts:50-54](../../server/src/controllers/approvals.controller.ts#L50-L54)). The paused run is executed once.

So there are two checks: a friendly one in the controller that gives a clear 409 message in the common case, and the authoritative one in the store that closes the race.

### `decideApproval` walkthrough

[approvals.controller.ts:20-90](../../server/src/controllers/approvals.controller.ts#L20-L90):

1. `approve` must be a boolean, else 400.
2. Unknown id: 404.
3. Already resolved: 409 with the existing status in the message.
4. `resumeEmployeeAgent(approvalId, { approve, message })`. This awaits the whole resumed run, so the approver's request stays open until the model finishes.
5. `not_found`: lost the race, 404.
6. `needs_approval`: the resumed run reached another sensitive tool. Respond with a new `requiresApproval` payload.
7. Otherwise turn the output into text. A structured output is `JSON.stringify`'d.
8. If the text is blank, substitute a fallback sentence so the requester is not left with silence ([approvals.controller.ts:73-77](../../server/src/controllers/approvals.controller.ts#L73-L77)).
9. Look up the session's **owner** and save the reply under that user ([approvals.controller.ts:80-87](../../server/src/controllers/approvals.controller.ts#L80-L87)). The approver is a different person and must not become the author.
10. Return the output to the approver.

### No ownership check, on purpose

The comment at [approvals.controller.ts:37-40](../../server/src/controllers/approvals.controller.ts#L37-L40) explains: the point of HITL is that someone *else* signs off. Access is decided purely by `requireRole(["manager", "admin"])`.

What the code does not do is stop a manager approving **their own** request. `client/TESTING.md` notes this as known behaviour.

### Dynamic SQL in `list`

`list` builds its `WHERE` clause from whichever filters were given ([approvalStore.ts:128-141](../../server/src/approvals/approvalStore.ts#L128-L141)). Only fixed strings (`"session_id = ?"`, `"status = ?"`) are concatenated; the values are bound parameters, so this is not an injection risk. Because the SQL text varies, this statement is prepared on every call, unlike the others which are prepared once at import.

The controller whitelists `status` before passing it on ([approvals.controller.ts:10-14](../../server/src/controllers/approvals.controller.ts#L10-L14)).

### Pruning

After every insert, rows outside the newest 200 by `rowid` are deleted ([approvalStore.ts:66-71](../../server/src/approvals/approvalStore.ts#L66-L71)). The cap exists because each row carries a full serialized run. It does not consider status, so a very old pending approval can be deleted.

## Inputs, outputs, side effects, dependencies

- **Inputs:** a paused run from the runner; a decision from an approver.
- **Outputs:** approval summaries; the resumed run's result.
- **Side effects:** writes to `approvals`; writes an assistant message into `messages`; triggers a model run.
- **Depends on:** [Database](database.md), [Agent Runner](agent-runner.md), [Conversation Store](conversation-store.md).
- **Used by:** [Agent Runner](agent-runner.md) (`create`, `get`, `resolve`), [Chat API](chat-api.md) (`list`).

The runner imports the store and the approvals controller imports the runner. The store itself imports neither, so there is no cycle.

## Why it is built this way, and trade-offs

- **Persisted in SQLite** so a pause survives restarts. The Swagger text still says "in-memory ... does not survive a server restart" ([approvals.route.ts:15-17](../../server/src/routes/approvals.route.ts#L15-L17)); that is out of date.
- **Synchronous resume inside the approver's request.** Simple: no job queue. But the approver waits for the model, and a failure in the resumed run surfaces as a 500 to the approver while the requester hears nothing. See [09](../09-ISSUES-AND-OPEN-QUESTIONS.md#missing-error-handling).
- **Status flips before the work is done.** Prevents double execution; means "approved" does not guarantee an answer was delivered.
- **The requester is notified by polling,** not push. See [client-chat.md](client-chat.md#the-approval-poll).
- **No audit of who decided.** The row records when, not which approver.

## Source files covered

- `server/src/approvals/approvalStore.ts`
- `server/src/controllers/approvals.controller.ts`
- `server/src/routes/approvals.route.ts`
