import { tool, type RunContext } from "@openai/agents";
import { z } from "zod";
import { performanceService } from "../services/performance.service.js";
import { safeToolExecute } from "../utils/safeToolExecute.js";
import { employeeIdGuardrail } from "../guardrails/toolMisuse.guardrail.js";
import type { AuthTokenPayload } from "../types/user.js";

const PERMISSION_DENIED = JSON.stringify({
  error: "You don't have permission to view company-wide performance data.",
});

export const getPerformanceTool = tool({
  name: "get_performance",
  description: "Returns all performance records from the performance CSV file.",
  parameters: z.object({}),
  execute: safeToolExecute(
    "get_performance",
    async (_params: {}, context?: RunContext<AuthTokenPayload>) => {
      // Bulk/comparative performance data — same tier of sensitivity as bulk
      // salary, but enforced as a straightforward role check rather than an
      // approval pause: this is about WHO is allowed to see it at all, not a
      // sign-off workflow like the salary export tool from Part 8.
      if (context?.context && context.context.role === "employee") {
        return PERMISSION_DENIED;
      }
      const performance = await performanceService.getPerformance();
      return JSON.stringify(performance);
    },
  ),
});

export const getPerformanceByEmployeeTool = tool({
  name: "get_performance_by_employee",
  description:
    "Returns all performance records (across all years) for a specific employee ID (e.g. E001).",
  parameters: z.object({
    employeeId: z.string().describe("The employee ID to look up, e.g. 'E001'"),
  }),
  inputGuardrails: [employeeIdGuardrail],
  execute: safeToolExecute(
    "get_performance_by_employee",
    async (
      { employeeId }: { employeeId: string },
      context?: RunContext<AuthTokenPayload>,
    ) => {
      const user = context?.context;
      if (user?.role === "employee" && user.employeeId !== employeeId) {
        return JSON.stringify({
          error: "You can only view your own performance records.",
        });
      }

      const records =
        await performanceService.getPerformanceByEmployee(employeeId);
      if (records.length === 0) {
        return JSON.stringify({
          error: `No performance records found for employee ID ${employeeId}`,
        });
      }
      return JSON.stringify(records);
    },
  ),
});

export const getTopPerformersTool = tool({
  name: "get_top_performers",
  description:
    "Returns all performance records with a rating greater than or equal to the given minimum rating (default is 4.5).",
  parameters: z.object({
    minRating: z
      .number()
      .default(4.5)
      .describe("The minimum rating to filter by (default is 4.5)"),
  }),
  execute: safeToolExecute(
    "get_top_performers",
    async (
      { minRating }: { minRating: number },
      context?: RunContext<AuthTokenPayload>,
    ) => {
      if (context?.context && context.context.role === "employee") {
        return PERMISSION_DENIED;
      }
      const topPerformers =
        await performanceService.getTopPerformers(minRating);
      if (topPerformers.length === 0) {
        return JSON.stringify({
          error: `No performers found with rating >= ${minRating}`,
        });
      }
      return JSON.stringify(topPerformers);
    },
  ),
});

export const performanceTools = [
  getPerformanceTool,
  getPerformanceByEmployeeTool,
  getTopPerformersTool,
];
