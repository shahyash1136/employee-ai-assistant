import { Agent, run, defineOutputGuardrail } from "@openai/agents";
import { z } from "zod";
import type { AgentOutputItem } from "@openai/agents";

// Signals the final answer is asserting specific, checkable facts — the kind
// of claim that should always trace back to a real tool result.
const SPECIFIC_CLAIM_PATTERNS: RegExp[] = [
  /\b[₹$]\s?[\d,]+(\.\d+)?\b/, // currency figures
  /\bE\d{3,}\b/, // employee IDs
  /\bD\d{3,}\b/, // department IDs
  /\b\d{1,3}(\.\d+)?%\b/, // percentages, e.g. attendance %
];

function looksLikeSpecificFactualClaim(text: string): boolean {
  return SPECIFIC_CLAIM_PATTERNS.some((pattern) => pattern.test(text));
}

function extractToolResultText(output: AgentOutputItem[] | undefined): string {
  if (!output) return "";
  return output
    .filter(
      (
        item,
      ): item is Extract<AgentOutputItem, { type: "function_call_result" }> =>
        item.type === "function_call_result",
    )
    .map((item) =>
      typeof item.output === "string"
        ? item.output
        : JSON.stringify(item.output),
    )
    .join("\n---\n");
}

function extractFinalText(agentOutput: unknown): string {
  if (typeof agentOutput === "string") return agentOutput;
  if (agentOutput && typeof agentOutput === "object") {
    // Structured mode: only "summary" is free text worth checking —
    // "employees"/"metrics" are already schema-shaped data pulled from tools.
    const summary = (agentOutput as { summary?: unknown }).summary;
    return typeof summary === "string" ? summary : JSON.stringify(agentOutput);
  }
  return "";
}

const GroundednessCheckOutput = z.object({
  isUngrounded: z.boolean(),
  reason: z.string(),
});

const groundednessClassifierAgent = new Agent({
  name: "Groundedness Classifier",
  instructions: `
You are a fact-checking classifier. You will be shown (1) the RAW TOOL RESULTS
returned during an AI assistant's run, and (2) the FINAL ANSWER the assistant gave
the user.

Determine whether the final answer states any specific fact (a name, an ID, a
number, a date, a percentage, a status) that is NOT actually present in the raw
tool results. If the tool results are empty, ANY specific factual claim in the
final answer is ungrounded.

General phrasing, summaries, or reasonable rewording of data that IS present in
the tool results is fine and should NOT be flagged. Only flag genuinely invented
facts.

Respond with isUngrounded and a one-sentence reason.
`,
  outputType: GroundednessCheckOutput,
});

export const hallucinationGuardrail = defineOutputGuardrail({
  name: "Hallucination Prevention Guardrail",
  execute: async ({ agentOutput, context, details }) => {
    const finalText = extractFinalText(agentOutput);
    const toolResultText = extractToolResultText(details?.output);

    // Fast path: specific facts asserted, but NO tool was called this run at
    // all — the strongest, cheapest signal, no model call needed.
    if (!toolResultText && looksLikeSpecificFactualClaim(finalText)) {
      return {
        outputInfo: {
          reason:
            "Response contains specific factual claims but no tool was called during this run",
          detectionMethod: "no-tool-call",
        },
        tripwireTriggered: true,
      };
    }

    // Slow path: tools WERE called — verify the final answer's claims are
    // actually supported by what those tools returned.
    const result = await run(
      groundednessClassifierAgent,
      `TOOL RESULTS:\n${toolResultText || "(none)"}\n\nFINAL ANSWER:\n${finalText}`,
      { context },
    );
    const output = result.finalOutput;

    return {
      outputInfo: { ...output, detectionMethod: "classifier" },
      tripwireTriggered: output?.isUngrounded ?? false,
    };
  },
});
