import { run, user, assistant } from "@openai/agents";
import {
  employeeAgent,
  employeeAgentStructured,
} from "../agents/employee.agent.js";
import type { ConversationMessage } from "../conversation/types.js";

function toInput(history: ConversationMessage[]) {
  return history.map((item) =>
    item.role === "assistant" ? assistant(item.content) : user(item.content),
  );
}

// Streaming, plain-text mode (unchanged behavior — used by SSE controller path).
export async function runEmployeeAgentStream(history: ConversationMessage[]) {
  const input = toInput(history);
  return run(employeeAgent, input, { stream: true });
}

// Structured JSON mode — buffered, no SSE.
export async function runEmployeeAgentStructured(
  history: ConversationMessage[],
) {
  const input = toInput(history);
  const result = await run(employeeAgentStructured, input);
  return result.finalOutput; // already parsed + validated against StructuredResponseSchema
}
