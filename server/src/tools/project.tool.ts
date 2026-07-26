import { tool } from "@openai/agents";
import { z } from "zod";
import { projectServices } from "../services/project.service.js";

export const getProjectsTool = tool({
  name: "get_projects",
  description: "Returns all projects from the projects CSV file.",
  parameters: z.object({}),
  execute: async function () {
    const projects = await projectServices.getProjects();
    return JSON.stringify(projects);
  },
});

export const getProjectsByEmployeeTool = tool({
  name: "get_projects_by_employee",
  description: "Returns all projects for a given employee ID. (e.g. E001).",
  parameters: z.object({
    employeeId: z.string().describe("The employee ID to look up, e.g. 'E001'"),
  }),
  execute: async function ({ employeeId }: { employeeId: string }) {
    const projects = await projectServices.getProjectsByEmployee(employeeId);
    return JSON.stringify(projects);
  },
});

export const projectTools = [getProjectsTool, getProjectsByEmployeeTool];
