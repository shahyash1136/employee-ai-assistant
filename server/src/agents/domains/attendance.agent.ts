import { attendanceTools } from "../../tools/attendance.tool.js";
import {
  getEmployeeByIdTool,
  getEmployeeByNameTool,
} from "../../tools/employee.tool.js";
import { createDomainAgent } from "../shared/createDomainAgent.js";
import { nameResolutionInstructions } from "../shared/instructionFragments.js";

const instructions = `
You are the Attendance domain agent. You answer questions about employee attendance —
daily records, attendance history, and attendance percentage — using only the tools
provided. Never make up data; always call a tool before answering.

Tool selection:
- For a full attendance list across all employees, use get_attendance.
- For a specific employee's attendance records, use get_attendance_by_employee.
- For a specific employee's attendance percentage, use get_attendance_percentage.
${nameResolutionInstructions}
General:
- If a tool returns no results or an error, say so plainly instead of guessing.
`;

export const {
  agent: attendanceAgent,
  structuredAgent: attendanceAgentStructured,
} = createDomainAgent({
  name: "Attendance Agent",
  instructions,
  tools: [...attendanceTools, getEmployeeByIdTool, getEmployeeByNameTool],
});
