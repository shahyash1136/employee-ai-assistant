import { tool } from "@openai/agents";
import { z } from "zod";
import { salaryServices } from "../services/salary.service.js";

export const getSalariesTool = tool({
  name: "get_salaries",
  description: "Returns all salaries from the salaries CSV file.",
  parameters: z.object({}),
  execute: async () => {
    const salaries = await salaryServices.getSalaries();
    if (!salaries || salaries.length === 0) {
      return JSON.stringify({ error: "No salary records available" });
    }
    return JSON.stringify(salaries);
  },
});

export const getSalaryByEmployeeTool = tool({
  name: "get_salary_by_employee",
  description:
    " Returns the salary details for a specific employee ID (e.g. E001).",
  parameters: z.object({
    employeeId: z.string().describe("The employee ID to look up, e.g. 'E001'"),
  }),
  execute: async (params) => {
    const salary = await salaryServices.getSalaryByEmployee(params.employeeId);
    if (!salary) {
      return JSON.stringify({
        error: `No salary record found for employee ID ${params.employeeId}`,
      });
    }
    return JSON.stringify(salary);
  },
});

export const getHighestSalaryTool = tool({
  name: "get_highest_salary",
  description:
    "Returns the salary details of the employee with the highest salary.",
  parameters: z.object({}),
  execute: async () => {
    const highestSalary = await salaryServices.getHighestSalary();
    if (!highestSalary) {
      return JSON.stringify({ error: "No salary records available" });
    }
    return JSON.stringify(highestSalary);
  },
});

export const getAverageSalaryTool = tool({
  name: "get_average_salary",
  description: "Returns the average salary across all employees.",
  parameters: z.object({}),
  execute: async () => {
    const averageSalary = await salaryServices.getAverageSalary();
    if (!averageSalary) {
      return JSON.stringify({ error: "No salary records available" });
    }
    return JSON.stringify(averageSalary);
  },
});

export const getEmployeesBySalaryRangeTool = tool({
  name: "get_employees_by_salary_range",
  description:
    "Returns a list of employees whose salaries fall within a specified range.",
  parameters: z.object({
    minSalary: z.number().describe("The minimum salary in the range."),
    maxSalary: z.number().describe("The maximum salary in the range."),
  }),
  execute: async (params) => {
    const employees = await salaryServices.getEmployeesBySalaryRange(
      params.minSalary,
      params.maxSalary,
    );
    if (!employees || employees.length === 0) {
      return JSON.stringify({
        error: "No employees found within the specified salary range",
      });
    }
    return JSON.stringify(employees);
  },
});

export const salaryTools = [
  getSalariesTool,
  getSalaryByEmployeeTool,
  getHighestSalaryTool,
  getAverageSalaryTool,
  getEmployeesBySalaryRangeTool,
];
