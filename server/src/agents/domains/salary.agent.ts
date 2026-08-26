import type { RunContext } from "@openai/agents";
import { salaryTools } from "../../tools/salary.tool.js";
import {
  getEmployeeByIdTool,
  getEmployeeByNameTool,
} from "../../tools/employee.tool.js";
import { getDepartmentByNameTool } from "../../tools/department.tool.js";
import { createDomainAgent } from "../shared/createDomainAgent.js";
import type { AuthTokenPayload } from "../../types/user.js";
import {
  nameResolutionInstructions,
  departmentResolutionInstructions,
  outOfScopeHandoffInstructions,
} from "../shared/instructionFragments.js";

const baseInstructions = `
You are the Salary domain agent. You answer questions about compensation — individual
salaries, highest/average salary company-wide or within a department, and salary range
lookups — using only the tools provided. Never make up data; always call a tool before
answering.

Tool selection:
- For a specific employee's salary, use get_salary_by_employee.
- For the highest salary company-wide, use get_highest_salary.
- For the highest salary WITHIN a specific department, use get_highest_salary_by_department
  instead of get_highest_salary.
- For the average salary across all employees, use get_average_salary.
- For employees within a salary range, use get_employees_by_salary_range.
- If the user explicitly asks to export, download, or generate a report of salary
  data, use export_salary_report.
${nameResolutionInstructions}
${departmentResolutionInstructions}
${outOfScopeHandoffInstructions}
General:
- If a tool returns no results or an error, say so plainly instead of guessing.
`;

// Injects the authenticated user's identity into the system prompt, since the
// `context` object passed to run() is only visible inside tool execute()
// functions by default — the model has no way to know who "my"/"me" refers
// to unless it's told explicitly here.
function buildInstructions(runContext: RunContext<AuthTokenPayload>): string {
  const user = runContext.context;
  const identityNote = user
    ? `\nThe current authenticated user's employee ID is ${user.employeeId} (role: ${user.role}). ` +
      `When they refer to "my", "me", or "I" (e.g. "what's my salary"), use employee ID ` +
      `${user.employeeId} directly for the relevant tool call — do not ask them for their ID.\n`
    : "";
  return baseInstructions + identityNote;
}

export const { agent: salaryAgent, structuredAgent: salaryAgentStructured } =
  createDomainAgent<AuthTokenPayload>({
    name: "Salary Agent",
    instructions: buildInstructions,
    tools: [
      ...salaryTools,
      getEmployeeByIdTool,
      getEmployeeByNameTool,
      getDepartmentByNameTool,
    ],
  });
