import {
  Agent,
  type ModelSettings,
  type Tool,
  type RunContext,
} from "@openai/agents";
import { StructuredResponseSchema } from "../../types/structuredResponse.js";
import { structuredOutputInstructions } from "./instructionFragments.js";

type InstructionsInput<TContext> =
  | string
  | ((
      runContext: RunContext<TContext>,
      agent: Agent<TContext, any>,
    ) => Promise<string> | string);

interface DomainAgentConfig<TContext = unknown> {
  name: string;
  instructions: InstructionsInput<TContext>;
  tools: Tool<TContext>[];
  // Optional. Only the Policy agent sets it today (to force its first tool call).
  modelSettings?: ModelSettings;
}

// Appends the structured-output suffix regardless of whether instructions is
// a plain string or a dynamic function — the structured variant always needs
// the same base instructions plus this suffix.
function withSuffix<TContext>(
  instructions: InstructionsInput<TContext>,
  suffix: string,
): InstructionsInput<TContext> {
  if (typeof instructions === "string") {
    return instructions + suffix;
  }
  return async (runContext, agent) => {
    const base = await instructions(runContext, agent);
    return base + suffix;
  };
}

export function createDomainAgent<TContext = unknown>({
  name,
  instructions,
  tools,
  modelSettings,
}: DomainAgentConfig<TContext>) {
  // Spread so an unset value is omitted rather than passed as `undefined`
  // (exactOptionalPropertyTypes).
  const extra = modelSettings ? { modelSettings } : {};
  const agent = new Agent<TContext>({ name, instructions, tools, ...extra });

  const structuredAgent = new Agent<TContext, typeof StructuredResponseSchema>({
    name: `${name} (Structured)`,
    instructions: withSuffix(instructions, structuredOutputInstructions),
    tools,
    outputType: StructuredResponseSchema,
    ...extra,
  });

  return { agent, structuredAgent };
}
