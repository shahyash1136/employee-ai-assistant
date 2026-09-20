import { Bot, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Markdown } from "@/components/chat/markdown";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/chat";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex items-start gap-2", isUser && "flex-row-reverse")}>
      <Avatar size="sm">
        <AvatarFallback>
          {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
        </AvatarFallback>
      </Avatar>

      <Card
        size="sm"
        className={cn(
          "max-w-[85%] gap-0 px-3 sm:max-w-[75%]",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {message.pending ? (
          // Typing indicator: the server runs the whole agent before it starts
          // streaming, so there can be a long gap before the first token.
          <div className="flex w-40 flex-col gap-2" aria-label="Assistant is thinking">
            <Skeleton className="h-3 w-full bg-foreground/10" />
            <Skeleton className="h-3 w-2/3 bg-foreground/10" />
          </div>
        ) : isUser ? (
          // Your own text is shown verbatim, not interpreted as markdown.
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <Markdown>{message.content}</Markdown>
        )}
      </Card>
    </div>
  );
}
