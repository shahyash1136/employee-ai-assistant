import { tool } from "@openai/agents";
import { z } from "zod";
import { readEmployees } from "../services/employee.service.js";

export const employeeTool = tool({
  name: "get_employees",
  description: "Returns all employees from the employee CSV file.",
  parameters: z.object({}),
  execute: async function (context, error) {
    const employees = await readEmployees();
    return JSON.stringify(employees);
  },
});
