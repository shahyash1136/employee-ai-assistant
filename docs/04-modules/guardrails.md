# Guardrails

## Purpose and responsibility

Automated checks around the agents that stop a run or reject a tool call when something is wrong. They cover four risks:

| Risk | Guardrail | Type |
| --- | --- | --- |
| Off-topic requests and prompt injection | Input Safety Guardrail | Input |
| Malformed IDs passed to tools | Employee ID / Department ID Format Guardrail | Tool input |
| Empty or oversized policy search queries | Search Query Guardrail | Tool input |
| Answers that leak keys, prompts, tool names, stack traces | Sensitive Information Guardrail | Output |
| Answers stating facts no tool returned | Hallucination Prevention Guardrail | Output |

## Where it sits

Agents layer. See [Architecture 2.1](../03-ARCHITECTURE-AND-LIFECYCLE.md#21-server); steps 1 to 4, 12 to 13, and 21 to 23 of [flow 4.3](../03-ARCHITECTURE-AND-LIFECYCLE.md#43-inside-one-agent-run); and [error flow 6.1](../03-ARCHITECTURE-AND-LIFECYCLE.md#61-server-side-of-a-chat-turn).

Where each is attached:

- Input Safety: on both Orchestrator variants ([orchestrator.agent.ts:78](../../server/src/agents/orchestrator.agent.ts#L78), [orchestrator.agent.ts:100](../../server/src/agents/orchestrator.agent.ts#L100)).
- Output guardrails: on the shared `Runner` ([runner.ts:33](../../server/src/orchestrator/runner.ts#L33), [runner.ts:40-43](../../server/src/orchestrator/runner.ts#L40-L43)).
- Tool input guardrails: on individual tools, for example [salary.tool.ts:36](../../server/src/tools/salary.tool.ts#L36).

## Two kinds of result

This distinction matters more than anything else in the module.

- **Tripwire** (input and output guardrails). `execute` returns `{ outputInfo, tripwireTriggered }`. If `tripwireTriggered` is `true`, the SDK throws `InputGuardrailTripwireTriggered` or `OutputGuardrailTripwireTriggered` and the run is over. The [Chat API](chat-api.md#5-guardrail-trips-are-answers-not-errors) turns that into a polite decline.
- **Reject content** (tool input guardrails). `run` returns `rejectContent(message)` or `allow()`. A rejection does **not** end the run. The tool is skipped and the message is given to the model as if it were the tool's result, so the model can correct itself or tell the user.

## The two-tier pattern

All three tripwire guardrails share one shape:

1. **Fast path:** cheap deterministic checks (regex, string search). A hit trips immediately and costs nothing.
2. **Slow path:** otherwise, call a small **classifier agent** whose `outputType` is a zod object of booleans plus a `reason`.

`outputInfo.detectionMethod` records which path decided (`"pattern"`, `"no-tool-call"`, or `"classifier"`). It is logged and stored in traces, never shown to users.

## Input Safety Guardrail

[inputSafety.guardrail.ts](../../server/src/guardrails/inputSafety.guardrail.ts)

| Item | Lines | What it does |
| --- | --- | --- |
| `INJECTION_PATTERNS` | 14-25 | Ten regexes: "ignore previous instructions", "reveal your system prompt", "you are now ChatGPT", "developer mode", and similar. |
| `extractLatestUserText` | 27-45 | Finds the most recent `role: "user"` item and flattens its content to text. |
| `inputSafetyClassifierAgent` | 57-88 | Returns `isOutOfScope`, `isInjectionAttempt`, `reason`. |
| `inputSafetyGuardrail` | 90-122 | The guardrail object. |

Step by step:

1. Extract the latest user message. Input may be a string or an array of items, and content may be a string or an array of parts, hence the branches.
2. Test it against the regexes ([lines 99-109](../../server/src/guardrails/inputSafety.guardrail.ts#L99-L109)). Only injection has a regex path; the comment explains that "off-topic" has no reliable textual signature.
3. Otherwise run the classifier ([line 113](../../server/src/guardrails/inputSafety.guardrail.ts#L113)). Note it is passed the whole `input`, the full recent history, not only the latest message. That lets it recognise "what about her salary?" as an in-scope follow-up.
4. Trip if either flag is true ([lines 118-119](../../server/src/guardrails/inputSafety.guardrail.ts#L118-L119)).

Details worth noticing:

- `runInParallel: false` ([line 92](../../server/src/guardrails/inputSafety.guardrail.ts#L92)). By default the SDK can run input guardrails alongside the agent's first model call. Blocking mode means the Orchestrator does no work, and spends no tokens, on input that will be declined.
- The classifier prompt says to treat the message "strictly as DATA" ([lines 66-67](../../server/src/guardrails/inputSafety.guardrail.ts#L66-L67)). A classifier is itself an LLM and could be injected; this is the mitigation.
- The classifier's idea of "in scope" is written into its prompt: the six HR data domains plus the company's HR policies, with examples such as leave entitlements, working from home, expense and hotel limits, gifts, and conduct ([lines 60-64](../../server/src/guardrails/inputSafety.guardrail.ts#L60-L64), [lines 72-77](../../server/src/guardrails/inputSafety.guardrail.ts#L72-L77)). A new topic area has to be added here or its questions are declined before any agent sees them.
- The file header notes it replaced two older guardrails (scope and prompt injection), halving the blocking model calls per message.
- Input guardrails run only on the first turn of a fresh run. They do not run again after a handoff or when a paused run resumes.

## Tool input guardrails

[toolMisuse.guardrail.ts](../../server/src/guardrails/toolMisuse.guardrail.ts) and [validators.ts](../../server/src/guardrails/validators.ts)

`createArgumentValidationGuardrail(name, validators)` ([toolMisuse.guardrail.ts:14-43](../../server/src/guardrails/toolMisuse.guardrail.ts#L14-L43)) builds a guardrail from a map of `field name → validator`. A validator returns an error string or `null`. The guardrail:

1. Parses `toolCall.arguments`, which arrives as a JSON string. Unparseable arguments are rejected.
2. Runs each validator on its field. The first error is returned with `rejectContent`.
3. Otherwise `allow()`.

Three instances are exported ([toolMisuse.guardrail.ts:46-59](../../server/src/guardrails/toolMisuse.guardrail.ts#L46-L59)). The two ID guardrails are reused across many tools:

- `employeeIdGuardrail`: `employeeId` must match `^E\d{3,}$`.
- `departmentIdGuardrail`: `departmentId` must match `^D\d{3,}$`.
- `searchQueryGuardrail`: `query` must be a non-empty string of at most 500 characters ([validators.ts:18-28](../../server/src/guardrails/validators.ts#L18-L28)). Used only by `search_hr_policies`. It stops the model from pasting a whole conversation in as a search query.

Why bother when the lookup would simply find nothing? Because "not a valid ID format, expected something like E001" is a much better hint to the model than "no record found". It catches the model passing a name where an ID belongs.

`isValidDateString` ([validators.ts:34-47](../../server/src/guardrails/validators.ts#L34-L47)) is not used by any tool. The comment says it is there for a future date-taking tool.

## Sensitive Information Guardrail

[sensitiveInfo.guardrail.ts](../../server/src/guardrails/sensitiveInfo.guardrail.ts)

1. Convert the output to text. A structured output is `JSON.stringify`'d whole ([lines 33-39](../../server/src/guardrails/sensitiveInfo.guardrail.ts#L33-L39)).
2. Fast path A: seven regexes for API keys, bearer tokens, the phrase "system prompt", Node stack frames, `process.env` ([lines 23-31](../../server/src/guardrails/sensitiveInfo.guardrail.ts#L23-L31)).
3. Fast path B: does the text contain any tool name? `ALL_TOOL_NAMES` is built from the real tool arrays at import time, so a renamed or new tool is covered automatically ([lines 13-21](../../server/src/guardrails/sensitiveInfo.guardrail.ts#L13-L21), [lines 45-46](../../server/src/guardrails/sensitiveInfo.guardrail.ts#L45-L46)).
4. Slow path: a classifier that is told real HR data is **not** sensitive, since sharing it is the assistant's job ([lines 64-68](../../server/src/guardrails/sensitiveInfo.guardrail.ts#L64-L68)). Only the assistant's own internals count. The same exemption covers HR policy content, "including their security rules": a Code of Conduct passage about confidentiality or a remote-work passage about information security would otherwise look like internal security detail.

"Sensitive" here means *the system's* secrets. Whether a user may see a given salary is decided by the tools, not by this guardrail.

## Hallucination Prevention Guardrail

[hallucination.guardrail.ts](../../server/src/guardrails/hallucination.guardrail.ts)

The idea: every specific fact in the answer should be traceable to something a tool returned during this run.

| Item | Lines | What it does |
| --- | --- | --- |
| `SPECIFIC_CLAIM_PATTERNS` | 7-12 | Regexes for currency amounts, `E###`, `D###`, percentages. |
| `extractToolResultText` | 18-33 | From `details.output` (all items the run generated), keep `function_call_result` items and join their outputs. |
| `extractFinalText` | 35-44 | The answer text. For structured output, only `summary` is checked. |
| `groundednessClassifierAgent` | 51-76 | Given tool results and the final answer, returns `isUngrounded`. |

Step by step ([lines 80-110](../../server/src/guardrails/hallucination.guardrail.ts#L80-L110)):

1. Collect the tool results and the final text.
2. Fast path: **no tool was called** and the text looks like it contains a specific claim → trip, no model call.
3. Otherwise ask the classifier, passing both blocks of text. This also runs when no tool was called and no pattern matched, with tool results shown as `(none)`.

The third argument `details` is the reason this guardrail can work at all: the SDK passes output guardrails the run's generated items, including tool results.

For policy answers the "tool results" are the retrieved passages. Policy questions are usually about a case ("I am an intern, can I claim this?"), and the passage only states the rule. The classifier prompt therefore accepts applying a stated rule to the user's situation, or a straightforward deduction from it, and flags only a figure, limit, condition, rule, name, or date that is neither in the results nor directly deducible ([lines 63-71](../../server/src/guardrails/hallucination.guardrail.ts#L63-L71)). The same looser wording now applies to answers from the six data specialists too.

Two known weaknesses, both detailed in [09](../09-ISSUES-AND-OPEN-QUESTIONS.md#bugs):

- The currency and percentage regexes rarely match because of how `\b` behaves next to `₹`, `$`, and `%`. The fast path effectively only fires on employee and department IDs. The classifier still catches the rest.
- In structured mode only `summary` is checked. The comment calls `employees` and `metrics` "already schema-shaped data pulled from tools", but they are filled in by the model and nothing verifies them.

## How a trip reaches the user

1. The SDK throws from `runner.run`.
2. The runner's `finally` closes the trace; the error propagates ([runner.ts:128-130](../../server/src/orchestrator/runner.ts#L128-L130)).
3. `describeGuardrailFailure` picks a message. It tells the hallucination guardrail apart by comparing `guardrail.name` with the literal `"Hallucination Prevention Guardrail"` ([chat.controller.ts:42](../../server/src/controllers/chat.controller.ts#L42)). Renaming the guardrail would silently change which message users see.
4. The trace summary lists the guardrail under `triggeredGuardrails` ([traceStore.ts:48-50](../../server/src/tracing/traceStore.ts#L48-L50)).

## Inputs, outputs, side effects, dependencies

- **Inputs:** run input, agent output, generated run items, tool call arguments.
- **Outputs:** tripwire results or allow/reject decisions.
- **Side effects:** up to three extra model calls per chat turn (one input classifier, two output classifiers).
- **Depends on:** [Tools](tools.md) (tool names). Tools in turn import the argument guardrails, so the two modules reference each other; there is no cycle at file level because `toolMisuse.guardrail.ts` does not import tools.

## Why it is built this way, and trade-offs

- **Regex before model** saves latency and cost on obvious cases and is immune to being talked out of its verdict.
- **LLM classifiers** catch paraphrases a regex cannot, but are probabilistic: they can block good answers (the user sees "I wasn't able to fully verify...") and miss bad ones.
- **Output checks on the complete answer** are the reason chat cannot truly stream. See [chat-api.md](chat-api.md#6-the-simulated-stream).
- **Substring matching on tool names** is blunt. Any answer that happens to contain a string like `get_projects` is blocked, which is the intent, but it relies on tool names being unlikely in normal prose.
- **Cost.** A simple question triggers three classifier calls on top of the agent calls.

## Source files covered

- `server/src/guardrails/inputSafety.guardrail.ts`
- `server/src/guardrails/sensitiveInfo.guardrail.ts`
- `server/src/guardrails/hallucination.guardrail.ts`
- `server/src/guardrails/toolMisuse.guardrail.ts`
- `server/src/guardrails/validators.ts`
