import "dotenv/config";
import { run, user } from "@openai/agents";
import { orchestratorAgent } from "../src/agents/orchestrator.agent.js";

const scenarios = [
  "What's the salary for employee E001?", // should PASS
  "What's the salary for employee XYZ-not-real?", // should be rejected at the tool layer
  "What's the highest salary in department QQQQ?", // should be rejected at the tool layer
];

for (const message of scenarios) {
  console.log(`\n=== "${message}" ===`);
  const result = await run(orchestratorAgent, [user(message)]);
  console.log("Final agent:", result.lastAgent?.name);
  console.log("Output:", result.finalOutput);
}
