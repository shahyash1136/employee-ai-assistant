import { performanceTools } from "../../tools/performance.tool.js";
import {
  getEmployeeByIdTool,
  getEmployeeByNameTool,
} from "../../tools/employee.tool.js";
import { createDomainAgent } from "../shared/createDomainAgent.js";
import {
  nameResolutionInstructions,
  outOfScopeHandoffInstructions,
} from "../shared/instructionFragments.js";

const instructions = `
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

export const {
  agent: performanceAgent,
  structuredAgent: performanceAgentStructured,
} = createDomainAgent({
  name: "Performance Agent",
  instructions,
  tools: [...performanceTools, getEmployeeByIdTool, getEmployeeByNameTool],
});
