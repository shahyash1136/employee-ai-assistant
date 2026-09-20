import type { AuthUser } from "@/types/api";

export interface TokenPayload extends AuthUser {
  iat: number;
  exp: number; // seconds since epoch
}

// Decodes (does NOT verify) a JWT payload. The client can't verify — it has no
// secret — and doesn't need to: this is only used to read the role/expiry for
// UI decisions. Every request is re-verified by the server.
export function decodeToken(token: string): TokenPayload | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    const payload = JSON.parse(json) as Partial<TokenPayload>;
    if (
      typeof payload.userId !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

export function isExpired(payload: TokenPayload): boolean {
  return payload.exp * 1000 <= Date.now();
}
