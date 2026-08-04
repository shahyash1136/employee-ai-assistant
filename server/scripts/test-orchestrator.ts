import "dotenv/config";
import { run, user } from "@openai/agents";
import { orchestratorAgent } from "../src/agents/orchestrator.agent.js";

const scenarios = [
  "Who has the highest salary in the company?",
  "Show me details",
  "What's Priya's salary?",
];

for (const message of scenarios) {
  console.log(`\n=== "${message}" ===`);
  const result = await run(orchestratorAgent, [user(message)]);
  console.log("Final agent:", result.lastAgent?.name);
  console.log("Output:", result.finalOutput);
}
