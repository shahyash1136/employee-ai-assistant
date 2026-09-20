import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CircleAlert, Menu, SendHorizontal, SquarePen, X } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ApprovalNotice } from "@/components/chat/approval-notice";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { DeleteChatDialog } from "@/components/chat/delete-chat-dialog";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useChat } from "@/hooks/use-chat";
import { useChatSessions } from "@/hooks/use-chat-sessions";
import type { ChatSessionSummary } from "@/types/api";
import type { SessionSeed } from "@/types/chat";

// Routes: /chat is a fresh conversation, /chat/:sessionId opens a saved one.
export function ChatPage() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { sessions, loading, error, refresh, remove } = useChatSessions();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChatSessionSummary | null>(
    null,
  );

  const openChat = (id: string) => {
    setDrawerOpen(false);
    navigate(`/chat/${id}`);
  };
  const newChat = () => {
    setDrawerOpen(false);
    navigate("/chat");
  };

  const deleteChat = async (session: ChatSessionSummary) => {
    try {
      await remove(session.sessionId);
      setPendingDelete(null);
      if (session.sessionId === sessionId) navigate("/chat", { replace: true });
    } catch (err) {
      // e.g. 409 while one of its requests is still waiting for approval.
      toast.error(err instanceof Error ? err.message : "Could not delete the chat.");
      setPendingDelete(null);
    }
  };

  const sidebar = (
    <ChatSidebar
      sessions={sessions}
      loading={loading}
      error={error}
      activeId={sessionId}
      onNewChat={newChat}
      onSelect={openChat}
      onDelete={setPendingDelete}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <Card className="hidden w-64 shrink-0 gap-0 py-0 md:flex">{sidebar}</Card>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-72 gap-0 p-0">
          <SheetHeader>
            <SheetTitle>Chats</SheetTitle>
            <SheetDescription className="sr-only">
              Your conversation history
            </SheetDescription>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      {/* Keyed by navigation so each conversation gets a clean instance and
          any in-flight request from the previous one is aborted. */}
      <ChatView
        key={location.key}
        sessionId={sessionId}
        onActivity={refresh}
        onOpenHistory={() => setDrawerOpen(true)}
        onNewChat={newChat}
      />

      <DeleteChatDialog
        session={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={deleteChat}
      />
    </div>
  );
}

interface ChatViewProps {
  sessionId: string | undefined;
  onActivity: () => void;
  onOpenHistory: () => void;
  onNewChat: () => void;
}

function ChatView({ sessionId, onActivity, onOpenHistory, onNewChat }: ChatViewProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const seed = (location.state as { seed?: SessionSeed } | null)?.seed;
  const chat = useChat({ sessionId, seed, onActivity });
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, waiting } = chat;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, waiting]);

  // Once the server has accepted the first message of a new chat, give it its
  // own URL so a refresh or a bookmark lands back on it. The current messages
  // travel along as a seed so the screen doesn't blank out while it reloads.
  const { started, sending } = chat;
  useEffect(() => {
    if (sessionId === undefined && started && !sending) {
      navigate(`/chat/${chat.sessionId}`, {
        replace: true,
        state: { seed: { messages, waiting } satisfies SessionSeed },
      });
    }
  }, [sessionId, started, sending, chat.sessionId, messages, waiting, navigate]);

  const canSend = draft.trim().length > 0 && !chat.sending;

  const submit = () => {
    if (!canSend) return;
    const text = draft.trim();
    setDraft("");
    void chat.send(text);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter inserts a newline. Ignore Enter mid-IME
    // composition so accepting a candidate doesn't send the message.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const isEmpty = messages.length === 0 && waiting.length === 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="md:hidden"
          onClick={onOpenHistory}
          aria-label="Open chat history"
        >
          <Menu />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">Chat</h1>
          <p className="truncate text-sm text-muted-foreground">
            Ask about employees, attendance, salaries, projects or HR policies.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="md:hidden"
          onClick={onNewChat}
          aria-label="New chat"
        >
          <SquarePen />
        </Button>
      </div>

      <Card className="min-h-0 flex-1 gap-0 py-0">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-4">
            {chat.loadingHistory ? (
              <div className="flex flex-col gap-4">
                <Skeleton className="h-10 w-1/2 self-end" />
                <Skeleton className="h-16 w-2/3" />
              </div>
            ) : isEmpty ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No messages yet. Ask a question to get started.
              </p>
            ) : (
              messages.map((m) => <MessageBubble key={m.id} message={m} />)
            )}
            {waiting.map((w) => (
              <ApprovalNotice key={w.approvalId} approval={w} />
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t p-3">
          {chat.error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{chat.error}</AlertDescription>
              <AlertAction>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={chat.dismissError}
                  aria-label="Dismiss error"
                >
                  <X />
                </Button>
              </AlertAction>
            </Alert>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send, Shift+Enter for a new line)"
              rows={1}
              className="max-h-40 min-h-9 resize-none"
              aria-label="Message"
            />
            <Button onClick={submit} disabled={!canSend} aria-label="Send message">
              <SendHorizontal />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
