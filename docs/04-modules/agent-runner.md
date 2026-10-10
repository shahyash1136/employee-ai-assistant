# Agent Runner

## Purpose and responsibility

The single bridge between the app and the OpenAI Agents SDK's run loop. It starts runs, detects when a run has paused for approval, persists that pause, and later resumes it. Controllers never touch `Runner`, `RunState`, or traces directly.

## Where it sits

Top of the agents layer. Called by the [Chat API](chat-api.md) and the [Approvals](approvals.md) controller. See [Architecture 2.1](../03-ARCHITECTURE-AND-LIFECYCLE.md#21-server), flows [4.2](../03-ARCHITECTURE-AND-LIFECYCLE.md#42-user-sends-a-chat-message) to [4.4](../03-ARCHITECTURE-AND-LIFECYCLE.md#44-sensitive-tool-call-pause-approve-resume), and the state machine in [5.3](../03-ARCHITECTURE-AND-LIFECYCLE.md#53-agent-run-outcome).

## Key file

Everything is in [server/src/orchestrator/runner.ts](../../server/src/orchestrator/runner.ts). Note the folder is called `orchestrator/` but the Orchestrator *agent* lives in `agents/`.

| Item | Location | What it does |
| --- | --- | --- |
| `toInput` | [runner.ts:25-31](../../server/src/orchestrator/runner.ts#L25-L31) | Converts stored messages to SDK input items with the `user()` and `assistant()` helpers. Skips blank ones. |
| `OUTPUT_GUARDRAILS` | [runner.ts:33](../../server/src/orchestrator/runner.ts#L33) | Sensitive-info first, then hallucination. |
| `runner` | [runner.ts:40-43](../../server/src/orchestrator/runner.ts#L40-L43) | One shared `Runner` with output guardrails and `reasoning.effort: "low"`. |
| `EMPTY_OUTPUT_RETRIES` | [runner.ts:46](../../server/src/orchestrator/runner.ts#L46) | `1`. |
| `RunOutcome<T>` | [runner.ts:48-58](../../server/src/orchestrator/runner.ts#L48-L58) | `completed` with output, or `needs_approval` with an id and the pending tool. |
| `recordApproval` | [runner.ts:65-101](../../server/src/orchestrator/runner.ts#L65-L101) | Persists a paused run and builds the `needs_approval` outcome. |
| `runEmployeeAgentStream` | [runner.ts:103-134](../../server/src/orchestrator/runner.ts#L103-L134) | Text mode. Despite the name, it does not stream. |
| `runEmployeeAgentStructured` | [runner.ts:136-159](../../server/src/orchestrator/runner.ts#L136-L159) | JSON mode. |
| `ResumeOutcome<T>` | [runner.ts:161](../../server/src/orchestrator/runner.ts#L161) | `RunOutcome` plus `not_found`. |
| `resumeEmployeeAgent` | [runner.ts:167-242](../../server/src/orchestrator/runner.ts#L167-L242) | Claims an approval, restores the run, applies the decision, continues. |

## Non-obvious logic, step by step

### The shared `Runner`

A `Runner` holds configuration that applies to every run it starts. Two settings matter:

- `outputGuardrails` on the runner apply to the final output whichever agent produced it. Putting them here once avoids listing them on all sixteen agents.
- `modelSettings: { reasoning: { effort: "low" } }`. The comment on [runner.ts:34-39](../../server/src/orchestrator/runner.ts#L34-L39) records an observed failure: with reasoning effectively off, the specialist would often end its turn right after a handoff with an empty message. Setting effort to `low` removed it in testing.

The guardrail classifier agents call the top-level `run()` function instead ([inputSafety.guardrail.ts:113](../../server/src/guardrails/inputSafety.guardrail.ts#L113)), so they do **not** inherit these settings: no output guardrails are applied to a classifier's own answer, and they run at the SDK's default reasoning effort.

### Starting a run

[runner.ts:108-133](../../server/src/orchestrator/runner.ts#L108-L133):

1. `toInput(history)` builds the message list.
2. `withTrace(name, fn, { groupId: sessionId })` opens a trace. `groupId` is how every trace is tied back to a chat session; the trace processor stores it as `session_id`.
3. `runner.run(orchestratorAgent, input, { context: user })`. The `context` object is the authenticated user. The SDK never sends it to the model. It is handed to tool `execute` functions, `needsApproval` functions, and dynamic `instructions` functions.
4. `result.interruptions.length > 0` means a tool wanted approval. Record it and return.
5. Otherwise read `result.finalOutput`.
6. `finally { await trace.end() }` closes the trace even when a guardrail throws, so traces never stay open.

### The empty-output retry

`for (let attempt = 0; ; attempt++)` is an intentionally unbounded `for` whose exits are the `return` statements ([runner.ts:113-127](../../server/src/orchestrator/runner.ts#L113-L127)). With `EMPTY_OUTPUT_RETRIES = 1` it runs at most twice. A retry repeats the entire run, including the input guardrail and all model calls. The structured variant has no retry; an empty structured result is handled by the controller as 502.

### Recording a pause

[runner.ts:65-101](../../server/src/orchestrator/runner.ts#L65-L101):

- Only `interruptions[0]` is used for the display fields (tool name, arguments, agent name).
- `result.state.toString()` serializes the **entire** run: conversation, current agent, pending tool calls, and all interruptions. If a turn somehow raised several interruptions at once, they are all inside the state and all get the same decision on resume.
- `interruption.arguments ?? null` normalizes `undefined`, because SQLite parameter binding rejects `undefined`.
- `format` is stored because resume needs to know which root agent started the run.

### Resuming

[runner.ts:167-242](../../server/src/orchestrator/runner.ts#L167-L242), in order:

1. **Load** the record. Missing or not pending returns `not_found`.
2. **Claim it first.** `approvalStore.resolve` is an atomic conditional update. This happens *before* any `await`, so two concurrent decisions cannot both proceed. The loser gets `false` and returns `not_found`.
3. **Pick the root agent** from `record.format`. `RunState.fromString` resolves agent names in the serialized state against the handoff graph reachable from the agent you pass in. A run started by `Orchestrator (Structured)` cannot be restored against `Orchestrator`.
4. **`state.clearTrace()`.** The serialized state remembers its original trace, which was closed when the run paused. Without detaching, the resumed run would try to add spans to an ended trace.
5. **Apply the decision** to every interruption with `state.approve` or `state.reject`. A rejection can carry a message that the model will see.
6. **Run again** inside a new trace named `... (resumed)` with the same `groupId`.
7. **Check for a second pause.** A resumed run can reach another sensitive tool, in which case a new approval is recorded.

The `as any` casts on [runner.ts:197](../../server/src/orchestrator/runner.ts#L197) and [runner.ts:230](../../server/src/orchestrator/runner.ts#L230) bridge the two agent variants' different output types. The comment explains why this is safe: `format` was written by `recordApproval` from the variant that actually ran.

### What is not re-checked on resume

- **Input guardrails** do not run again. The SDK only runs them on turn 1 of a fresh run and skips them when resuming from an interruption (checked against `@openai/agents-core` 0.13.5, `runner/turnPreparation.js`). The original input already passed.
- **The requester's role.** `RunState` serializes the run `context` along with everything else, so the restored run still carries the original requester's `AuthTokenPayload`, and the tool's `denyEmployees` check sees the requester, not the approver. A side effect: the requester's `userId`, `employeeId`, `username`, and `role` are stored inside `approvals.serialized_state`.
- **Output guardrails** do run, because they are on the runner. If one trips, the exception propagates out of `resumeEmployeeAgent` uncaught. See [09](../09-ISSUES-AND-OPEN-QUESTIONS.md#missing-error-handling).

## Inputs, outputs, side effects, dependencies

- **Inputs:** conversation history, session id, `AuthTokenPayload`; or an approval id and decision.
- **Outputs:** `RunOutcome` / `ResumeOutcome`. Guardrail trips and SDK failures are thrown, not returned.
- **Side effects:** OpenAI calls; rows in `approvals`; traces and spans through the processor.
- **Depends on:** [Agents](agents.md), [Guardrails](guardrails.md), [Approvals](approvals.md) store, [Conversation Store](conversation-store.md) types.

## Why it is built this way, and trade-offs

- **A discriminated union for outcomes** (`status: "completed" | "needs_approval"`) makes the controller handle the pause explicitly; TypeScript will not let it read `output` without checking `status`.
- **Exceptions for guardrail trips** follow the SDK's own design. The cost is that every caller needs a try/catch, and the resume path does not have one.
- **Claim before resume** prevents double execution but means a crash mid-resume leaves an approval marked `approved` with no result and no way to retry.
- **State stored as one opaque string** is simple and exactly what the SDK round-trips. It also means stored states are tied to the SDK version and to agent names; renaming an agent would break resuming older approvals.

## Source files covered

- `server/src/orchestrator/runner.ts`
