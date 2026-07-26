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

  async getAttendanceByEmployee(employeeId: string): Promise<Attendance[]> {
    const attendance = await this.getAttendance();
    return attendance.filter((a) => a.employeeId === employeeId);
  }

  async getAttendancePercentage(employeeId: string): Promise<number | null> {
    const records = await this.getAttendanceByEmployee(employeeId);

    // Holiday and Leave are both treated as non-working days and excluded
    // from the denominator.
    const workingDays = records.filter(
      (r) => r.status !== "Holiday" && r.status !== "Leave",
    );
    if (workingDays.length === 0) return null;

    // Present/WFH count as a full day, Half-Day counts as half.
    const attendedDays = workingDays.reduce((sum, r) => {
      if (r.status === "Present" || r.status === "WFH") return sum + 1;
      if (r.status === "Half-Day") return sum + 0.5;
      return sum;
    }, 0);

    return Number(((attendedDays / workingDays.length) * 100).toFixed(2));
  }
}

export const attendanceService = new AttendanceService();
