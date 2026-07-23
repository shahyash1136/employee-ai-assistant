import { csvService } from "./csv.service.js";
import type { Project, ProjectCsvRow } from "../types/project.js";

export class ProjectServices {
  async getProjects() {
    return csvService.readCsv<ProjectCsvRow, Project>(
      "projects.csv",
      (row) => ({
        employeeID: row.EmployeeID,
        allocation: Number(row.Allocation),
        endDate: row.EndDate,
        projectID: row.ProjectID,
        projectName: row.ProjectName,
        role: row.Role,
        startDate: row.StartDate,
      }),
    );
  }
}

export const projectServices = new ProjectServices();
