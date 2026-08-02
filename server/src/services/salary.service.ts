import { csvService } from "./csv.service.js";
import type { Salary, SalaryCsvRow } from "../types/salary.js";

export class SalaryServices {
  async getSalaries() {
    return csvService.readCsv<SalaryCsvRow, Salary>("salaries.csv", (row) => ({
      employeeID: row.EmployeeID,
      baseSalary: Number(row.BaseSalary),
      bonus: Number(row.Bonus),
      ctc: Number(row.CTC),
      currency: row.Currency,
      lastIncrement: row.LastIncrement,
    }));
  }

  async getSalaryByEmployee(employeeId: string): Promise<Salary | undefined> {
    const salaries = await this.getSalaries();
    return salaries.find((s) => s.employeeID === employeeId);
  }

  async getHighestSalary(): Promise<Salary | undefined> {
    const salaries = await this.getSalaries();
    if (salaries.length === 0) return undefined;
    return salaries.reduce((highest, current) =>
      current.ctc > highest.ctc ? current : highest,
    );
  }

  async getAverageSalary(): Promise<number> {
    const salaries = await this.getSalaries();
    if (salaries.length === 0) return 0;
    const total = salaries.reduce((sum, s) => sum + s.ctc, 0);
    return Number((total / salaries.length).toFixed(2));
  }

  async getEmployeesBySalaryRange(min: number, max: number): Promise<Salary[]> {
    const salaries = await this.getSalaries();
    return salaries.filter((s) => s.ctc >= min && s.ctc <= max);
  }

  async getHighestSalaryInDepartment(
    departmentId: string,
    employeeIds: string[],
  ): Promise<Salary | undefined> {
    const salaries = await this.getSalaries();
    const departmentSalaries = salaries.filter((s) =>
      employeeIds.includes(s.employeeID),
    );
    if (departmentSalaries.length === 0) return undefined;
    return departmentSalaries.reduce((highest, current) =>
      current.ctc > highest.ctc ? current : highest,
    );
  }
}

export const salaryServices = new SalaryServices();
