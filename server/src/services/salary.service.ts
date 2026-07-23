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
}

export const salaryServices = new SalaryServices();
