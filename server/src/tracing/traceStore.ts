export interface SpanRecord {
  spanId: string;
  spanType: string;
  startedAt: string | null;
  endedAt: string | null;
  error: { message: string; data?: Record<string, unknown> } | null;
  [key: string]: unknown;
}

export interface TraceRecord {
  traceId: string;
  name: string;
  sessionId: string | null;
  startedAt: string;
  endedAt: string | null;
  spans: SpanRecord[];
}

export interface TraceSummary {
  traceId: string;
  name: string;
  sessionId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  spanCount: number;
  hasError: boolean;
  triggeredGuardrails: string[];
}

function summarize(trace: TraceRecord): TraceSummary {
  const durationMs =
    trace.endedAt !== null
      ? new Date(trace.endedAt).getTime() - new Date(trace.startedAt).getTime()
      : null;

  return {
    traceId: trace.traceId,
    name: trace.name,
    sessionId: trace.sessionId,
    startedAt: trace.startedAt,
    endedAt: trace.endedAt,
    durationMs,
    spanCount: trace.spans.length,
    hasError: trace.spans.some((span) => span.error !== null),
    triggeredGuardrails: trace.spans
      .filter((span) => span.spanType === "guardrail" && span.triggered === true)
      .map((span) => String(span.name ?? "unknown")),
  };
}

// Capped, in-memory, mirrors the pattern already used by SessionStore for
// conversations. Data does not survive a server restart — this is a local
// dev/demo store, not a durability layer.
const MAX_TRACES = 200;

export class TraceStore {
  private traces = new Map<string, TraceRecord>();
  private insertionOrder: string[] = [];

  startTrace(traceId: string, name: string, sessionId: string | null, startedAt: string) {
    this.traces.set(traceId, {
      traceId,
      name,
      sessionId,
      startedAt,
      endedAt: null,
      spans: [],
    });
    this.insertionOrder.push(traceId);
    this.prune();
  }

  endTrace(traceId: string, endedAt: string) {
    const trace = this.traces.get(traceId);
    if (trace) trace.endedAt = endedAt;
  }

  addSpan(traceId: string, span: SpanRecord) {
    this.traces.get(traceId)?.spans.push(span);
  }

  get(traceId: string): TraceRecord | undefined {
    return this.traces.get(traceId);
  }

  list({
    sessionId,
    limit = 50,
  }: { sessionId?: string; limit?: number } = {}): TraceSummary[] {
    const summaries: TraceSummary[] = [];
    for (let i = this.insertionOrder.length - 1; i >= 0; i--) {
      const trace = this.traces.get(this.insertionOrder[i]!);
      if (!trace) continue;
      if (sessionId && trace.sessionId !== sessionId) continue;
      summaries.push(summarize(trace));
      if (summaries.length >= limit) break;
    }
    return summaries;
  }

  private prune() {
    while (this.insertionOrder.length > MAX_TRACES) {
      const oldest = this.insertionOrder.shift();
      if (oldest) this.traces.delete(oldest);
    }
  }
}

export const traceStore = new TraceStore();
