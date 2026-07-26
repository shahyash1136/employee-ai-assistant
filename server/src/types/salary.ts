export interface Salary {
  employeeID: string;
  baseSalary: number;
  bonus: number;
  ctc: number;
  lastIncrement: string;
  currency: string;
}

export interface SalaryCsvRow {
  EmployeeID: string;
  BaseSalary: number;
  Bonus: number;
  CTC: number;
  LastIncrement: string;
  Currency: string;
}
