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

  async getDepartmentById(
    departmentId: string,
  ): Promise<Department | undefined> {
    const departments = await this.getDepartment();
    return departments.find((el) => el.departmentID === departmentId);
  }

  async getDepartmentByName(departmentName: string): Promise<Department[]> {
    const departments = await this.getDepartment();
    const query = departmentName.trim().toLowerCase();
    return departments.filter((e) =>
      `${e.departmentName}`.toLowerCase().includes(query),
    );
  }
}

export const departmentService = new DepartmentService();
