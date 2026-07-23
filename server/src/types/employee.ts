export interface Employee {
  employeeId: string;
  firstName: string;
  lastName: string;
  departmentId: string;
  managerId: string | null;
  designation: string;
  joiningDate: Date;
  email: string;
  location: string;
  employmentType: string;
  status: string;
}

export interface EmployeeCSVRow {
  EmployeeID: string;
  FirstName: string;
  LastName: string;
  DepartmentID: string;
  ManagerID: string | null;
  Designation: string;
  JoiningDate: string;
  Email: string;
  Location: string;
  EmploymentType: string;
  Status: string;
}
