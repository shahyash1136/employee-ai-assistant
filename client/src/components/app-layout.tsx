import { Bot, LogOut, MessageSquare, ShieldCheck } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { canReviewApprovals } from "@/lib/roles";
import { cn } from "@/lib/utils";

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    buttonVariants({ variant: isActive ? "secondary" : "ghost" }),
    "gap-1.5",
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null; // <ProtectedRoute> guarantees a user; narrows the type.

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <div className="mr-2 flex items-center gap-2 font-semibold">
            <Bot className="size-5" />
            <span className="hidden sm:inline">Employee AI Assistant</span>
          </div>

          <nav className="flex items-center gap-1">
            <NavLink to="/chat" className={navLinkClass}>
              <MessageSquare />
              Chat
            </NavLink>
            {canReviewApprovals(user.role) && (
              <NavLink to="/approvals" className={navLinkClass}>
                <ShieldCheck />
                Approvals
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" className="h-9 gap-2 px-2" />
                }
              >
                <Avatar size="sm">
                  <AvatarFallback>
                    {user.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm sm:inline">{user.username}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex items-center justify-between gap-2">
                    <span className="truncate">{user.username}</span>
                    <Badge variant="secondary" className="capitalize">
                      {user.role}
                    </Badge>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col p-4">
        <Outlet />
      </main>
    </div>
  );
}
