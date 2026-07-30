import type { AgentInputItem } from "@openai/agents";
export type ConversationRole = "user" | "assistant";

export interface ConversationMessage {
  role: ConversationRole;
  content: string;
  timestamp: Date;
}
