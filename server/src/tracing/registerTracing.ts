import { addTraceProcessor } from "@openai/agents";
import { StructuredLoggingProcessor } from "./structuredLoggingProcessor.js";

let registered = false;

// Additive: addTraceProcessor() appends to the existing pipeline, so the
// SDK's default BatchTraceProcessor -> OpenAI dashboard export keeps running
// unchanged alongside this one.
export function registerTracing(): void {
  if (registered) return;
  addTraceProcessor(new StructuredLoggingProcessor());
  registered = true;
}
