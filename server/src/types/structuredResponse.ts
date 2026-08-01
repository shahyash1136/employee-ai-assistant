import { z } from "zod";

export const StructuredResponseSchema = z.object({
  summary: z
    .string()
    .describe("A concise natural-language summary of the answer."),
  employees: z
    .array(
      z.object({
        employeeId: z.string(),
        name: z.string(),
        department: z.string().nullable(),
        designation: z.string().nullable(),
        salary: z.number().nullable(),
        attendancePercentage: z.number().nullable(),
        performanceRating: z.number().nullable(),
      }),
    )
    .nullable()
    .describe("Employee records relevant to the answer, if any."),
  metrics: z
    .array(
      z.object({
        label: z.string().describe("e.g. 'Highest Salary', 'Average Salary'"),
        value: z.number(),
      }),
    )
    .nullable()
    .describe("Aggregate figures relevant to the answer, if any."),
});

export type StructuredResponse = z.infer<typeof StructuredResponseSchema>;
