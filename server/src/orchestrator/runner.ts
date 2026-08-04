import { run, user, assistant } from "@openai/agents";
import {
  orchestratorAgent,
  orchestratorAgentStructured,
} from "../agents/orchestrator.agent.js";
import type { ConversationMessage } from "../conversation/types.js";

function toInput(history: ConversationMessage[]) {
  return history.map((item) =>
    item.role === "assistant" ? assistant(item.content) : user(item.content),
  );
}

// Streaming, plain-text mode. Function name kept as-is for the controller's
// sake — under the hood this now enters through the multi-agent Orchestrator,
// which may hand off to any of the six specialist agents mid-run.
export async function runEmployeeAgentStream(history: ConversationMessage[]) {
  const input = toInput(history);
  return run(orchestratorAgent, input, { stream: true });
}

// Structured JSON mode — buffered, no SSE. Same handoff behavior as above,
// but the entry point (and every specialist it can hand off to) is the
// structured variant, so the final output always matches StructuredResponseSchema
// regardless of which agent actually answers.
export async function runEmployeeAgentStructured(
  history: ConversationMessage[],
) {
  const input = toInput(history);
  const result = await run(orchestratorAgentStructured, input);
  return result.finalOutput;
}
