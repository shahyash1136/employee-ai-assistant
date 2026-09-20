import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { ApprovalSummary, ServerMessage } from "@/types/api";
import type { ChatMessage, SessionSeed, WaitingApproval } from "@/types/chat";

const POLL_INTERVAL_MS = 4000;

// Blank messages are skipped so a conversation saved with an empty assistant
// reply doesn't render as an empty bubble.
function toChatMessages(data: ServerMessage[]): ChatMessage[] {
  return data
    .map((m, i) => ({ id: `server-${i}`, role: m.role, content: m.content }))
    .filter((m) => m.content.trim().length > 0);
}

const EMPTY_REPLY_MESSAGE =
  "The assistant returned an empty response. Please try asking again.";

function toWaiting(a: ApprovalSummary): WaitingApproval {
  return {
    approvalId: a.approvalId,
    toolName: a.toolName,
    agentName: a.agentName,
    toolArguments: a.toolArguments,
  };
}

interface UseChatOptions {
  // From the URL (/chat/:sessionId). Undefined means a brand-new conversation.
  sessionId: string | undefined;
  seed?: SessionSeed | undefined;
  // Called after anything that changes the saved conversations (a send, a
  // resolved approval) so the history sidebar can refetch.
  onActivity: () => void;
}

// State for ONE conversation. The chat page remounts this per navigation, so
// switching chats is just a fresh instance; nothing here needs to reset.
export function useChat({ sessionId, seed, onActivity }: UseChatOptions) {
  // A new chat gets its id up front so the very first POST can carry it. The
  // server creates the session on that first message.
  const [draftId] = useState(() => crypto.randomUUID());
  const activeId = sessionId ?? draftId;

  const [messages, setMessages] = useState<ChatMessage[]>(seed?.messages ?? []);
  const [waiting, setWaiting] = useState<WaitingApproval[]>(seed?.waiting ?? []);
  const [loadingHistory, setLoadingHistory] = useState(
    sessionId !== undefined && !seed,
  );
  // True once the server has accepted a message for this conversation. The
  // page uses it to move a new chat onto its own /chat/:id URL.
  const [started, setStarted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reloadMessages = useCallback(
    async (id: string, signal?: AbortSignal) => {
      const { data } = await api.chat.messages(id, signal);
      setMessages(toChatMessages(data));
    },
    [],
  );

  // Load a saved conversation and any of its still-pending approvals. A new
  // chat has nothing to load.
  useEffect(() => {
    if (sessionId === undefined) return;
    const controller = new AbortController();
    (async () => {
      try {
        const [history, approvals] = await Promise.all([
          api.chat.messages(sessionId, controller.signal),
          api.chat.approvals(sessionId, controller.signal),
        ]);
        setMessages(toChatMessages(history.data));
        setWaiting(
          approvals.data.filter((a) => a.status === "pending").map(toWaiting),
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // 404: the conversation was deleted or never existed.
        setError(
          err instanceof ApiError && err.status === 404
            ? "This conversation no longer exists."
            : err instanceof Error
              ? err.message
              : "Failed to load the conversation.",
        );
      } finally {
        if (!controller.signal.aborted) setLoadingHistory(false);
      }
    })();
    return () => controller.abort();
  }, [sessionId]);

  // While something is paused, poll for the manager's decision. The reply the
  // resumed run produces is stored server-side only, so once a decision lands
  // we re-fetch the transcript to show it. Re-created whenever `waiting`
  // changes so the interval always compares against the current list.
  useEffect(() => {
    if (waiting.length === 0) return;
    const controller = new AbortController();

    const timer = setInterval(async () => {
      try {
        const { data } = await api.chat.approvals(activeId, controller.signal);
        const stillPending = data.filter((a) => a.status === "pending");
        const pendingIds = new Set(stillPending.map((a) => a.approvalId));
        const resolved = waiting.filter((w) => !pendingIds.has(w.approvalId));
        if (resolved.length === 0) return;

        for (const w of resolved) {
          const status = data.find((a) => a.approvalId === w.approvalId)?.status;
          toast.info(
            status === "rejected"
              ? `Your request (${w.toolName}) was rejected.`
              : `Your request (${w.toolName}) was approved.`,
          );
        }
        await reloadMessages(activeId, controller.signal);
        onActivity();
        // Also picks up a follow-up approval raised by the resumed run.
        setWaiting(stillPending.map(toWaiting));
      } catch {
        /* transient; try again on the next tick */
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [waiting, activeId, reloadMessages, onActivity]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const assistantId = crypto.randomUUID();
      setError(null);
      setSending(true);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: text },
        { id: assistantId, role: "assistant", content: "", pending: true },
      ]);

      const patchAssistant = (fn: (m: ChatMessage) => ChatMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));
      const dropAssistant = () =>
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));

      const controller = new AbortController();
      abortRef.current = controller;

      let receivedText = false;
      try {
        const result = await api.chat.send(activeId, text, {
          signal: controller.signal,
          onToken: (token) => {
            receivedText = true;
            patchAssistant((m) => ({
              ...m,
              pending: false,
              content: m.content + token,
            }));
          },
        });

        setStarted(true);
        if (result.kind === "approval") {
          dropAssistant();
          setWaiting((prev) => [
            ...prev,
            {
              approvalId: result.approvalId,
              toolName: result.pendingTool.name,
              agentName: result.pendingTool.agentName,
              toolArguments: result.pendingTool.arguments,
            },
          ]);
        } else if (result.kind === "reply" && result.text.trim() === "") {
          dropAssistant();
          setError(EMPTY_REPLY_MESSAGE);
        } else if (result.kind === "reply") {
          patchAssistant((m) => ({
            ...m,
            pending: false,
            content: result.text,
          }));
        } else if (!receivedText) {
          // The stream ended without a single token.
          dropAssistant();
          setError(EMPTY_REPLY_MESSAGE);
        } else {
          patchAssistant((m) => ({ ...m, pending: false }));
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Keep any partial text that streamed in; drop the empty placeholder.
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantId && m.content === "")),
        );
        patchAssistant((m) => ({ ...m, pending: false }));
        setError(
          err instanceof Error ? err.message : "Failed to send the message.",
        );
      } finally {
        setSending(false);
        onActivity();
      }
    },
    [activeId, onActivity],
  );

  return {
    sessionId: activeId,
    started,
    messages,
    waiting,
    loadingHistory,
    sending,
    error,
    dismissError: () => setError(null),
    send,
  };
}
