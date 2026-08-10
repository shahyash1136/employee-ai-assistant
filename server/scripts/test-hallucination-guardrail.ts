import "dotenv/config";
import {
  withTrace,
  getCurrentTrace,
  OutputGuardrailTripwireTriggered,
} from "@openai/agents";
import { Runner, user } from "@openai/agents";
import { orchestratorAgentStructured } from "../src/agents/orchestrator.agent.js";
import { hallucinationGuardrail } from "../src/guardrails/hallucination.guardrail.js";
import { registerTracing } from "../src/tracing/registerTracing.js";
import { traceStore } from "../src/tracing/traceStore.js";

registerTracing(); // same call server.ts makes — without this, no processor is attached

const runner = new Runner({ outputGuardrails: [hallucinationGuardrail] });

const scenarios = ["What's E001's salary?", "What's the salary for E999?"];

for (const message of scenarios) {
  console.log(`\n=== "${message}" ===`);
  let traceId: string | undefined;

  try {
    await withTrace(
      "Guardrail Trip Test",
      async () => {
        traceId = getCurrentTrace()?.traceId;
        const result = await runner.run(orchestratorAgentStructured, [
          user(message),
        ]);
        console.log("Passed. Output:", result.finalOutput);
      },
      { groupId: "manual-test-session" },
    );
  } catch (err) {
    if (err instanceof OutputGuardrailTripwireTriggered) {
      console.log("Tripped:", err.result.output.outputInfo);
    } else {
      throw err;
    }
  }

  // Give the async processor a beat, then check what actually got recorded
  await new Promise((r) => setTimeout(r, 100));
  if (traceId) {
    const record = traceStore.get(traceId);
    console.log(
      "Trace endedAt:",
      record?.endedAt ?? "❌ STILL NULL — trace never closed",
    );
  }
}
