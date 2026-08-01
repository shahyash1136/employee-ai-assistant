import { sessionStore } from "./session.store.js";
import type { ConversationMessage } from "./types.js";

export class ConversationService {
  getHistory(sessionId: string): ConversationMessage[] {
    return sessionStore.get(sessionId);
  }

  addUserMessage(sessionId: string, content: string) {
    const history = sessionStore.get(sessionId);

    history.push({
      role: "user",
      content,
      timestamp: new Date(),
    });

    sessionStore.save(sessionId, history);
  }

  addAssistantMessage(sessionId: string, content: string) {
    const history = sessionStore.get(sessionId);

    history.push({
      role: "assistant",
      content,
      timestamp: new Date(),
    });

    sessionStore.save(sessionId, history);
  }

  clearConversation(sessionId: string) {
    sessionStore.clear(sessionId);
  }
}

export const conversationService = new ConversationService();
