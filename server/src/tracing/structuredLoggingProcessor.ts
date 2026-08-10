import type {
  Span,
  SpanData,
  Trace,
  TracingProcessor,
  AgentSpanData,
  FunctionSpanData,
  GenerationSpanData,
  GuardrailSpanData,
  HandoffSpanData,
} from "@openai/agents";
import { traceStore, type SpanRecord } from "./traceStore.js";

// Maps traceId -> groupId (our sessionId) so span logs, which only carry a
// traceId, can still be correlated back to the chat session they belong to.
const traceSessionIds = new Map<string, string | null>();

function summarizeSpanData(data: SpanData): Record<string, unknown> {
  switch (data.type) {
    case "agent": {
      const d = data as AgentSpanData;
      return {
        name: d.name,
        handoffs: d.handoffs,
        tools: d.tools,
        outputType: d.output_type,
      };
    }
    case "function": {
      const d = data as FunctionSpanData;
      return { name: d.name, input: d.input, output: d.output };
    }
    case "generation": {
      const d = data as GenerationSpanData;
      return { model: d.model, usage: d.usage };
    }
    case "guardrail": {
      const d = data as GuardrailSpanData;
      return { name: d.name, triggered: d.triggered };
    }
    case "handoff": {
      const d = data as HandoffSpanData;
      return { fromAgent: d.from_agent, toAgent: d.to_agent };
    }
    default:
      return {};
  }
}

// Logs one structured JSON line per trace/span lifecycle event. Runs
// alongside the SDK's default processor (see registerTracing.ts) so the
// OpenAI dashboard export is unaffected.
export class StructuredLoggingProcessor implements TracingProcessor {
  async onTraceStart(trace: Trace): Promise<void> {
    traceSessionIds.set(trace.traceId, trace.groupId);
    const startedAt = new Date().toISOString();
    traceStore.startTrace(trace.traceId, trace.name, trace.groupId, startedAt);
    console.log(
      JSON.stringify({
        event: "trace_start",
        traceId: trace.traceId,
        name: trace.name,
        sessionId: trace.groupId,
      }),
    );
  }

  async onTraceEnd(trace: Trace): Promise<void> {
    traceStore.endTrace(trace.traceId, new Date().toISOString());
    console.log(
      JSON.stringify({
        event: "trace_end",
        traceId: trace.traceId,
        name: trace.name,
        sessionId: trace.groupId,
      }),
    );
    traceSessionIds.delete(trace.traceId);
  }

  async onSpanStart(_span: Span<any>): Promise<void> {}

  async onSpanEnd(span: Span<any>): Promise<void> {
    const data = span.spanData;
    const record: SpanRecord = {
      spanId: span.spanId,
      spanType: data.type,
      startedAt: span.startedAt,
      endedAt: span.endedAt,
      error: span.error,
      ...summarizeSpanData(data),
    };
    traceStore.addSpan(span.traceId, record);
    console.log(
      JSON.stringify({
        event: "span_end",
        sessionId: traceSessionIds.get(span.traceId) ?? null,
        traceId: span.traceId,
        ...record,
      }),
    );
  }

  async shutdown(_timeout?: number): Promise<void> {}

  async forceFlush(): Promise<void> {}
}
