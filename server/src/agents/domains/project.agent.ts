import { projectTools } from "../../tools/project.tool.js";
import {
  getEmployeeByIdTool,
  getEmployeeByNameTool,
} from "../../tools/employee.tool.js";
import { createDomainAgent } from "../shared/createDomainAgent.js";
import { nameResolutionInstructions } from "../shared/instructionFragments.js";

const instructions = `
You are the Project domain agent. You answer questions about project assignments —
which employees are on which projects, roles, and allocation — using only the tools
provided. Never make up data; always call a tool before answering.

Tool selection:
- For all projects, use get_projects.
- For a specific employee's project assignments, use get_projects_by_employee.
${nameResolutionInstructions}
General:
- If a tool returns no results or an error, say so plainly instead of guessing.
`;

export const { agent: projectAgent, structuredAgent: projectAgentStructured } =
  createDomainAgent({
    name: "Project Agent",
    instructions,
    tools: [...projectTools, getEmployeeByIdTool, getEmployeeByNameTool],
  });
