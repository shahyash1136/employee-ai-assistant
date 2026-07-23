import { csvService } from "./csv.service.js";

import type { Attendance, AttendanceCsvRow } from "../types/attendance.js";

export class AttendanceService {
  async getAttendance() {
    return csvService.readCsv<AttendanceCsvRow, Attendance>(
      "attendance.csv",
      (row) => ({
        employeeId: row.EmployeeID,
        date: row.Date,
        status: row.Status,
        checkIn: row.CheckIn,
        checkOut: row.CheckOut,
        totalHours: Number(row.TotalHours),
      }),
    );
  }
}

export const attendanceService = new AttendanceService();
