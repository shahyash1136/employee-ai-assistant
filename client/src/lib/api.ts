import { authStorage } from "@/lib/auth-storage";
import type {
  ApprovalStatus,
  ApprovalSummary,
  ChatSessionSummary,
  DecisionResponse,
  LoginResponse,
  PendingTool,
  ServerMessage,
} from "@/types/api";

// Set VITE_API_URL to override; the server allows http://localhost:5173 via
// CORS by default (CLIENT_ORIGIN on the server changes that).
const BASE_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// The auth layer registers this so a 401 anywhere (expired/invalid token)
// logs the user out, without api.ts importing React or the router.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  // Login is the one call that is legitimately unauthenticated, and a 401
  // there means "wrong password", not "session expired".
  auth?: boolean;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { method = "GET", body, signal, auth = true } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = authStorage.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(0, "Cannot reach the server. Is it running?");
  }

  if (!response.ok) {
    if (response.status === 401 && auth) onUnauthorized?.();
    throw new ApiError(response.status, await readErrorMessage(response));
  }
  return response;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: unknown };
    if (typeof data.message === "string") return data.message;
  } catch {
    /* non-JSON error body */
  }
  return `Request failed (${response.status})`;
}

async function request<T>(path: string, options: RequestOptions = {}) {
  const response = await send(path, options);
  return (await response.json()) as T;
}

// ---------------------------------------------------------------- auth

const login = (username: string, password: string) =>
  request<LoginResponse>("/auth/login", {
    method: "POST",
    body: { username, password },
    auth: false,
  });

// ---------------------------------------------------------------- chat

export type ChatSendResult =
  | { kind: "streamed" }
  // Non-SSE JSON reply, e.g. a guardrail decline.
  | { kind: "reply"; text: string }
  | { kind: "approval"; approvalId: string; pendingTool: PendingTool };

interface SendChatOptions {
  onToken: (token: string) => void;
  signal?: AbortSignal;
}

// POST /chat in default ("text") mode. The server answers with an SSE stream
// for normal replies but plain JSON for a paused approval or a guardrail
// decline, so we branch on Content-Type rather than assuming a stream.
async function sendChat(
  sessionId: string,
  message: string,
  { onToken, signal }: SendChatOptions,
): Promise<ChatSendResult> {
  const response = await send("/chat", {
    method: "POST",
    body: { sessionId, message },
    signal,
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const data = (await response.json()) as {
      requiresApproval?: boolean;
      approvalId?: string;
      pendingTool?: PendingTool;
      response?: unknown;
    };
    if (data.requiresApproval && data.approvalId && data.pendingTool) {
      return {
        kind: "approval",
        approvalId: data.approvalId,
        pendingTool: data.pendingTool,
      };
    }
    return {
      kind: "reply",
      text:
        typeof data.response === "string"
          ? data.response
          : JSON.stringify(data.response),
    };
  }

  await readTokenStream(response, onToken);
  return { kind: "streamed" };
}

// Parses `data: {"token":"..."}\n\n` events until `data: [DONE]`.
async function readTokenStream(
  response: Response,
  onToken: (token: string) => void,
) {
  if (!response.body) throw new ApiError(0, "The response had no body.");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += value;

    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const event = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const line = event.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const data = line.slice("data:".length).trim();
      if (data === "[DONE]") return;

      const parsed = JSON.parse(data) as { token?: string; error?: string };
      if (parsed.error) throw new ApiError(500, parsed.error);
      if (parsed.token) onToken(parsed.token);
    }
  }
}

const chatMessages = (sessionId: string, signal?: AbortSignal) =>
  request<{ success: true; data: ServerMessage[] }>(
    `/chat/${encodeURIComponent(sessionId)}/messages`,
    { signal },
  );

const chatSessions = (signal?: AbortSignal) =>
  request<{ success: true; data: ChatSessionSummary[] }>("/chat/sessions", {
    signal,
  });

const deleteChatSession = (sessionId: string) =>
  request<{ success: true }>(`/chat/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });

const chatApprovals = (sessionId: string, signal?: AbortSignal) =>
  request<{ success: true; data: ApprovalSummary[] }>(
    `/chat/${encodeURIComponent(sessionId)}/approvals`,
    { signal },
  );

// ----------------------------------------------------------- approvals

const listApprovals = (status: ApprovalStatus, signal?: AbortSignal) =>
  request<{ success: true; data: ApprovalSummary[] }>(
    `/approvals?status=${status}`,
    { signal },
  );

const decideApproval = (
  approvalId: string,
  approve: boolean,
  message?: string,
) =>
  request<DecisionResponse>(
    `/approvals/${encodeURIComponent(approvalId)}/decision`,
    { method: "POST", body: { approve, message } },
  );

export const api = {
  auth: { login },
  chat: {
    send: sendChat,
    messages: chatMessages,
    approvals: chatApprovals,
    sessions: chatSessions,
    deleteSession: deleteChatSession,
  },
  approvals: { list: listApprovals, decide: decideApproval },
};
