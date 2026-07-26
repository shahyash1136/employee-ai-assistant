import { csvService } from "./csv.service.js";
import type { Employee, EmployeeCSVRow } from "../types/employee.js";

export class EmployeeService {
  async getAllEmployees(): Promise<Employee[]> {
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

  async getEmployeeById(employeeId: string): Promise<Employee | undefined> {
    const employees = await this.getAllEmployees();
    return employees.find((e) => e.employeeId === employeeId);
  }

  async getEmployeeByName(name: string): Promise<Employee[]> {
    const employees = await this.getAllEmployees();
    const query = name.trim().toLowerCase();
    return employees.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(query) ||
        e.firstName.toLowerCase().includes(query) ||
        e.lastName.toLowerCase().includes(query),
    );
  }

  async getEmployeesByDepartment(departmentId: string): Promise<Employee[]> {
    const employees = await this.getAllEmployees();
    return employees.filter((e) => e.departmentId === departmentId);
  }
}

export const employeeService = new EmployeeService();
