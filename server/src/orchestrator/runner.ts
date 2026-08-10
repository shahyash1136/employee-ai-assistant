import { Runner, user, assistant, withTrace } from "@openai/agents";
import {
  orchestratorAgent,
  orchestratorAgentStructured,
} from "../agents/orchestrator.agent.js";
import { sensitiveInfoGuardrail } from "../guardrails/sensitiveInfo.guardrail.js";
import { hallucinationGuardrail } from "../guardrails/hallucination.guardrail.js";
import type { ConversationMessage } from "../conversation/types.js";

function toInput(history: ConversationMessage[]) {
  return history.map((item) =>
    item.role === "assistant" ? assistant(item.content) : user(item.content),
  );
}

const OUTPUT_GUARDRAILS = [sensitiveInfoGuardrail, hallucinationGuardrail];

// A plain run(agent, input, { outputGuardrails }) silently drops that option:
// the free run() function executes against a shared default Runner singleton
// whose guardrail config is frozen (empty) at first construction, so per-call
// outputGuardrails never actually run (verified by reading the SDK's
// run.js and reproducing it — only the Input Safety Guardrail attached
// directly to the agents was ever firing). A Runner instance carrying the
// guardrails here is concatenated with whichever agent ends up producing the
// final output, so it applies regardless of which specialist the orchestrator
// hands off to.
const runner = new Runner({ outputGuardrails: OUTPUT_GUARDRAILS });

// NOTE: despite the name, this no longer exposes the SDK's raw token-level
// stream. It fully generates and guardrail-checks the response server-side,
// then returns the complete, validated text. The controller is responsible
// for replaying it to the client as a simulated SSE stream — see
// chat.controller.ts for why this trade was made deliberately.
export async function runEmployeeAgentStream(
  history: ConversationMessage[],
  sessionId: string,
): Promise<string> {
  const input = toInput(history);
  // groupId/workflowName must be set via withTrace, not run()'s per-call
  // options: Runner.run() reads trace config only from what the Runner was
  // constructed with, so options passed here are silently ignored. run()'s
  // internal getOrCreateTrace() picks up and reuses the trace started by
  // withTrace instead of starting its own.
  return withTrace(
    "Employee Agent Stream",
    async (trace) => {
      // withTrace's own SDK-internal cleanup only calls trace.end() on the
      // success path — if the callback throws (e.g. a guardrail tripwire),
      // agents-core's _wrapFunctionWithTraceLifecycle skips trace.end()
      // entirely, leaving the trace open forever in any processor that
      // tracks trace state (confirmed by reading that function and by a live
      // repro: a declined request left endedAt stuck at null in traceStore).
      // Closing it ourselves guarantees it always ends; Trace.end() is
      // idempotent, so the SDK's own redundant call on the success path is a
      // harmless no-op.
      try {
        const result = await runner.run(orchestratorAgent, input);
        return result.finalOutput ?? "";
      } finally {
        await trace.end();
      }
    },
    { groupId: sessionId },
  );
}

export async function runEmployeeAgentStructured(
  history: ConversationMessage[],
  sessionId: string,
) {
  const input = toInput(history);
  return withTrace(
    "Employee Agent Structured",
    async (trace) => {
      try {
        const result = await runner.run(orchestratorAgentStructured, input);
        return result.finalOutput;
      } finally {
        await trace.end();
      }
    },
    { groupId: sessionId },
  );
}
