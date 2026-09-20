export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  // True from send until the first token (or full reply) arrives.
  pending?: boolean;
}

// A tool call in this conversation that is paused awaiting a manager/admin.
export interface WaitingApproval {
  approvalId: string;
  toolName: string;
  agentName: string;
  toolArguments: string | null;
}

// Carried through router state when a brand-new chat is first saved and the URL
// changes to /chat/:id, so the screen doesn't blank out and reload. It's only
// an initial render hint; the server copy always replaces it.
export interface SessionSeed {
  messages: ChatMessage[];
  waiting: WaitingApproval[];
}
