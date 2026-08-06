import { tool } from "@openai/agents";
import { z } from "zod";
import { projectServices } from "../services/project.service.js";
import { safeToolExecute } from "../utils/safeToolExecute.js";
import { employeeIdGuardrail } from "../guardrails/toolMisuse.guardrail.js";

export const getProjectsTool = tool({
  name: "get_projects",
  description: "Returns all projects from the projects CSV file.",
  parameters: z.object({}),
  execute: safeToolExecute("get_projects", async () => {
    const projects = await projectServices.getProjects();
    return JSON.stringify(projects);
  }),
});

export const getProjectsByEmployeeTool = tool({
  name: "get_projects_by_employee",
  description: "Returns all projects for a given employee ID. (e.g. E001).",
  parameters: z.object({
    employeeId: z.string().describe("The employee ID to look up, e.g. 'E001'"),
  }),
  inputGuardrails: [employeeIdGuardrail],
  execute: safeToolExecute(
    "get_projects_by_employee",
    async ({ employeeId }: { employeeId: string }) => {
      const projects = await projectServices.getProjectsByEmployee(employeeId);
      if (projects.length === 0) {
        return JSON.stringify({
          error: `No projects found for employee ID ${employeeId}`,
        });
      }
      return JSON.stringify(projects);
    },
  ),
});

export const projectTools = [getProjectsTool, getProjectsByEmployeeTool];
