export interface Attendance {
  employeeId: string;
  date: string;
  status: string;
  checkIn: string;
  checkOut: string;
  totalHours: number;
}

export interface AttendanceCsvRow {
  EmployeeID: string;
  Date: string;
  Status: string;
  CheckIn: string;
  CheckOut: string;
  TotalHours: number;
}
