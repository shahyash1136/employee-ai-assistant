import { fileURLToPath } from "node:url";
import path from "node:path";
import swaggerJsdoc from "swagger-jsdoc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Employee AI Assistant API",
      version: "1.0.0",
      description:
        "REST API for employee, attendance, department, salary, performance, and " +
        "project data, the AI chat assistant, and its execution traces.",
    },
    servers: [{ url: "/", description: "This server" }],
    components: {
      schemas: {
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
          },
        },
        Employee: {
          type: "object",
          properties: {
            employeeId: { type: "string", example: "E001" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            departmentId: { type: "string", example: "D001" },
            managerId: { type: "string", nullable: true },
            designation: { type: "string" },
            joiningDate: { type: "string", format: "date-time" },
            email: { type: "string", format: "email" },
            location: { type: "string" },
            employmentType: { type: "string" },
            status: { type: "string" },
          },
        },
        Attendance: {
          type: "object",
          properties: {
            employeeId: { type: "string", example: "E001" },
            date: { type: "string", example: "2026-08-01" },
            status: { type: "string", example: "Present" },
            checkIn: { type: "string", example: "09:02" },
            checkOut: { type: "string", example: "18:10" },
            totalHours: { type: "number", example: 8.5 },
          },
        },
        Performance: {
          type: "object",
          properties: {
            employeeID: { type: "string", example: "E001" },
            year: { type: "integer", example: 2025 },
            rating: { type: "number", example: 4.2 },
            promotionEligible: { type: "string", example: "Yes" },
            reviewComments: { type: "string" },
          },
        },
        Project: {
          type: "object",
          properties: {
            projectID: { type: "string", example: "P001" },
            projectName: { type: "string" },
            employeeID: { type: "string", example: "E001" },
            role: { type: "string" },
            startDate: { type: "string" },
            endDate: { type: "string" },
            allocation: { type: "number", example: 50 },
          },
        },
        Salary: {
          type: "object",
          properties: {
            employeeID: { type: "string", example: "E001" },
            baseSalary: { type: "number" },
            bonus: { type: "number" },
            ctc: { type: "number" },
            lastIncrement: { type: "string" },
            currency: { type: "string", example: "INR" },
          },
        },
        Department: {
          type: "object",
          properties: {
            departmentID: { type: "string", example: "D001" },
            departmentName: { type: "string", example: "Engineering" },
            departmentHeadID: { type: "string", example: "E001" },
            budget: { type: "number" },
          },
        },
        ChatRequest: {
          type: "object",
          required: ["sessionId", "message"],
          properties: {
            sessionId: { type: "string", example: "session-123" },
            message: { type: "string", example: "How many departments are there?" },
            format: {
              type: "string",
              enum: ["json", "text"],
              description:
                "Omit or 'text' for a simulated SSE token stream (default). " +
                "'json' returns one buffered structured response instead.",
            },
          },
        },
        StructuredResponse: {
          type: "object",
          properties: {
            summary: { type: "string" },
            employees: {
              type: "array",
              nullable: true,
              items: {
                type: "object",
                properties: {
                  employeeId: { type: "string" },
                  name: { type: "string" },
                  department: { type: "string", nullable: true },
                  designation: { type: "string", nullable: true },
                  salary: { type: "number", nullable: true },
                  attendancePercentage: { type: "number", nullable: true },
                  performanceRating: { type: "number", nullable: true },
                },
              },
            },
            metrics: {
              type: "array",
              nullable: true,
              items: {
                type: "object",
                properties: {
                  label: { type: "string", example: "Highest Salary" },
                  value: { type: "number" },
                },
              },
            },
          },
        },
        SpanRecord: {
          type: "object",
          description:
            "Shape varies by spanType: agent/function/guardrail spans carry a " +
            "'name'; guardrail spans also carry 'triggered'; function spans carry " +
            "'input'/'output'; handoff spans carry 'fromAgent'/'toAgent'.",
          properties: {
            spanId: { type: "string" },
            spanType: {
              type: "string",
              enum: ["agent", "function", "generation", "guardrail", "handoff", "response"],
            },
            startedAt: { type: "string", format: "date-time", nullable: true },
            endedAt: { type: "string", format: "date-time", nullable: true },
            error: { type: "object", nullable: true },
          },
          additionalProperties: true,
        },
        TraceSummary: {
          type: "object",
          properties: {
            traceId: { type: "string" },
            name: { type: "string", example: "Employee Agent Stream" },
            sessionId: { type: "string", nullable: true },
            startedAt: { type: "string", format: "date-time" },
            endedAt: { type: "string", format: "date-time", nullable: true },
            durationMs: { type: "integer", nullable: true },
            spanCount: { type: "integer" },
            hasError: { type: "boolean" },
            triggeredGuardrails: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
        TraceRecord: {
          type: "object",
          properties: {
            traceId: { type: "string" },
            name: { type: "string" },
            sessionId: { type: "string", nullable: true },
            startedAt: { type: "string", format: "date-time" },
            endedAt: { type: "string", format: "date-time", nullable: true },
            spans: {
              type: "array",
              items: { $ref: "#/components/schemas/SpanRecord" },
            },
          },
        },
      },
      responses: {
        BadRequest: {
          description: "Invalid request parameters",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ApiError" } },
          },
        },
        NotFound: {
          description: "Resource not found",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ApiError" } },
          },
        },
        ServerError: {
          description: "Unexpected server error",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ApiError" } },
          },
        },
      },
    },
  },
  // glob (used internally by swagger-jsdoc) treats backslashes as escape
  // characters, not path separators — path.join()'s native Windows
  // backslashes silently match zero files unless normalized to forward
  // slashes first.
  apis: [path.join(__dirname, "../routes/*.ts").split(path.sep).join("/")],
};

export const swaggerSpec = swaggerJsdoc(options);
