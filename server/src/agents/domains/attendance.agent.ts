import type { RunContext } from "@openai/agents";
import { attendanceTools } from "../../tools/attendance.tool.js";
import type { AuthTokenPayload } from "../../types/user.js";
import {
  getEmployeeByIdTool,
  getEmployeeByNameTool,
} from "../../tools/employee.tool.js";
import { createDomainAgent } from "../shared/createDomainAgent.js";
import {
  nameResolutionInstructions,
  outOfScopeHandoffInstructions,
} from "../shared/instructionFragments.js";

const baseInstructions = `
You are the Attendance domain agent. You answer questions about employee attendance —
daily records, attendance history, and attendance percentage — using only the tools
provided. Never make up data; always call a tool before answering.

Tool selection:
- For a full attendance list across all employees, use get_attendance.
- For a specific employee's attendance records, use get_attendance_by_employee.
- For a specific employee's attendance percentage, use get_attendance_percentage.
${nameResolutionInstructions}
${outOfScopeHandoffInstructions}
General:
- If a tool returns no results or an error, say so plainly instead of guessing.
`;

// Injects the authenticated user's identity into the system prompt so "my
// attendance" resolves to their own employee ID without asking for it. (Same
// approach as the Salary and Performance agents.)
function buildInstructions(runContext: RunContext<AuthTokenPayload>): string {
  const user = runContext.context;
  const identityNote = user
    ? `\nThe current authenticated user's employee ID is ${user.employeeId} (role: ${user.role}). ` +
      `When they refer to "my", "me", or "I" (e.g. "what's my attendance"), use employee ID ` +
      `${user.employeeId} directly for the relevant tool call — do not ask them for their ID.\n`
    : "";
  return baseInstructions + identityNote;
}

export const {
  agent: attendanceAgent,
  structuredAgent: attendanceAgentStructured,
} = createDomainAgent<AuthTokenPayload>({
  name: "Attendance Agent",
  instructions: buildInstructions,
  tools: [...attendanceTools, getEmployeeByIdTool, getEmployeeByNameTool],
});
