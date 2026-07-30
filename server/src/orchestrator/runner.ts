import { run, user, assistant } from "@openai/agents";
import { employeeAgent } from "../agents/employee.agent.js";
import type { ConversationMessage } from "../conversation/types.js";

export async function runEmployeeAgent(history: ConversationMessage[]) {
  const input = history.map((item) =>
    item.role === "assistant" ? assistant(item.content) : user(item.content),
  );

  const result = await run(employeeAgent, input, { stream: true });
  return result;
}
