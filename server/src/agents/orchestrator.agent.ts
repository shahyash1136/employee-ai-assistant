// server/src/agents/orchestrator.agent.ts
import { Agent } from "@openai/agents";
import { promptWithHandoffInstructions } from "@openai/agents-core/extensions";
import { StructuredResponseSchema } from "../types/structuredResponse.js";
import { structuredOutputInstructions } from "./shared/instructionFragments.js";
import { inputSafetyGuardrail } from "../guardrails/inputSafety.guardrail.js";
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

const orchestratorInstructions = promptWithHandoffInstructions(`
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
- If the request could reasonably span more than one specialist (e.g. "tell me
  everything about Priya"), hand off to the Employee Agent first, since employee
  identity is usually the natural starting point for any follow-up.

Handling ambiguous requests:
- If you cannot confidently determine which specialist the request belongs to,
  do NOT guess and do NOT hand off. Instead, respond directly to the user with a
  short clarifying question, listing the available categories:
  Employee, Attendance, Department, Salary, Project, Performance.

Handling requests handed back to you:
- A specialist may hand a request back to you mid-conversation if part of what the
  user asked falls outside that specialist's domain. Treat this exactly like a
  fresh routing decision: read what is still unanswered, and hand off to the
  correct specialist using the same rules above.
`);

export const orchestratorAgent = new Agent({
  name: "Orchestrator",
  instructions: orchestratorInstructions,
  inputGuardrails: [inputSafetyGuardrail],
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
If you must ask a clarifying question instead of handing off, you must still return
your response as structured data matching the given schema: put the clarifying
question in "summary", and set "employees" and "metrics" to empty arrays.
` +
    structuredOutputInstructions,
  inputGuardrails: [inputSafetyGuardrail],
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

// --- Wire handoffs BACK to the Orchestrator from every specialist ---
// Done here, after every agent already exists, to avoid a circular import —
// no domain agent file imports the Orchestrator directly.
const plainSpecialists = [
  employeeAgent,
  attendanceAgent,
  departmentAgent,
  salaryAgent,
  performanceAgent,
  projectAgent,
];
const structuredSpecialists = [
  employeeAgentStructured,
  attendanceAgentStructured,
  departmentAgentStructured,
  salaryAgentStructured,
  performanceAgentStructured,
  projectAgentStructured,
];

for (const specialist of plainSpecialists) {
  specialist.handoffs.push(orchestratorAgent);
}
for (const specialist of structuredSpecialists) {
  specialist.handoffs.push(orchestratorAgentStructured);
}
