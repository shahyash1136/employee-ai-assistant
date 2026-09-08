import { db } from "../db/database.js";

export interface RequestLogEntry {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  userId: string | null;
  timestamp: string;
}

export interface RequestLogRecord extends RequestLogEntry {
  id: number;
}

// A more generous cap than traces/approvals (1000 vs 200) — these are much
// lighter rows, and higher volume by nature since EVERY request logs one.
const MAX_LOGS = 1000;

interface RequestLogRow {
  id: number;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  user_id: string | null;
  timestamp: string;
}

const insertLog = db.prepare(
  `INSERT INTO request_logs (method, path, status, duration_ms, user_id, timestamp)
   VALUES (?, ?, ?, ?, ?, ?)`,
);

const pruneLogs = db.prepare(
  `DELETE FROM request_logs
   WHERE id NOT IN (SELECT id FROM request_logs ORDER BY id DESC LIMIT ?)`,
);

const selectRecent = db.prepare(
  `SELECT * FROM request_logs ORDER BY id DESC LIMIT ?`,
);

const selectByUser = db.prepare(
  `SELECT * FROM request_logs WHERE user_id = ? ORDER BY id DESC LIMIT ?`,
);

function rowToRecord(row: RequestLogRow): RequestLogRecord {
  return {
    id: row.id,
    method: row.method,
    path: row.path,
    status: row.status,
    durationMs: row.duration_ms,
    userId: row.user_id,
    timestamp: row.timestamp,
  };
}

export class RequestLogStore {
  create(entry: RequestLogEntry) {
    insertLog.run(
      entry.method,
      entry.path,
      entry.status,
      entry.durationMs,
      entry.userId,
      entry.timestamp,
    );
    pruneLogs.run(MAX_LOGS);
  }

  list({
    userId,
    limit = 100,
  }: {
    userId?: string | undefined;
    limit?: number | undefined;
  } = {}): RequestLogRecord[] {
    const rows = (
      userId ? selectByUser.all(userId, limit) : selectRecent.all(limit)
    ) as unknown as RequestLogRow[];
    return rows.map(rowToRecord);
  }
}

export const requestLogStore = new RequestLogStore();
