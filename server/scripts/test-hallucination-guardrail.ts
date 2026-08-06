import "dotenv/config";
import { run, user, OutputGuardrailTripwireTriggered } from "@openai/agents";
import { orchestratorAgentStructured } from "../src/agents/orchestrator.agent.js";
import { hallucinationGuardrail } from "../src/guardrails/hallucination.guardrail.js";

const scenarios = [
  "What's E001's salary?", // should PASS — real tool call, real data
  "What's the salary for E999?", // employee doesn't exist — tool returns an error; answer should say "not found," not invent a number
];

for (const message of scenarios) {
  console.log(`\n=== "${message}" ===`);
  try {
    const result = await run(orchestratorAgentStructured, [user(message)], {
      outputGuardrails: [hallucinationGuardrail],
    } as any);
    console.log("Passed. Output:", result.finalOutput);
  } catch (err) {
    if (err instanceof OutputGuardrailTripwireTriggered) {
      console.log("Tripped:", err.result.output.outputInfo);
    } else {
      throw err;
    }
  }
}
