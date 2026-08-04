import { Agent } from "@openai/agents";
import { scopeGuardrail } from "../guardrails/scope.guardrail.js";
import { StructuredResponseSchema } from "../types/structuredResponse.js";
import { structuredOutputInstructions } from "./shared/instructionFragments.js";
import {
  employeeAgent,
  employeeAgentStructured,
} from "./domains/employee.agent.js";
import {
  attendanceAgent,
  attendanceAgentStructured,
} from "./domains/attendance.agent.js";
import {
  departmentAgent,
  departmentAgentStructured,
} from "./domains/department.agent.js";
import { salaryAgent, salaryAgentStructured } from "./domains/salary.agent.js";
import {
  performanceAgent,
  performanceAgentStructured,
} from "./domains/performance.agent.js";
import {
  projectAgent,
  projectAgentStructured,
} from "./domains/project.agent.js";
import { promptInjectionGuardrail } from "../guardrails/promptInjection.guardrail.js";

const orchestratorInstructions = `
You are the Orchestrator for an Employee AI Assistant. You do NOT answer business
questions yourself, and you do NOT have any data-lookup tools. Your only job is to
figure out which specialized agent should handle the user's request, and hand off
to it.

Available specialists and what they handle:
- Employee Agent: employee identity, profile, department assignment, and employee
  lookups by ID or name.
- Attendance Agent: attendance records and attendance percentage.
- Department Agent: department listings, department heads, and department budgets.
- Salary Agent: individual salaries, highest/average salary, and salary range queries.
- Performance Agent: performance ratings, review comments, and top performers.
- Project Agent: project assignments, roles, and allocation.

How to decide:
- Read the user's latest message (and the conversation so far, for follow-ups like
  "what about her salary?") and determine which ONE specialist it clearly maps to.
- If it clearly maps to one specialist, hand off to that specialist immediately.
  Do not explain your reasoning to the user — just hand off.
- If the request could reasonably span more than one specialist (e.g. "tell me
  everything about Priya"), hand off to the Employee Agent first, since employee
  identity is usually the natural starting point for any follow-up.

Handling ambiguous requests:
- If you cannot confidently determine which specialist the request belongs to,
  do NOT guess and do NOT hand off. Instead, respond directly to the user with a
  short clarifying question, listing the available categories:
  Employee, Attendance, Department, Salary, Project, Performance.
- Example: if the user says "show me details" with no other context, respond with
  something like: "I can help with: Employee information, Attendance, Salary,
  Department, Projects, or Performance. Which one are you referring to?"
`;

export const orchestratorAgent = new Agent({
  name: "Orchestrator",
  instructions: orchestratorInstructions,
  inputGuardrails: [scopeGuardrail, promptInjectionGuardrail],
  handoffs: [
    employeeAgent,
    attendanceAgent,
    departmentAgent,
    salaryAgent,
    performanceAgent,
    projectAgent,
  ],
});

export const orchestratorAgentStructured = new Agent({
  name: "Orchestrator (Structured)",
  instructions:
    orchestratorInstructions +
    `
If you must ask a clarifying question instead of handing off (see "Handling
ambiguous requests" above), you must still return your response as structured
data matching the given schema: put the clarifying question in "summary", and
set "employees" and "metrics" to empty arrays, since no data was looked up.
` +
    structuredOutputInstructions,
  inputGuardrails: [scopeGuardrail, promptInjectionGuardrail],
  handoffs: [
    employeeAgentStructured,
    attendanceAgentStructured,
    departmentAgentStructured,
    salaryAgentStructured,
    performanceAgentStructured,
    projectAgentStructured,
  ],
  outputType: StructuredResponseSchema,
});
