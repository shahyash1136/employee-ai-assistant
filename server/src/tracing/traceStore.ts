import { db } from "../db/database.js";

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

// SQLite-backed, capped. Column set covers the stable span fields; everything
// else the processor summarizes (name, triggered, model, usage, handoff
// endpoints, ...) rides along in the `extra` JSON column and is spread back
// out on read, so SpanRecord looks identical to callers.
const MAX_TRACES = 200;

interface TraceRow {
  trace_id: string;
  name: string;
  session_id: string | null;
  started_at: string;
  ended_at: string | null;
}

interface SpanRow {
  span_id: string;
  trace_id: string;
  span_type: string;
  started_at: string | null;
  ended_at: string | null;
  error: string | null;
  extra: string;
}

const insertTrace = db.prepare(
  `INSERT INTO traces (trace_id, name, session_id, started_at, ended_at)
   VALUES (?, ?, ?, ?, NULL)
   ON CONFLICT(trace_id) DO NOTHING`,
);

const updateTraceEnd = db.prepare(
  `UPDATE traces SET ended_at = ? WHERE trace_id = ?`,
);

const insertSpan = db.prepare(
  `INSERT INTO spans (span_id, trace_id, span_type, started_at, ended_at, error, extra)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);

const selectTrace = db.prepare(`SELECT * FROM traces WHERE trace_id = ?`);

const selectSpans = db.prepare(
  `SELECT * FROM spans WHERE trace_id = ? ORDER BY id ASC`,
);

const selectTracesAll = db.prepare(
  `SELECT * FROM traces ORDER BY id DESC LIMIT ?`,
);

const selectTracesBySession = db.prepare(
  `SELECT * FROM traces WHERE session_id = ? ORDER BY id DESC LIMIT ?`,
);

const pruneTraces = db.prepare(
  `DELETE FROM traces
   WHERE id NOT IN (SELECT id FROM traces ORDER BY id DESC LIMIT ?)`,
);

const pruneSpans = db.prepare(
  `DELETE FROM spans WHERE trace_id NOT IN (SELECT trace_id FROM traces)`,
);

function rowToSpan(row: SpanRow): SpanRecord {
  const extra = row.extra
    ? (JSON.parse(row.extra) as Record<string, unknown>)
    : {};
  return {
    ...extra,
    spanId: row.span_id,
    spanType: row.span_type,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    error: row.error
      ? (JSON.parse(row.error) as SpanRecord["error"])
      : null,
  };
}

function rowToTrace(row: TraceRow): TraceRecord {
  return {
    traceId: row.trace_id,
    name: row.name,
    sessionId: row.session_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    spans: (selectSpans.all(row.trace_id) as unknown as SpanRow[]).map(rowToSpan),
  };
}

export class TraceStore {
  startTrace(
    traceId: string,
    name: string,
    sessionId: string | null,
    startedAt: string,
  ) {
    insertTrace.run(traceId, name, sessionId, startedAt);
    pruneTraces.run(MAX_TRACES);
    pruneSpans.run();
  }

  endTrace(traceId: string, endedAt: string) {
    updateTraceEnd.run(endedAt, traceId);
  }

  addSpan(traceId: string, span: SpanRecord) {
    const { spanId, spanType, startedAt, endedAt, error, ...extra } = span;
    insertSpan.run(
      spanId,
      traceId,
      spanType,
      startedAt ?? null,
      endedAt ?? null,
      error ? JSON.stringify(error) : null,
      JSON.stringify(extra),
    );
  }

  get(traceId: string): TraceRecord | undefined {
    const row = selectTrace.get(traceId) as TraceRow | undefined;
    return row ? rowToTrace(row) : undefined;
  }

  list({
    sessionId,
    limit = 50,
  }: { sessionId?: string; limit?: number } = {}): TraceSummary[] {
    const rows = (
      sessionId
        ? selectTracesBySession.all(sessionId, limit)
        : selectTracesAll.all(limit)
    ) as unknown as TraceRow[];
    return rows.map((row) => summarize(rowToTrace(row)));
  }
}

export const traceStore = new TraceStore();
