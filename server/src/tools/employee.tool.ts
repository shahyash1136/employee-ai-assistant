import { tool } from "@openai/agents";
import { z } from "zod";
import { employeeService } from "../services/employee.service.js";

export const getAllEmployeesTool = tool({
  name: "get_all_employees",
  description: "Returns all employees from the employee CSV file.",
  parameters: z.object({}),
  execute: async function () {
    const employees = await employeeService.getAllEmployees();
    return JSON.stringify(employees);
  },
});

export const getEmployeeByIdTool = tool({
  name: "get_employee_by_id",
  description:
    "Returns a single employee matching the given employee ID (e.g. E001).",
  parameters: z.object({
    employeeId: z.string().describe("The employee ID to look up, e.g. 'E001'"),
  }),
  execute: async function ({ employeeId }) {
    const employee = await employeeService.getEmployeeById(employeeId);
    if (!employee) {
      return JSON.stringify({
        error: `No employee found with ID ${employeeId}`,
      });
    }
    return JSON.stringify(employee);
  },
});

export const getEmployeeByNameTool = tool({
  name: "get_employee_by_name",
  description:
    "Searches employees by first name, last name, or full name (case-insensitive, partial match) and returns all matches.",
  parameters: z.object({
    name: z
      .string()
      .describe(
        "The name or partial name to search for, e.g. 'Shah' or 'Priya'",
      ),
  }),
  execute: async function ({ name }) {
    const employees = await employeeService.getEmployeeByName(name);
    return JSON.stringify(employees);
  },
});

export const getEmployeesByDepartmentTool = tool({
  name: "get_employees_by_department",
  description:
    "Returns all employees belonging to the given department ID (e.g. D001).",
  parameters: z.object({
    departmentId: z
      .string()
      .describe("The department ID to filter by, e.g. 'D001'"),
  }),
  execute: async function ({ departmentId }) {
    const employees =
      await employeeService.getEmployeesByDepartment(departmentId);
    return JSON.stringify(employees);
  },
});

// Convenient bundle for registering all employee tools with an agent at once.
export const employeeTools = [
  getAllEmployeesTool,
  getEmployeeByIdTool,
  getEmployeeByNameTool,
  getEmployeesByDepartmentTool,
];
