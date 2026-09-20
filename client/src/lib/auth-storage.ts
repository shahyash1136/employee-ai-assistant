// WHY localStorage (and not an httpOnly cookie):
//
// An httpOnly cookie is the safer place for a session token because page
// JavaScript can never read it, so an XSS bug can't exfiltrate it. But it only
// works if the SERVER sets the cookie, and this API doesn't: /auth/login
// returns the JWT in the JSON body and every protected route reads it from an
// `Authorization: Bearer` header (middleware/authenticate.ts). A client-only
// SPA on a different origin has no way to create an httpOnly cookie itself, and
// switching to cookies would also mean changing the server to set/read them,
// adding CORS credentials handling, and adding CSRF protection — a backend
// redesign, not a frontend choice.
//
// So we store the token in localStorage and accept the trade-off: an XSS bug
// could read it. Mitigations that make this acceptable here:
//   - the token is short-lived (1h server-side, and we drop it on expiry);
//   - we render all model/user text as React text nodes (never innerHTML);
//   - the server, not this client, enforces roles on every request.
// If this ever ships beyond an internal tool, moving to server-set httpOnly
// SameSite cookies is the upgrade path.
//
// localStorage over sessionStorage: it survives a page refresh and new tabs.
// Every access is wrapped because storage can throw (private mode, blocked).

const TOKEN_KEY = "employee-ai.token";

export const authStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* session simply won't survive a refresh */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nothing to clear */
    }
  },
};
