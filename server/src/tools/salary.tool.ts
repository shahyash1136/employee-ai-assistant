import { tool } from "@openai/agents";
import { z } from "zod";
import { salaryServices } from "../services/salary.service.js";
import { employeeService } from "../services/employee.service.js";
import { safeToolExecute } from "../utils/safeToolExecute.js";

export const getSalariesTool = tool({
  name: "get_salaries",
  description: "Returns all salaries from the salaries CSV file.",
  parameters: z.object({}),
  execute: safeToolExecute("get_salaries", async () => {
    const salaries = await salaryServices.getSalaries();
    if (salaries.length === 0) {
      return JSON.stringify({ error: "No salary records available" });
    }
    return JSON.stringify(salaries);
  }),
});

export const getSalaryByEmployeeTool = tool({
  name: "get_salary_by_employee",
  description:
    "Returns the salary details for a specific employee ID (e.g. E001).",
  parameters: z.object({
    employeeId: z.string().describe("The employee ID to look up, e.g. 'E001'"),
  }),
  execute: safeToolExecute(
    "get_salary_by_employee",
    async (params: { employeeId: string }) => {
      const salary = await salaryServices.getSalaryByEmployee(
        params.employeeId,
      );
      if (!salary) {
        return JSON.stringify({
          error: `No salary record found for employee ID ${params.employeeId}`,
        });
      }
      return JSON.stringify(salary);
    },
  ),
});

export const getHighestSalaryTool = tool({
  name: "get_highest_salary",
  description:
    "Returns the salary details of the employee with the highest salary.",
  parameters: z.object({}),
  execute: safeToolExecute("get_highest_salary", async () => {
    const highestSalary = await salaryServices.getHighestSalary();
    if (!highestSalary) {
      return JSON.stringify({ error: "No salary records available" });
    }
    return JSON.stringify(highestSalary);
  }),
});

export const getAverageSalaryTool = tool({
  name: "get_average_salary",
  description: "Returns the average salary across all employees.",
  parameters: z.object({}),
  execute: safeToolExecute("get_average_salary", async () => {
    const salaries = await salaryServices.getSalaries();
    if (salaries.length === 0) {
      return JSON.stringify({ error: "No salary records available" });
    }
    const averageSalary = await salaryServices.getAverageSalary();
    return JSON.stringify(averageSalary);
  }),
});

export const getEmployeesBySalaryRangeTool = tool({
  name: "get_employees_by_salary_range",
  description:
    "Returns a list of employees whose salaries fall within a specified range.",
  parameters: z.object({
    minSalary: z.number().describe("The minimum salary in the range."),
    maxSalary: z.number().describe("The maximum salary in the range."),
  }),
  execute: safeToolExecute(
    "get_employees_by_salary_range",
    async (params: { minSalary: number; maxSalary: number }) => {
      if (params.minSalary > params.maxSalary) {
        return JSON.stringify({
          error: "minSalary cannot be greater than maxSalary",
        });
      }
      const employees = await salaryServices.getEmployeesBySalaryRange(
        params.minSalary,
        params.maxSalary,
      );
      if (employees.length === 0) {
        return JSON.stringify({
          error: "No employees found within the specified salary range",
        });
      }
      return JSON.stringify(employees);
    },
  ),
});

export const getHighestSalaryByDepartmentTool = tool({
  name: "get_highest_salary_by_department",
  description:
    "Returns the employee with the highest salary WITHIN a specific department. " +
    "Use this instead of get_highest_salary whenever the question is scoped to a " +
    "department (e.g. 'highest salary in Engineering', 'who earns the most there' " +
    "after discussing a specific department).",
  parameters: z.object({
    departmentId: z.string().describe("The department ID, e.g. 'D001'"),
  }),
  execute: safeToolExecute(
    "get_highest_salary_by_department",
    async ({ departmentId }) => {
      const employees =
        await employeeService.getEmployeesByDepartment(departmentId);
      if (employees.length === 0) {
        return JSON.stringify({
          error: `No employees found in department ${departmentId}`,
        });
      }

      const employeeIds = employees.map((e) => e.employeeId);
      const topEarner = await salaryServices.getHighestSalaryInDepartment(
        departmentId,
        employeeIds,
      );

      if (!topEarner) {
        return JSON.stringify({
          error: `No salary records found for department ${departmentId}`,
        });
      }

      const employee = employees.find(
        (e) => e.employeeId === topEarner.employeeID,
      );
      return JSON.stringify({ employee, salary: topEarner });
    },
  ),
});

export const salaryTools = [
  getSalariesTool,
  getSalaryByEmployeeTool,
  getHighestSalaryTool,
  getAverageSalaryTool,
  getEmployeesBySalaryRangeTool,
  getHighestSalaryByDepartmentTool,
];
