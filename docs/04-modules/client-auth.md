# Client Auth

## Purpose and responsibility

Know who is signed in, keep that true across page reloads, and end the session when the token stops being valid. It also supplies the role used for UI decisions.

## Where it sits

A feature module wrapped around the whole route tree. See [Architecture 2.2](../03-ARCHITECTURE-AND-LIFECYCLE.md#22-client), the [login flow](../03-ARCHITECTURE-AND-LIFECYCLE.md#41-user-logs-in), and the [client error flow](../03-ARCHITECTURE-AND-LIFECYCLE.md#62-client-side).

## Key files

| File | Role |
| --- | --- |
| [hooks/use-auth.ts](../../client/src/hooks/use-auth.ts) | `AuthContext`, `AuthContextValue` (`user`, `login`, `logout`), `useAuth()`. |
| [components/auth-provider.tsx](../../client/src/components/auth-provider.tsx) | The provider: session state and its effects. |
| [lib/auth-storage.ts](../../client/src/lib/auth-storage.ts) | `getToken`, `setToken`, `clear` over `localStorage`. |
| [lib/jwt.ts](../../client/src/lib/jwt.ts) | `decodeToken`, `isExpired`. |
| [lib/roles.ts](../../client/src/lib/roles.ts) | `APPROVER_ROLES`, `canReviewApprovals`. |
| [pages/login-page.tsx](../../client/src/pages/login-page.tsx) | The sign-in form. |

## The central idea: the token is the session

There is one stored value, the JWT. The user object in React state is **derived** from it by decoding the payload. Nothing else about the user is saved.

The comment at [auth-provider.tsx:26-28](../../client/src/components/auth-provider.tsx#L26-L28) gives the reason: with a separate stored "user" object, the two could drift apart, or someone could edit the stored role to `admin`. Deriving from the token means the UI shows whatever the server signed. (A user could still paste a forged token, but then every API call fails with 401 and they are logged out.)

`login()` follows the same rule. It ignores the `user` object in the login response and decodes the token instead ([auth-provider.tsx:48-54](../../client/src/components/auth-provider.tsx#L48-L54)).

## Non-obvious logic, step by step

### Restoring on load

`useState<Session | null>(restoreSession)` passes the function itself, so it runs once on first render ([auth-provider.tsx:41](../../client/src/components/auth-provider.tsx#L41)). `restoreSession` ([auth-provider.tsx:29-38](../../client/src/components/auth-provider.tsx#L29-L38)):

1. Read the token. None → signed out.
2. Decode it. Malformed or expired → clear storage, signed out.
3. Otherwise build `{ user, expiresAt }`.

Because this happens synchronously during the first render, there is no "loading auth" state and no flash of the login page for a signed-in user.

### Decoding without verifying

A JWT is three base64url parts joined by dots. `decodeToken` takes the middle part, converts base64url to base64, decodes it, and parses JSON ([jwt.ts:11-35](../../client/src/lib/jwt.ts#L11-L35)).

The `atob → percent-encode → decodeURIComponent` chain on [lines 16-21](../../client/src/lib/jwt.ts#L16-L21) is the standard way to decode UTF-8 correctly, since `atob` alone returns one character per byte and would garble non-ASCII usernames.

It then checks that `userId`, `username`, `role`, and `exp` have the right types before trusting the shape. `employeeId` is not checked.

The browser cannot verify the signature because it does not have the secret, and it does not need to: decoding is only used to choose what to display. The server verifies on every request.

### Three ways a session ends

| Trigger | Code | What the user sees |
| --- | --- | --- |
| The user clicks Log out | `logout` [auth-provider.tsx:43-46](../../client/src/components/auth-provider.tsx#L43-L46) | Redirect to `/login`. |
| The token's `exp` time arrives | `setTimeout` effect [auth-provider.tsx:68-77](../../client/src/components/auth-provider.tsx#L68-L77) | Toast "Your session has expired", redirect. |
| Any authenticated API call returns 401 | Handler registered in [auth-provider.tsx:57-64](../../client/src/components/auth-provider.tsx#L57-L64) | Same toast, redirect. |

All three do the same two things: clear storage and set the session to `null`. The redirect is not coded here; `ProtectedRoute` re-renders with no user and navigates.

**The timer.** The effect depends on `expiresAt` only, so it is set once per session. `Math.max(expiresAt - Date.now(), 0)` guards against a negative delay. Without this timer a user with an expired token would look signed in until their next request failed.

**The 401 handler.** `lib/api.ts` is plain TypeScript and should not import React state. So it exposes `setUnauthorizedHandler(fn)`, and the provider registers a callback on mount and removes it on unmount. This is dependency inversion in miniature: the low-level module calls a function the high-level module supplied.

### Why `localStorage` and not a cookie

The long comment at the top of [auth-storage.ts:1-22](../../client/src/lib/auth-storage.ts#L1-L22) is worth reading in full. In short:

- An `httpOnly` cookie is safer against XSS, but only the server can set one, and this API returns the token in JSON and reads it from an `Authorization` header.
- Moving to cookies would require server changes, CORS credentials, and CSRF protection.
- The accepted risk is that an XSS bug could read the token. Mitigations: one-hour lifetime, no raw HTML rendering anywhere, and server-side enforcement of roles.

Every storage call is wrapped in try/catch because `localStorage` can throw in private browsing or when blocked ([auth-storage.ts:26-48](../../client/src/lib/auth-storage.ts#L26-L48)). If writes fail, the session simply does not survive a refresh.

### Login page

[login-page.tsx:20-105](../../client/src/pages/login-page.tsx#L20-L105):

- An already signed-in user is redirected to `/chat` ([line 28](../../client/src/pages/login-page.tsx#L28)).
- The username is trimmed; the password is not.
- On success it navigates and does **not** reset `submitting`, because the component is about to unmount. On failure it shows the error and re-enables the button ([lines 34-45](../../client/src/pages/login-page.tsx#L34-L45)).
- The error text comes straight from the server: "Invalid username or password", or the rate-limit message after five tries.

### Roles on the client

`APPROVER_ROLES` mirrors the server's `requireRole(["manager", "admin"])` ([roles.ts:7](../../client/src/lib/roles.ts#L7)). It is used for the nav link and the route guard. It grants nothing; the comment says so plainly.

### `useAuth` throws outside the provider

[use-auth.ts:12-16](../../client/src/hooks/use-auth.ts#L12-L16). The context default is `null`, and the hook converts that into a clear error. This catches the mistake of rendering a consumer outside `<AuthProvider>` immediately.

The context value is wrapped in `useMemo` so consumers re-render only when the session actually changes ([auth-provider.tsx:79-82](../../client/src/components/auth-provider.tsx#L79-L82)).

## Inputs, outputs, side effects, dependencies

- **Inputs:** credentials; the stored token.
- **Outputs:** `user` (or `null`), `login`, `logout`.
- **Side effects:** reads and writes `localStorage["employee-ai.token"]`; a timer; toasts; registers a global callback in the API layer.
- **Depends on:** [Client API Layer](client-api.md).

## Why it is built this way, and trade-offs

- **Single source of truth** removes a whole class of sync bugs.
- **No refresh token.** After an hour the user signs in again, even mid-conversation. Conversations are server-side, so nothing is lost.
- **No cross-tab sync.** Logging out in one tab leaves others looking signed in until their next request or timer. Their token still works, because logout is client-side only.
- **Client-side logout only.** The server has no way to revoke a token.

## Source files covered

- `client/src/components/auth-provider.tsx`
- `client/src/hooks/use-auth.ts`
- `client/src/lib/auth-storage.ts`
- `client/src/lib/jwt.ts`
- `client/src/lib/roles.ts`
- `client/src/pages/login-page.tsx`
