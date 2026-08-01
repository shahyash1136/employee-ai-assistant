import { tool } from "@openai/agents";
import { z } from "zod";
import { departmentService } from "../services/department.service.js";
import { safeToolExecute } from "../utils/safeToolExecute.js";

export const getDepartmentsTool = tool({
  name: "get_departments",
  description: "Returns all the departments from the department CSV file",
  parameters: z.object({}),
  execute: safeToolExecute("get_departments", async () => {
    const departments = await departmentService.getDepartment();
    return JSON.stringify(departments);
  }),
});

export const getDepartmentByIdTool = tool({
  name: "get_department_by_id",
  description:
    "Returns a single department matching to the given department ID (e.g. D001)",
  parameters: z.object({
    departmentId: z
      .string()
      .describe("The Department ID to lookup, e.g. 'D001' "),
  }),
  execute: safeToolExecute("get_department_by_id", async ({ departmentId }) => {
    const department = await departmentService.getDepartmentById(departmentId);
    if (!department) {
      return JSON.stringify({
        error: `No department found with the ID ${departmentId}`,
      });
    }
    return JSON.stringify(department);
  }),
});

export const getDepartmentByNameTool = tool({
  name: "get_department_by_name",
  description:
    "Searches department by name (case-insensitive, partial match) and returns all matches.",
  parameters: z.object({
    departmentName: z
      .string()
      .describe(
        "The name of partial name to search for, e.g. 'Engineering' or 'HR'",
      ),
  }),
  execute: safeToolExecute(
    "get_department_by_name",
    async ({ departmentName }) => {
      const departments =
        await departmentService.getDepartmentByName(departmentName);
      if (departments.length === 0) {
        return JSON.stringify({
          error: `No department found matching "${departmentName}"`,
        });
      }
      return JSON.stringify(departments);
    },
  ),
});

export const departmentTools = [
  getDepartmentsTool,
  getDepartmentByIdTool,
  getDepartmentByNameTool,
];
