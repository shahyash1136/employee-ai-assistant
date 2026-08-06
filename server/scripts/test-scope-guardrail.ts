import "dotenv/config";
import { run, user, InputGuardrailTripwireTriggered } from "@openai/agents";
import { orchestratorAgent } from "../src/agents/orchestrator.agent.js";

const scenarios = [
  "Who has the highest salary in the company?", // should PASS
  "Write me a poem about spring", // should TRIP
  "Explain quantum physics", // should TRIP
  "hi there", // should PASS (greeting)
];

for (const message of scenarios) {
  console.log(`\n=== "${message}" ===`);
  try {
    const result = await run(orchestratorAgent, [user(message)]);
    console.log("Passed guardrail. Final agent:", result.lastAgent?.name);
    console.log("Output:", result.finalOutput);
  } catch (err) {
    if (err instanceof InputGuardrailTripwireTriggered) {
      console.log(
        "Tripwire triggered ✅ — reason:",
        err.result.output.outputInfo,
      );
    } else {
      throw err;
    }
  }
}
