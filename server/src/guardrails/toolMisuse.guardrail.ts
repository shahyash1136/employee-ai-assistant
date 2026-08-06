import {
  defineToolInputGuardrail,
  ToolGuardrailFunctionOutputFactory,
  type ToolInputGuardrailDefinition,
} from "@openai/agents";
import { isValidEmployeeId, isValidDepartmentId } from "./validators.js";

type FieldValidator = (value: unknown) => string | null;

export function createArgumentValidationGuardrail(
  name: string,
  validators: Record<string, FieldValidator>,
): ToolInputGuardrailDefinition {
  return defineToolInputGuardrail({
    name,
    run: async ({ toolCall }) => {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(toolCall.arguments || "{}");
      } catch {
        return ToolGuardrailFunctionOutputFactory.rejectContent(
          "The arguments provided for this tool call could not be parsed.",
        );
      }

      for (const [field, validate] of Object.entries(validators)) {
        const error = validate(args[field]);
        if (error) {
          return ToolGuardrailFunctionOutputFactory.rejectContent(error, {
            field,
            value: args[field],
          });
        }
      }

      return ToolGuardrailFunctionOutputFactory.allow();
    },
  });
}

// Pre-built, reusable across every tool that takes these fields.
export const employeeIdGuardrail = createArgumentValidationGuardrail(
  "Employee ID Format Guardrail",
  { employeeId: isValidEmployeeId },
);

export const departmentIdGuardrail = createArgumentValidationGuardrail(
  "Department ID Format Guardrail",
  { departmentId: isValidDepartmentId },
);
