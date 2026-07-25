import { tool } from "@openai/agents";
import { z } from "zod";
import { attendanceService } from "../services/attendance.service.js";

export const getAttendanceTool = tool({
  name: "get_attendance",
  description: "Returns attendance of all the employees",
  parameters: z.object({}),
  execute: async function () {
    const attendance = await attendanceService.getAttendance();
    return JSON.stringify(attendance);
  },
});

export const getAttendanceByEmployeeTool = tool({
  name: "get_attendance_by_employee",
  description:
    "Returns a single employees matching the given employee ID (e.g. E001).",
  parameters: z.object({
    employeeId: z.string().describe("The employee ID to look up, e.g. 'E001'"),
  }),
  execute: async function ({ employeeId }) {
    const employee =
      await attendanceService.getAttendanceByEmployee(employeeId);
    if (!employee) {
      return JSON.stringify({
        error: `No employee found with ID ${employeeId}`,
      });
    }
    return JSON.stringify(employee);
  },
});

export const getAttendancePercentageTool = tool({
  name: "get_attendance_percentage",
});
