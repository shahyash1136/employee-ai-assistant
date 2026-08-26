import { tool } from "@openai/agents";
import { z } from "zod";
import { salaryServices } from "../services/salary.service.js";
import { employeeService } from "../services/employee.service.js";
import { safeToolExecute } from "../utils/safeToolExecute.js";
import {
  departmentIdGuardrail,
  employeeIdGuardrail,
} from "../guardrails/toolMisuse.guardrail.js";
import type { RunContext } from "@openai/agents";
import type { AuthTokenPayload } from "../types/user.js";

export const getSalariesTool = tool({
  name: "get_salaries",
  description: "Returns all salaries from the salaries CSV file.",
  parameters: z.object({}),
  needsApproval: true, // bulk compensation data — always requires sign-off
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
  inputGuardrails: [employeeIdGuardrail],
  execute: safeToolExecute(
    "get_salary_by_employee",
    async (
      params: { employeeId: string },
      context?: RunContext<AuthTokenPayload>,
    ) => {
      const user = context?.context;
      // 'employee' role can only look up their own record. Managers/admins,
      // and any run where auth context wasn't supplied (e.g. an internal
      // classifier call), are unrestricted.
      if (user?.role === "employee" && user.employeeId !== params.employeeId) {
        return JSON.stringify({
          error: "You can only view your own salary information.",
        });
      }

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
  needsApproval: true, // comparative across all employees
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
  needsApproval: true, // aggregate across all employees
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
  needsApproval: true, // comparative across employees
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
  needsApproval: true, // comparative within a department
  inputGuardrails: [departmentIdGuardrail],
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

export const exportSalaryReportTool = tool({
  name: "export_salary_report",
  description:
    "Generates a downloadable export of the full salary dataset for offline review. " +
    "Use only when the user explicitly asks to export, download, or generate a report " +
    "of salary data — not for answering a normal question.",
  parameters: z.object({}),
  needsApproval: true, // always — this is the clearest "sensitive action" in the system
  execute: safeToolExecute("export_salary_report", async () => {
    const report = await salaryServices.generateSalaryReport();
    return JSON.stringify(report);
  }),
});

export const salaryTools = [
  getSalariesTool,
  getSalaryByEmployeeTool,
  getHighestSalaryTool,
  getAverageSalaryTool,
  getEmployeesBySalaryRangeTool,
  getHighestSalaryByDepartmentTool,
  exportSalaryReportTool,
];
