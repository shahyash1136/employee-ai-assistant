import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AuthContext } from "@/hooks/use-auth";
import { api, setUnauthorizedHandler } from "@/lib/api";
import { authStorage } from "@/lib/auth-storage";
import { decodeToken, isExpired, type TokenPayload } from "@/lib/jwt";
import type { AuthUser } from "@/types/api";

interface Session {
  user: AuthUser;
  expiresAt: number; // ms since epoch
}

function toSession(payload: TokenPayload): Session {
  return {
    user: {
      userId: payload.userId,
      employeeId: payload.employeeId,
      username: payload.username,
      role: payload.role,
    },
    expiresAt: payload.exp * 1000,
  };
}

// The session is derived from the stored JWT itself, so a refresh restores the
// same identity/role the server signed — there's no second copy of "who am I"
// in storage to drift out of sync or be edited to say `admin`.
function restoreSession(): Session | null {
  const token = authStorage.getToken();
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload || isExpired(payload)) {
    authStorage.clear();
    return null;
  }
  return toSession(payload);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(restoreSession);

  const logout = useCallback(() => {
    authStorage.clear();
    setSession(null);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { token } = await api.auth.login(username, password);
    const payload = decodeToken(token);
    if (!payload) throw new Error("The server returned an invalid token.");
    authStorage.setToken(token);
    setSession(toSession(payload));
  }, []);

  // Any 401 from a protected call means the token is dead server-side.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      authStorage.clear();
      setSession(null);
      toast.error("Your session has expired. Please sign in again.");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Tokens last 1h with no refresh endpoint: log out when this one runs out
  // instead of waiting for the next request to fail.
  const expiresAt = session?.expiresAt;
  useEffect(() => {
    if (expiresAt === undefined) return;
    const timer = setTimeout(() => {
      authStorage.clear();
      setSession(null);
      toast.error("Your session has expired. Please sign in again.");
    }, Math.max(expiresAt - Date.now(), 0));
    return () => clearTimeout(timer);
  }, [expiresAt]);

  const value = useMemo(
    () => ({ user: session?.user ?? null, login, logout }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
