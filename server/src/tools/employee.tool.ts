import { tool } from "@openai/agents";
import { z } from "zod";
import { employeeService } from "../services/employee.service.js";

export const employeeTool = tool({
  name: "get_employees",
  description: "Returns all employees from the employee CSV file.",
  parameters: z.object({}),
  execute: async function (context, error) {
    const employees = await employeeService.getEmployees();
    return JSON.stringify(employees);
  },
});
