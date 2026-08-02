import { Agent, type Tool } from "@openai/agents";
import { StructuredResponseSchema } from "../../types/structuredResponse.js";
import { structuredOutputInstructions } from "./instructionFragments.js";

interface DomainAgentConfig {
  name: string;
  instructions: string;
  tools: Tool[];
}

export function createDomainAgent({
  name,
  instructions,
  tools,
}: DomainAgentConfig) {
  const agent = new Agent({
    name,
    instructions,
    tools,
  });

  const structuredAgent = new Agent({
    name: `${name} (Structured)`,
    instructions: instructions + structuredOutputInstructions,
    tools,
    outputType: StructuredResponseSchema,
  });

  return { agent, structuredAgent };
}
