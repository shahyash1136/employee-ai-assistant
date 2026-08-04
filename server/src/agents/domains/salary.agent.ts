import { salaryTools } from "../../tools/salary.tool.js";
import {
  getEmployeeByIdTool,
  getEmployeeByNameTool,
} from "../../tools/employee.tool.js";
import { getDepartmentByNameTool } from "../../tools/department.tool.js";
import { createDomainAgent } from "../shared/createDomainAgent.js";
import {
  nameResolutionInstructions,
  departmentResolutionInstructions,
} from "../shared/instructionFragments.js";

const instructions = `
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
${nameResolutionInstructions}
${departmentResolutionInstructions}
General:
- If a tool returns no results or an error, say so plainly instead of guessing.
`;

export const { agent: salaryAgent, structuredAgent: salaryAgentStructured } =
  createDomainAgent({
    name: "Salary Agent",
    instructions,
    tools: [
      ...salaryTools,
      getEmployeeByIdTool,
      getEmployeeByNameTool,
      getDepartmentByNameTool,
    ],
  });
