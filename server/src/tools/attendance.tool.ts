import { tool } from "@openai/agents";
import { z } from "zod";
import { attendanceService } from "../services/attendance.service.js";
import { safeToolExecute } from "../utils/safeToolExecute.js";
import { employeeIdGuardrail } from "../guardrails/toolMisuse.guardrail.js";
import type { RunContext } from "@openai/agents";
import type { AuthTokenPayload } from "../types/user.js";
import {
  COMPANY_WIDE_ATTENDANCE_DENIED,
  OWN_ATTENDANCE_ONLY,
  denyEmployees,
  isEmployee,
} from "./roleAccess.js";

export const getAttendanceTool = tool({
  name: "get_attendance",
  description: "Returns attendance of all the employees",
  parameters: z.object({}),
  // Everyone's attendance and leave records: managers/admins only.
  execute: safeToolExecute(
    "get_attendance",
    denyEmployees(async () => {
      const attendance = await attendanceService.getAttendance();
      return JSON.stringify(attendance);
    }, COMPANY_WIDE_ATTENDANCE_DENIED),
  ),
});

export const getAttendanceByEmployeeTool = tool({
  name: "get_attendance_by_employee",
  description:
    "Returns a single employees matching the given employee ID (e.g. E001).",
  parameters: z.object({
    employeeId: z.string().describe("The employee ID to look up, e.g. 'E001'"),
  }),
  inputGuardrails: [employeeIdGuardrail],
  execute: safeToolExecute(
    "get_attendance_by_employee",
    async (
      { employeeId }: { employeeId: string },
      context?: RunContext<AuthTokenPayload>,
    ) => {
      // 'employee' role can only look up their own record.
      if (isEmployee(context) && context?.context?.employeeId !== employeeId) {
        return OWN_ATTENDANCE_ONLY;
      }
      const records =
        await attendanceService.getAttendanceByEmployee(employeeId);
      if (records.length === 0) {
        return JSON.stringify({
          error: `No attendance records found for employee ID ${employeeId}`,
        });
      }
      return JSON.stringify(records);
    },
  ),
});

export const getAttendancePercentageTool = tool({
  name: "get_attendance_percentage",
  description:
    "Returns attendance percentage of the single employee matching the given employee ID (e.g. E001).",
  parameters: z.object({
    employeeId: z.string().describe("The employee ID to look up, e.g. 'E001'"),
  }),
  inputGuardrails: [employeeIdGuardrail],
  execute: safeToolExecute(
    "get_attendance_percentage",
    async (
      { employeeId }: { employeeId: string },
      context?: RunContext<AuthTokenPayload>,
    ) => {
      if (isEmployee(context) && context?.context?.employeeId !== employeeId) {
        return OWN_ATTENDANCE_ONLY;
      }
      const percentage =
        await attendanceService.getAttendancePercentage(employeeId);
      if (percentage === undefined || percentage === null) {
        return JSON.stringify({
          error: `No attendance records found for employee ID ${employeeId}`,
        });
      }
      return JSON.stringify({ employeeId, attendancePercentage: percentage });
    },
  ),
});

export const attendanceTools = [
  getAttendanceTool,
  getAttendanceByEmployeeTool,
  getAttendancePercentageTool,
];
