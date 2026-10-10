# Client Approvals

## Purpose and responsibility

The dashboard where a manager or admin reviews tool calls that are paused for sign-off and approves or rejects them.

## Where it sits

A feature module behind the role-gated `/approvals` route. See [Architecture 2.2](../03-ARCHITECTURE-AND-LIFECYCLE.md#22-client) and steps 8 to 16 of [flow 4.4](../03-ARCHITECTURE-AND-LIFECYCLE.md#44-sensitive-tool-call-pause-approve-resume). The server side is in [approvals.md](approvals.md).

## Key files

| File | Role |
| --- | --- |
| [pages/approvals-page.tsx](../../client/src/pages/approvals-page.tsx) | Page layout: header, error alert, card with loading / empty / table states, reject dialog. |
| [hooks/use-approvals.ts](../../client/src/hooks/use-approvals.ts) | The list, polling, and the `decide` action. |
| [components/approvals/approvals-table.tsx](../../client/src/components/approvals/approvals-table.tsx) | One row per pending approval with Approve and Reject buttons. |
| [components/approvals/reject-dialog.tsx](../../client/src/components/approvals/reject-dialog.tsx) | Optional reason before rejecting. |

`ToolArguments` and `humanizeToolName` are shared with [Client Chat](client-chat.md).

## What a row shows

Tool (humanized, so `get_average_salary` reads "Get average salary"), the agent that asked, the arguments, and when it was requested ([approvals-table.tsx:41-57](../../client/src/components/approvals/approvals-table.tsx#L41-L57)).

It does **not** show who asked or what their question was. The server's `ApprovalSummary` has `sessionId` but no user, and the transcript endpoints are owner-only. The approver decides from the tool name and arguments alone.

## Non-obvious logic, step by step

### Loading and polling

[use-approvals.ts:22-47](../../client/src/hooks/use-approvals.ts#L22-L47). One effect:

1. Defines `load`, which fetches `status=pending` and stores the result.
2. Calls it immediately.
3. Repeats every 15 seconds, because new requests come from other people's chats.
4. Cleanup clears the interval and aborts the in-flight request.

The effect depends on `reloadKey`. `refresh()` increments it, which tears the effect down and starts it again: an immediate fetch plus a fresh 15-second cycle. This is the same reload-key pattern as `useChatSessions`.

`loading` starts `true` and is set `false` after the first attempt, unless the request was aborted (so a StrictMode double-mount does not flip it early). It is never set back to `true`, so background refreshes do not flash the skeleton.

### `decide`

[use-approvals.ts:49-86](../../client/src/hooks/use-approvals.ts#L49-L86):

1. Add the approval's id to the `deciding` set. The row's buttons disable and Approve shows a spinner ([approvals-table.tsx:42](../../client/src/components/approvals/approvals-table.tsx#L42), [approvals-table.tsx:59-71](../../client/src/components/approvals/approvals-table.tsx#L59-L71)).
2. `await api.approvals.decide(...)`. This can take a while: the server runs the rest of the agent turn before it answers.
3. On success, remove the row locally without waiting for the next poll, and toast.
4. If the response contains `requiresApproval`, the resumed run hit a second sensitive tool. Toast that and refresh so the new row appears.
5. On error, toast the server's message. A 404 or 409 means someone else already decided it, so refresh to drop the stale row.
6. `finally`: remove the id from `deciding`.

`deciding` is a `Set` held in state. State must be replaced, not mutated, so each change builds a new set: `new Set(prev).add(id)`. Tracking ids individually lets one row be busy while others remain usable.

### Approve vs. reject

Approve acts immediately ([approvals-page.tsx:67](../../client/src/pages/approvals-page.tsx#L67)). Reject first stores the approval in `rejecting` state, which opens the dialog ([approvals-page.tsx:68](../../client/src/pages/approvals-page.tsx#L68)). Confirming closes the dialog and calls `decide(approval, false, reason || undefined)`, so an empty reason is omitted from the request ([approvals-page.tsx:77-80](../../client/src/pages/approvals-page.tsx#L77-L80)).

The reason is passed to the model as the rejection message; the dialog text says "Optionally tell the assistant why" ([reject-dialog.tsx:51-54](../../client/src/components/approvals/reject-dialog.tsx#L51-L54)). The model then writes the reply the requester sees.

### Resetting the form with a key

The reason field lives in an inner `RejectForm` component rendered with `key={approval.approvalId}` ([reject-dialog.tsx:27-34](../../client/src/components/approvals/reject-dialog.tsx#L27-L34)). A different approval means a different key, so React mounts a fresh form with an empty reason. No reset code is needed.

### What the approver does not see

The response to `decide` includes the resumed run's output, but the hook only looks at whether another approval is needed. The answer goes to the requester's chat, not the dashboard.

## Inputs, outputs, side effects, dependencies

- **Inputs:** button clicks; the optional reason.
- **Outputs:** the rendered table.
- **Side effects:** a request every 15 seconds while mounted; decision requests; toasts.
- **Depends on:** [Client API Layer](client-api.md), [Client UI Kit](client-ui-kit.md).

## Why it is built this way, and trade-offs

- **Polling** keeps the server free of push infrastructure at the cost of up to 15 seconds before a new request appears. The Refresh button covers impatience.
- **Pending only.** There is no history view of past decisions, though the API supports `status=approved` and `status=rejected`.
- **Pessimistic update.** The row is removed only after the server confirms. During a slow resume the row stays visible but disabled, which is honest about what is happening.
- **Self-approval is possible.** The dashboard lists a manager's own requests alongside everyone else's, and the server does not prevent deciding them.

## Source files covered

- `client/src/pages/approvals-page.tsx`
- `client/src/hooks/use-approvals.ts`
- `client/src/components/approvals/approvals-table.tsx`
- `client/src/components/approvals/reject-dialog.tsx`
