# Tools

## Purpose and responsibility

Tools are the functions an agent is allowed to call. They are the **only** path from the model to company data, and the place where role rules and approval rules are enforced in code. Each tool is a thin wrapper: validate, check the caller's role, call a service, return a JSON string.

## Where it sits

Agents layer, between [Agents](agents.md) and the data modules: [Domain Data](domain-data.md) for records and [Policy Knowledge](policy-knowledge.md) for policy text. See [Architecture 2.1](../03-ARCHITECTURE-AND-LIFECYCLE.md#21-server) and steps 11 to 18 of [flow 4.3](../03-ARCHITECTURE-AND-LIFECYCLE.md#43-inside-one-agent-run).

## Anatomy of a tool

Using `get_salary_by_employee` ([salary.tool.ts:29-64](../../server/src/tools/salary.tool.ts#L29-L64)) as the reference:

| Field | Purpose |
| --- | --- |
| `name` | What the model calls. Also what the sensitive-info guardrail scans answers for. |
| `description` | The model reads this to decide when to use the tool. It is prompt text. |
| `parameters` | A zod object. The SDK converts it to JSON Schema for the model and validates the model's arguments against it. |
| `inputGuardrails` | Optional checks on the arguments before execution. See [guardrails.md](guardrails.md#tool-input-guardrails). |
| `needsApproval` | Optional boolean or function. If it yields `true`, the run pauses before `execute`. |
| `execute(params, runContext)` | The work. Must return a string here. |

## All 23 tools

| Tool | File and line | Argument guardrail | Employee role | Manager / admin |
| --- | --- | --- | --- | --- |
| `get_all_employees` | [employee.tool.ts:10](../../server/src/tools/employee.tool.ts#L10) | | Allowed | Allowed |
| `get_employee_by_id` | [employee.tool.ts:20](../../server/src/tools/employee.tool.ts#L20) | employee ID | Allowed | Allowed |
| `get_employee_by_name` | [employee.tool.ts:39](../../server/src/tools/employee.tool.ts#L39) | | Allowed | Allowed |
| `get_employees_by_department` | [employee.tool.ts:59](../../server/src/tools/employee.tool.ts#L59) | department ID | Allowed | Allowed |
| `get_departments` | [department.tool.ts:7](../../server/src/tools/department.tool.ts#L7) | | Allowed | Allowed |
| `get_department_by_id` | [department.tool.ts:17](../../server/src/tools/department.tool.ts#L17) | department ID | Allowed | Allowed |
| `get_department_by_name` | [department.tool.ts:38](../../server/src/tools/department.tool.ts#L38) | | Allowed | Allowed |
| `get_projects` | [project.tool.ts:7](../../server/src/tools/project.tool.ts#L7) | | Allowed | Allowed |
| `get_projects_by_employee` | [project.tool.ts:17](../../server/src/tools/project.tool.ts#L17) | employee ID | Allowed | Allowed |
| `get_attendance` | [attendance.tool.ts:15](../../server/src/tools/attendance.tool.ts#L15) | | Denied | Allowed |
| `get_attendance_by_employee` | [attendance.tool.ts:29](../../server/src/tools/attendance.tool.ts#L29) | employee ID | Own ID only | Allowed |
| `get_attendance_percentage` | [attendance.tool.ts:59](../../server/src/tools/attendance.tool.ts#L59) | employee ID | Own ID only | Allowed |
| `get_performance` | [performance.tool.ts:12](../../server/src/tools/performance.tool.ts#L12) | | Denied | Allowed |
| `get_performance_by_employee` | [performance.tool.ts:32](../../server/src/tools/performance.tool.ts#L32) | employee ID | Own ID only | Allowed |
| `get_top_performers` | [performance.tool.ts:65](../../server/src/tools/performance.tool.ts#L65) | | Denied | Allowed |
| `get_salary_by_employee` | [salary.tool.ts:29](../../server/src/tools/salary.tool.ts#L29) | employee ID | Own ID only | Allowed |
| `get_salaries` | [salary.tool.ts:14](../../server/src/tools/salary.tool.ts#L14) | | Denied | **Approval** |
| `get_highest_salary` | [salary.tool.ts:66](../../server/src/tools/salary.tool.ts#L66) | | Denied | **Approval** |
| `get_average_salary` | [salary.tool.ts:81](../../server/src/tools/salary.tool.ts#L81) | | Denied | **Approval** |
| `get_employees_by_salary_range` | [salary.tool.ts:96](../../server/src/tools/salary.tool.ts#L96) | | Denied | **Approval** |
| `get_highest_salary_by_department` | [salary.tool.ts:127](../../server/src/tools/salary.tool.ts#L127) | department ID | Denied | **Approval** |
| `export_salary_report` | [salary.tool.ts:170](../../server/src/tools/salary.tool.ts#L170) | | Denied | **Approval** |
| `search_hr_policies` | [policy.tool.ts:7](../../server/src/tools/policy.tool.ts#L7) | search query | Allowed | Allowed |

`get_salaries` is exported in `salaryTools` and therefore available to the Salary Agent, but the agent's instructions never mention it ([salary.agent.ts:22-30](../../server/src/agents/domains/salary.agent.ts#L22-L30)). The model can still discover it from the tool list.

## Role rules

Three tiers, all in code:

1. **Open:** employee directory, departments (including budgets), projects, HR policy text. No check.
2. **Own record or elevated:** an `employee` may pass only their own `employeeId`. Checked by comparing the argument with `context.context.employeeId` ([salary.tool.ts:43-51](../../server/src/tools/salary.tool.ts#L43-L51), [attendance.tool.ts:44-46](../../server/src/tools/attendance.tool.ts#L44-L46), [performance.tool.ts:46-51](../../server/src/tools/performance.tool.ts#L46-L51)).
3. **Company-wide:** an `employee` is refused outright. For salary, managers and admins additionally need approval.

Helpers in [roleAccess.ts](../../server/src/tools/roleAccess.ts):

| Helper | Lines | What it does |
| --- | --- | --- |
| `isEmployee(context)` | 28-30 | `context?.context?.role === "employee"`. |
| `denyEmployees(fn, deniedMessage)` | 45-54 | Wraps an execute function. Employees get the denial string; everyone else gets `fn(params)`. |
| `needsApprovalUnlessEmployee(runContext)` | 37-41 | `true` unless the role is `employee`. |
| Denial constants | 12-26 | Pre-serialized `{ "error": ... }` strings. |

`context?.context` looks odd. The outer object is the SDK's `RunContext` wrapper (it also tracks usage and approvals). Its `.context` property is the object the runner passed in, the `AuthTokenPayload`.

## Non-obvious logic, step by step

### Why employees skip the approval pause

Read [roleAccess.ts:32-41](../../server/src/tools/roleAccess.ts#L32-L41) with [salary.tool.ts:81-94](../../server/src/tools/salary.tool.ts#L81-L94). For each tool call the SDK first asks `needsApproval`. If the answer is no, it runs the tool's argument guardrails and then `execute`. If the answer is yes, the run pauses and `execute` waits for a decision (order checked against `@openai/agents-core` 0.13.5, `runner/toolExecution.js`).

- For a **manager**, `needsApproval` returns `true`. The run pauses. After approval, `execute` runs; `denyEmployees` lets a manager through.
- For an **employee**, `needsApproval` returns `false`, so there is no pause. `execute` runs immediately and `denyEmployees` returns the permission error.

If employees also paused, they could fill the approval queue with requests for data they can never be given, and a careless approver could release it. Denying before any approval is created closes that door.

A run with **no context at all** (the manual scripts) still requires approval, because `undefined?.role !== "employee"` is `true`. But the role checks inside `execute` treat a missing context as unrestricted ([salary.tool.ts:44-46](../../server/src/tools/salary.tool.ts#L44-L46)). The safe default applies to the pause, not to the data.

### Errors are return values

A tool reports problems by returning `JSON.stringify({ error: "..." })`: not found ([employee.tool.ts:30-34](../../server/src/tools/employee.tool.ts#L30-L34)), permission denied, invalid range ([salary.tool.ts:108-112](../../server/src/tools/salary.tool.ts#L108-L112)). The model reads the error and explains it to the user. The agents' instructions back this up: "If a tool returns no results or an error, say so plainly instead of guessing."

`safeToolExecute` ([safeToolExecute.ts:6-20](../../server/src/utils/safeToolExecute.ts#L6-L20)) wraps every `execute` and converts anything *thrown* into the same shape, with a generic message so stack traces and file paths never reach the model. Its generic `TArgs` tuple type preserves the wrapped function's exact parameter list.

The usual nesting is `safeToolExecute("name", denyEmployees(async (params) => ...))`: outermost catches exceptions, the middle layer checks the role, the innermost does the work.

### Two styles of role check

Salary and attendance tools use the `roleAccess.ts` helpers. Performance tools were written with inline checks and their own `PERMISSION_DENIED` constant ([performance.tool.ts:8-10](../../server/src/tools/performance.tool.ts#L8-L10), [performance.tool.ts:23-25](../../server/src/tools/performance.tool.ts#L23-L25)). Same behaviour, different code.

### A tool that joins two services

`get_highest_salary_by_department` ([salary.tool.ts:139-167](../../server/src/tools/salary.tool.ts#L139-L167)) is the only tool that touches two domains: it lists the department's employees, passes their IDs to the salary service, then attaches the matching employee record to the result. Salary rows have no department column, so the join has to happen here.

### The simulated export

`export_salary_report` returns a report id and a `downloadUrl` like `/reports/report_<timestamp>.csv` ([salary.service.ts:55-70](../../server/src/services/salary.service.ts#L55-L70)). No file is generated and no `/reports` route exists. It is there to demonstrate an approval-gated *action*, as opposed to a read.

### The policy search tool

`search_hr_policies` ([policy.tool.ts:7-40](../../server/src/tools/policy.tool.ts#L7-L40)) is the one tool that does not read a CSV. It takes a free-text `query`, calls `knowledgeRetrievalService.searchPolicies`, and returns `{ results: [{ policy, policyId, version, sections, text }] }`. Internals are in [policy-knowledge.md](policy-knowledge.md#retrieval-step-by-step).

How it differs from the other 22:

- **Free-text argument.** Its guardrail checks that the query is a non-empty string of at most 500 characters, not an ID format ([policy.tool.ts:21](../../server/src/tools/policy.tool.ts#L21)).
- **No role check and no approval.** It never touches personal records, and its description says so to the model ([policy.tool.ts:9-13](../../server/src/tools/policy.tool.ts#L9-L13)).
- **"Nothing found" is not an error.** It returns an empty `results` array with a `note`, where the lookup tools return `{ "error": ... }` ([policy.tool.ts:24-29](../../server/src/tools/policy.tool.ts#L24-L29)).
- **It has side effects outside the process:** one OpenAI embeddings call and one Postgres query per call.
- **The distance score is withheld.** The service computes it; the tool does not pass it to the model.

### Shared tool instances

`getEmployeeByIdTool` and `getEmployeeByNameTool` are the same objects in four agents' tool lists. Tools are stateless, so sharing is safe.

## Inputs, outputs, side effects, dependencies

- **Inputs:** model-supplied arguments (validated by zod and by guardrails) and the `RunContext`.
- **Outputs:** always a string, usually JSON.
- **Side effects:** none on stored data. Every tool is read-only; `export_salary_report` only pretends to create something. `search_hr_policies` makes one OpenAI embeddings request and one Postgres query.
- **Depends on:** [Domain Data](domain-data.md) services, [Policy Knowledge](policy-knowledge.md), [Guardrails](guardrails.md) for the argument guardrails, `AuthTokenPayload`.
- **Used by:** [Agents](agents.md); the sensitive-info guardrail imports the tool arrays to collect names.

## Why it is built this way, and trade-offs

- **Authorization in code, not prompts.** The model may be talked into trying anything; the tool refuses regardless. This is the most important design decision in the project.
- **String returns.** Simple and uniform, and what the model consumes anyway. The cost is that tool results are untyped and the hallucination guardrail has to work with raw JSON text.
- **Bulk tools return everything.** `get_all_employees`, `get_attendance`, and similar return all 100 rows into the model's context. Fine at this size; it would not scale.
- **Role rules exist here and on the REST routes.** Two copies to keep aligned.

## Source files covered

- `server/src/tools/attendance.tool.ts`
- `server/src/tools/department.tool.ts`
- `server/src/tools/employee.tool.ts`
- `server/src/tools/performance.tool.ts`
- `server/src/tools/policy.tool.ts`
- `server/src/tools/project.tool.ts`
- `server/src/tools/salary.tool.ts`
- `server/src/tools/roleAccess.ts`
- `server/src/utils/safeToolExecute.ts`
