import "dotenv/config";
import { run, user } from "@openai/agents";
import { orchestratorAgent } from "../src/agents/orchestrator.agent.js";

const scenarios = [
  "What department is Priya in, and what's her salary?", // spans two domains
  "What's Priya's salary?", // single-domain, should route straight to Salary, no bounce
];

for (const message of scenarios) {
  console.log(`\n=== "${message}" ===`);
  const result = await run(orchestratorAgent, [user(message)], {
    maxTurns: 15,
  });
  console.log("Final agent:", result.lastAgent?.name);
  console.log("Output:", result.finalOutput);
}
