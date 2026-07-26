export interface Project {
  projectID: string;
  projectName: string;
  employeeID: string;
  role: string;
  startDate: string;
  endDate: string;
  allocation: number;
}

export interface ProjectCsvRow {
  ProjectID: string;
  ProjectName: string;
  EmployeeID: string;
  Role: string;
  StartDate: string;
  EndDate: string;
  Allocation: number;
}
