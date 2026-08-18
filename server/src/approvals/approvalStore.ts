export interface ApprovalRecord {
  approvalId: string;
  sessionId: string;
  toolName: string;
  toolArguments: string | undefined; // JSON string, as the SDK gives it
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
  toolArguments: string | undefined;
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

// Capped, in-memory — same trade-off as SessionStore/traceStore: does not
// survive a server restart, and is scoped to one process.
const MAX_APPROVALS = 200;

export class ApprovalStore {
  private approvals = new Map<string, ApprovalRecord>();
  private insertionOrder: string[] = [];

  create(record: ApprovalRecord) {
    this.approvals.set(record.approvalId, record);
    this.insertionOrder.push(record.approvalId);
    this.prune();
  }

  get(approvalId: string): ApprovalRecord | undefined {
    return this.approvals.get(approvalId);
  }

  resolve(
    approvalId: string,
    status: "approved" | "rejected",
    resolvedAt: string,
  ) {
    const record = this.approvals.get(approvalId);
    if (record) {
      record.status = status;
      record.resolvedAt = resolvedAt;
    }
  }

  list({
    sessionId,
    status,
  }: {
    sessionId?: string | undefined;
    status?: ApprovalRecord["status"] | undefined;
  } = {}): ApprovalSummary[] {
    const results: ApprovalSummary[] = [];
    for (let i = this.insertionOrder.length - 1; i >= 0; i--) {
      const record = this.approvals.get(this.insertionOrder[i]!);
      if (!record) continue;
      if (sessionId && record.sessionId !== sessionId) continue;
      if (status && record.status !== status) continue;
      results.push(summarize(record));
    }
    return results;
  }

  private prune() {
    while (this.insertionOrder.length > MAX_APPROVALS) {
      const oldest = this.insertionOrder.shift();
      if (oldest) this.approvals.delete(oldest);
    }
  }
}

export const approvalStore = new ApprovalStore();
