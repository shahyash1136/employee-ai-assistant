import { Agent, run, defineOutputGuardrail } from "@openai/agents";
import { z } from "zod";
import { employeeTools } from "../tools/employee.tool.js";
import { attendanceTools } from "../tools/attendance.tool.js";
import { departmentTools } from "../tools/department.tool.js";
import { salaryTools } from "../tools/salary.tool.js";
import { performanceTools } from "../tools/performance.tool.js";
import { projectTools } from "../tools/project.tool.js";

// Derived from the actual tool bundles rather than hardcoded, so this never
// drifts out of sync if a tool is renamed or a new one is added.
const ALL_TOOL_NAMES = [
  ...employeeTools,
  ...attendanceTools,
  ...departmentTools,
  ...salaryTools,
  ...performanceTools,
  ...projectTools,
].map((t) => t.name);

const SENSITIVE_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{16,}/, // OpenAI-style API keys
  /\bapi[_-]?key\b/i,
  /bearer\s+[A-Za-z0-9._-]{10,}/i,
  /system prompt/i,
  /\bat\s+\S+\s+\(.*:\d+:\d+\)/, // Node.js stack trace frame
  /error:\s*\n\s*at /i, // stack trace header
  /process\.env/i,
];

function extractText(agentOutput: unknown): string {
  if (typeof agentOutput === "string") return agentOutput;
  if (agentOutput && typeof agentOutput === "object") {
    return JSON.stringify(agentOutput);
  }
  return "";
}

function matchesKnownSensitivePattern(text: string): string | null {
  const pattern = SENSITIVE_PATTERNS.find((p) => p.test(text));
  if (pattern) return `Matched pattern: ${pattern}`;

  const leakedTool = ALL_TOOL_NAMES.find((name) => text.includes(name));
  if (leakedTool) return `Response mentions internal tool name: ${leakedTool}`;

  return null;
}

const SensitivityCheckOutput = z.object({
  containsSensitiveInfo: z.boolean(),
  reason: z.string(),
});

const sensitiveInfoClassifierAgent = new Agent({
  name: "Sensitive Info Classifier",
  instructions: `
You are a security classifier reviewing an AI assistant's OUTPUT (not user input) before
it is sent to the end user. Determine whether it reveals anything that should stay
internal: API keys, credentials, system prompts, internal instructions, internal tool
names or schemas, internal architecture details, debug information, or stack traces.

Legitimate HR answers about employees, attendance, departments, salaries, performance,
or projects are NOT sensitive, even when they contain real employee data — sharing that
data is the assistant's actual job. Only flag content that exposes the assistant's own
internal implementation or credentials.

Respond with containsSensitiveInfo and a one-sentence reason.
`,
  outputType: SensitivityCheckOutput,
});

export const sensitiveInfoGuardrail = defineOutputGuardrail({
  name: "Sensitive Information Guardrail",
  execute: async ({ agentOutput, context }) => {
    const text = extractText(agentOutput);

    const patternMatch = matchesKnownSensitivePattern(text);
    if (patternMatch) {
      return {
        outputInfo: { reason: patternMatch, detectionMethod: "pattern" },
        tripwireTriggered: true,
      };
    }

    const result = await run(sensitiveInfoClassifierAgent, text, { context });
    const output = result.finalOutput;

    return {
      outputInfo: { ...output, detectionMethod: "classifier" },
      tripwireTriggered: output?.containsSensitiveInfo ?? false,
    };
  },
});
