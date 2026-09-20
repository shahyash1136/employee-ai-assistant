// Request/response shapes mirrored from the server (server/src/routes/*.ts,
// controllers/*.ts, types/user.ts, approvals/approvalStore.ts).

export type UserRole = "employee" | "manager" | "admin";

export interface AuthUser {
  userId: string;
  employeeId: string;
  username: string;
  role: UserRole;
}

export interface LoginResponse {
  success: true;
  token: string;
  user: AuthUser;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalSummary {
  approvalId: string;
  sessionId: string;
  toolName: string;
  // JSON string as produced by the model SDK, or null.
  toolArguments: string | null;
  agentName: string;
  format: "json" | "text";
  status: ApprovalStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface PendingTool {
  name: string;
  arguments: string | null;
  agentName: string;
}

// Returned (as JSON, not SSE) by POST /chat and POST /approvals/:id/decision
// when a sensitive tool call is paused for human sign-off.
export interface ApprovalRequiredResponse {
  success: true;
  requiresApproval: true;
  approvalId: string;
  message: string;
  pendingTool: PendingTool;
}

export interface DecisionCompletedResponse {
  success: true;
  // Resumed run's final output: a string, or a structured object.
  response: unknown;
}

export type DecisionResponse =
  | ApprovalRequiredResponse
  | DecisionCompletedResponse;

export interface ServerMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ChatSessionSummary {
  sessionId: string;
  // First user message, truncated by the server.
  title: string;
  createdAt: string;
  updatedAt: string;
}
