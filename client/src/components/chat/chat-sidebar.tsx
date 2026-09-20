import { MoreHorizontal, SquarePen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { groupSessionsByDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChatSessionSummary } from "@/types/api";

interface ChatSidebarProps {
  sessions: ChatSessionSummary[];
  loading: boolean;
  error: string | null;
  activeId: string | undefined;
  onNewChat: () => void;
  onSelect: (sessionId: string) => void;
  onDelete: (session: ChatSessionSummary) => void;
}

// Conversation history, newest first and grouped by day, with a New chat
// button on top. Rendered in a fixed column on desktop and inside a Sheet on
// mobile.
export function ChatSidebar({
  sessions,
  loading,
  error,
  activeId,
  onNewChat,
  onSelect,
  onDelete,
}: ChatSidebarProps) {
  const groups = groupSessionsByDate(sessions);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="p-2 pb-0">
        <Button variant="outline" className="w-full justify-start" onClick={onNewChat}>
          <SquarePen />
          New chat
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Chat history" className="flex flex-col gap-4 p-2">
          {loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : error ? (
            <p className="px-2 text-sm text-destructive">{error}</p>
          ) : groups.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">
              No conversations yet.
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.label} className="flex flex-col gap-0.5">
                <h2 className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                  {group.label}
                </h2>
                {group.sessions.map((session) => (
                  <SessionRow
                    key={session.sessionId}
                    session={session}
                    active={session.sessionId === activeId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                  />
                ))}
              </section>
            ))
          )}
        </nav>
      </ScrollArea>
    </div>
  );
}

function SessionRow({
  session,
  active,
  onSelect,
  onDelete,
}: {
  session: ChatSessionSummary;
  active: boolean;
  onSelect: (sessionId: string) => void;
  onDelete: (session: ChatSessionSummary) => void;
}) {
  return (
    <div className="group/row relative">
      <Button
        variant={active ? "secondary" : "ghost"}
        className="w-full justify-start pr-9 font-normal"
        aria-current={active ? "page" : undefined}
        title={session.title}
        onClick={() => onSelect(session.sessionId)}
      >
        <span className="truncate">{session.title}</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Options for ${session.title}`}
              className={cn(
                "absolute top-1/2 right-1 -translate-y-1/2",
                // Always visible on touch; on desktop appear on hover/focus or
                // while the menu is open.
                "md:opacity-0 md:group-hover/row:opacity-100 md:focus-visible:opacity-100 md:aria-expanded:opacity-100",
              )}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(session)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
