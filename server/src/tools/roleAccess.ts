import type { RunContext } from "@openai/agents";
import type { AuthTokenPayload } from "../types/user.js";

// Role rules for tools that expose personal or company-wide data. The REST
// routes enforce the same rules with requireRole / requireOwnRecordOrRole.
//
// Company-wide salary data (totals, averages, rankings, ranges, bulk exports)
// is not something an 'employee' may see at all, so it is denied outright
// rather than routed to a manager for sign-off. Managers and admins can use
// these tools, but still go through the approval pause. The one salary tool
// employees keep is get_salary_by_employee, scoped to their own record.
export const COMPANY_WIDE_SALARY_DENIED = JSON.stringify({
  error:
    "You don't have permission to view company-wide salary data. " +
    "You can only view your own salary.",
});

export const COMPANY_WIDE_ATTENDANCE_DENIED = JSON.stringify({
  error:
    "You don't have permission to view company-wide attendance data. " +
    "You can only view your own attendance.",
});

export const OWN_ATTENDANCE_ONLY = JSON.stringify({
  error: "You can only view your own attendance records.",
});

export function isEmployee(context?: RunContext<AuthTokenPayload>): boolean {
  return context?.context?.role === "employee";
}

// Used as `needsApproval` on the company-wide salary tools. Employees must NOT
// get an approval request (that would let them queue up a request for data
// they're never allowed to see); returning false lets the call proceed straight
// to execute(), where denyEmployees() refuses it. Everyone else — including a
// run with no auth context — keeps the approval pause.
export async function needsApprovalUnlessEmployee(
  runContext: RunContext,
): Promise<boolean> {
  return (runContext.context as AuthTokenPayload | undefined)?.role !== "employee";
}

// Wraps a tool's execute so 'employee' callers get a permission error instead
// of data. Enforced here, in code, so it doesn't depend on the model behaving.
export function denyEmployees<TParams>(
  fn: (params: TParams) => Promise<string>,
  deniedMessage: string = COMPANY_WIDE_SALARY_DENIED,
) {
  return async (
    params: TParams,
    context?: RunContext<AuthTokenPayload>,
  ): Promise<string> =>
    isEmployee(context) ? deniedMessage : fn(params);
}
