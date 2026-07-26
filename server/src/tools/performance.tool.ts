import { tool } from "@openai/agents";
import { z } from "zod";
import { performanceService } from "../services/performance.service.js";

export const getPerformanceTool = tool({
  name: "get_performance",
  description: "Returns all performance records from the performance CSV file.",
  parameters: z.object({}),
  execute: async function () {
    const performance = await performanceService.getPerformance();
    return JSON.stringify(performance);
  },
});

export const getPerformanceByEmployeeTool = tool({
  name: "get_performance_by_employee",
  description:
    "Returns all performance records (across all years) for a specific employee ID (e.g. E001).",
  parameters: z.object({
    employeeId: z.string().describe("The employee ID to look up, e.g. 'E001'"),
  }),
  execute: async function ({ employeeId }) {
    const records =
      await performanceService.getPerformanceByEmployee(employeeId);
    if (records.length === 0) {
      return JSON.stringify({
        error: `No performance records found for employee ID ${employeeId}`,
      });
    }
    return JSON.stringify(records);
  },
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
  execute: async function ({ minRating }: { minRating: number }) {
    const topPerformers = await performanceService.getTopPerformers(minRating);
    return JSON.stringify(topPerformers);
  },
});

export const performanceTools = [
  getPerformanceTool,
  getPerformanceByEmployeeTool,
  getTopPerformersTool,
];
