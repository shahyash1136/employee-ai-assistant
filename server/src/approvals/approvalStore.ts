import { db } from "../db/database.js";

export interface ApprovalRecord {
  approvalId: string;
  sessionId: string;
  toolName: string;
  toolArguments: string | null; // JSON string, as the SDK gives it (or null)
  agentName: string;
  serializedState: string;
  format: "json" | "text";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt: string | null;
}

export interface ApprovalSummary {
  approvalId: string;
  sessionId: string;
  toolName: string;
  toolArguments: string | null;
  agentName: string;
  format: "json" | "text";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt: string | null;
}

function summarize(record: ApprovalRecord): ApprovalSummary {
  const { serializedState: _serializedState, ...summary } = record;
  return summary;
}

// SQLite-backed, capped. resolve() is an atomic conditional UPDATE so two
// concurrent decide requests can't both resume the same paused run.
const MAX_APPROVALS = 200;

interface ApprovalRow {
  approval_id: string;
  session_id: string;
  tool_name: string;
  tool_arguments: string | null;
  agent_name: string;
  serialized_state: string;
  format: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

const insertApproval = db.prepare(
  `INSERT INTO approvals
     (approval_id, session_id, tool_name, tool_arguments, agent_name,
      serialized_state, format, status, created_at, resolved_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

const selectApproval = db.prepare(
  `SELECT * FROM approvals WHERE approval_id = ?`,
);

const resolveApproval = db.prepare(
  `UPDATE approvals SET status = ?, resolved_at = ?
   WHERE approval_id = ? AND status = 'pending'`,
);

const pruneApprovals = db.prepare(
  `DELETE FROM approvals
   WHERE approval_id NOT IN (
     SELECT approval_id FROM approvals ORDER BY rowid DESC LIMIT ?
   )`,
);

function rowToRecord(row: ApprovalRow): ApprovalRecord {
  return {
    approvalId: row.approval_id,
    sessionId: row.session_id,
    toolName: row.tool_name,
    toolArguments: row.tool_arguments,
    agentName: row.agent_name,
    serializedState: row.serialized_state,
    format: row.format as "json" | "text",
    status: row.status as ApprovalRecord["status"],
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export class ApprovalStore {
  create(record: ApprovalRecord) {
    insertApproval.run(
      record.approvalId,
      record.sessionId,
      record.toolName,
      record.toolArguments,
      record.agentName,
      record.serializedState,
      record.format,
      record.status,
      record.createdAt,
      record.resolvedAt,
    );
    pruneApprovals.run(MAX_APPROVALS);
  }

  get(approvalId: string): ApprovalRecord | undefined {
    const row = selectApproval.get(approvalId) as ApprovalRow | undefined;
    return row ? rowToRecord(row) : undefined;
  }

  // Returns true only if THIS call flipped the row out of "pending". A caller
  // that gets false lost the race and must not proceed to resume the run.
  resolve(
    approvalId: string,
    status: "approved" | "rejected",
    resolvedAt: string,
  ): boolean {
    const result = resolveApproval.run(status, resolvedAt, approvalId);
    return Number(result.changes) > 0;
  }

  list({
    sessionId,
    status,
  }: {
    sessionId?: string | undefined;
    status?: ApprovalRecord["status"] | undefined;
  } = {}): ApprovalSummary[] {
    const clauses: string[] = [];
    const params: string[] = [];
    if (sessionId) {
      clauses.push("session_id = ?");
      params.push(sessionId);
    }
    if (status) {
      clauses.push("status = ?");
      params.push(status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = db
      .prepare(`SELECT * FROM approvals ${where} ORDER BY rowid DESC`)
      .all(...params) as unknown as ApprovalRow[];
    return rows.map(rowToRecord).map(summarize);
  }
}

export const approvalStore = new ApprovalStore();
