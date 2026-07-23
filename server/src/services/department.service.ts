import { csvService } from "./csv.service.js";
import type { Department, DepartmentCsvRow } from "../types/department.js";

export class DepartmentService {
  async getDepartment() {
    return csvService.readCsv<DepartmentCsvRow, Department>(
      "departments.csv",
      (row) => ({
        departmentID: row.DepartmentID,
        departmentName: row.DepartmentName,
        departmentHeadID: row.DepartmentHeadID,
        budget: Number(row.Budget),
      }),
    );
  }
}

export const departmentService = new DepartmentService();
