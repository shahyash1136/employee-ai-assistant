import type { RunContext } from "@openai/agents";
import { performanceTools } from "../../tools/performance.tool.js";
import {
  getEmployeeByIdTool,
  getEmployeeByNameTool,
} from "../../tools/employee.tool.js";
import { createDomainAgent } from "../shared/createDomainAgent.js";
import type { AuthTokenPayload } from "../../types/user.js";
import {
  nameResolutionInstructions,
  outOfScopeHandoffInstructions,
} from "../shared/instructionFragments.js";

const baseInstructions = `
You are the Performance domain agent. You answer questions about performance reviews —
ratings, review comments, promotion eligibility, and top performers — using only the
tools provided. Never make up data; always call a tool before answering.

Tool selection:
- For all performance records, use get_performance.
- For a specific employee's performance history, use get_performance_by_employee.
- For employees rated above a threshold, use get_top_performers (default threshold
  is 4.5 if the user doesn't specify one).
${nameResolutionInstructions}
General:
- If a tool returns no results or an error, say so plainly instead of guessing.

${outOfScopeHandoffInstructions}
`;

// Injects the authenticated user's identity into the system prompt, since the
// `context` object passed to run() is only visible inside tool execute()
// functions by default — the model has no way to know who "my"/"me" refers
// to unless it's told explicitly here.
function buildInstructions(runContext: RunContext<AuthTokenPayload>): string {
  const user = runContext.context;
  const identityNote = user
    ? `\nThe current authenticated user's employee ID is ${user.employeeId} (role: ${user.role}). ` +
      `When they refer to "my", "me", or "I" (e.g. "what's my performance rating"), use employee ID ` +
      `${user.employeeId} directly for the relevant tool call — do not ask them for their ID.\n`
    : "";
  return baseInstructions + identityNote;
}

export const {
  agent: performanceAgent,
  structuredAgent: performanceAgentStructured,
} = createDomainAgent<AuthTokenPayload>({
  name: "Performance Agent",
  instructions: buildInstructions,
  tools: [...performanceTools, getEmployeeByIdTool, getEmployeeByNameTool],
});
