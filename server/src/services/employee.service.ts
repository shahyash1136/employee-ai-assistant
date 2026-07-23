import { csvService } from "./csv.service.js";
import type { Employee, EmployeeCSVRow } from "../types/employee.js";

export class EmployeeService {
  async getEmployees() {
    return csvService.readCsv<EmployeeCSVRow, Employee>(
      "employees.csv",
      (row) => ({
        employeeId: row.EmployeeID ?? "",
        firstName: row.FirstName ?? "",
        lastName: row.LastName ?? "",
        departmentId: row.DepartmentID ?? "",
        managerId: row.ManagerID ?? null,
        designation: row.Designation ?? "",
        joiningDate: new Date(row.JoiningDate ?? new Date().toISOString()),
        email: row.Email ?? "",
        location: row.Location ?? "",
        employmentType: row.EmploymentType ?? "",
        status: row.Status ?? "",
      }),
    );
  }
}

export const employeeService = new EmployeeService();
