import { Agent, run, type InputGuardrail } from "@openai/agents";
import { z } from "zod";

const ScopeCheckOutput = z.object({
  isOutOfScope: z.boolean(),
  reason: z.string(),
});

const scopeClassifierAgent = new Agent({
  name: "Scope Classifier",
  instructions: `
You are a strict scope classifier for an Employee AI Assistant. This assistant ONLY
answers questions about company HR data: employees, attendance, departments, salaries,
performance, and projects.

Classify the user's latest message as out of scope if it asks for anything else —
general knowledge, creative writing (poems, stories, jokes), coding help unrelated to
this HR system, current events, sports scores, or any topic that has nothing to do with
this company's HR data.

A greeting ("hi", "hello") or a reasonable follow-up within an ongoing HR conversation
is NOT out of scope.

Respond with isOutOfScope and a one-sentence reason.
`,
  outputType: ScopeCheckOutput,
});

export const scopeGuardrail: InputGuardrail = {
  name: "Scope Guardrail",
  // Blocking, not parallel: this must finish BEFORE the Orchestrator (or any
  // specialist) starts generating anything, so no partial output can ever
  // leak out ahead of an out-of-scope request being rejected.
  runInParallel: false,
  execute: async ({ input, context }) => {
    const result = await run(scopeClassifierAgent, input, { context });
    const output = result.finalOutput;

    return {
      outputInfo: output,
      tripwireTriggered: output?.isOutOfScope ?? false,
    };
  },
};
