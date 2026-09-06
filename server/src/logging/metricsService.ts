import { db } from "../db/database.js";

export interface Metrics {
  totalRequests: number;
  errorRate: number;
  averageDurationMs: number;
  requestsByStatus: Record<string, number>;
  requestsByPath: Array<{
    path: string;
    count: number;
    averageDurationMs: number;
  }>;
}

export function computeMetrics(): Metrics {
  const { count: totalRequests } = db
    .prepare(`SELECT COUNT(*) as count FROM request_logs`)
    .get() as { count: number };

  const { count: errorCount } = db
    .prepare(`SELECT COUNT(*) as count FROM request_logs WHERE status >= 400`)
    .get() as { count: number };
  const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

  const { avg } = db
    .prepare(`SELECT AVG(duration_ms) as avg FROM request_logs`)
    .get() as { avg: number | null };

  const statusRows = db
    .prepare(`SELECT status, COUNT(*) as count FROM request_logs GROUP BY status`)
    .all() as unknown as Array<{ status: number; count: number }>;
  const requestsByStatus = Object.fromEntries(
    statusRows.map((r) => [String(r.status), r.count]),
  );

  const pathRows = db
    .prepare(
      `SELECT path, COUNT(*) as count, AVG(duration_ms) as avgDuration
       FROM request_logs GROUP BY path ORDER BY count DESC LIMIT 20`,
    )
    .all() as unknown as Array<{
    path: string;
    count: number;
    avgDuration: number;
  }>;

  return {
    totalRequests,
    errorRate,
    averageDurationMs: avg ?? 0,
    requestsByStatus,
    requestsByPath: pathRows.map((r) => ({
      path: r.path,
      count: r.count,
      averageDurationMs: r.avgDuration,
    })),
  };
}
