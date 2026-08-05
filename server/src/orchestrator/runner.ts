import { run, user, assistant } from "@openai/agents";
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

// NOTE: despite the name, this no longer exposes the SDK's raw token-level
// stream. It fully generates and guardrail-checks the response server-side,
// then returns the complete, validated text. The controller is responsible
// for replaying it to the client as a simulated SSE stream — see
// chat.controller.ts for why this trade was made deliberately.
export async function runEmployeeAgentStream(
  history: ConversationMessage[],
): Promise<string> {
  const input = toInput(history);
  const result = await run(orchestratorAgent, input, {
    outputGuardrails: OUTPUT_GUARDRAILS,
  } as any);
  return result.finalOutput ?? "";
}

export async function runEmployeeAgentStructured(
  history: ConversationMessage[],
) {
  const input = toInput(history);
  const result = await run(orchestratorAgentStructured, input, {
    outputGuardrails: OUTPUT_GUARDRAILS,
  } as any);
  return result.finalOutput;
}
