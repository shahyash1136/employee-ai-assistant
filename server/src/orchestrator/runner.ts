import { run } from "@openai/agents";
import { employeeAgent } from "../agents/employee.agent.js";

export async function runEmployeeAgent(message: string) {
  const result = await run(employeeAgent, message);
  return result.finalOutput;
}
