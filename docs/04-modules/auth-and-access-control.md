# Auth and Access Control

## Purpose and responsibility

Answer two questions for every request: **who is this?** (authentication) and **may they do this?** (authorization). It also throttles abuse with rate limits.

Access control in this project lives in **three layers**, and this module owns the first two:

1. HTTP middleware: is there a valid token, and does the role fit the route?
2. Rate limiters.
3. Tool-level role checks inside agent runs. Those are documented in [tools.md](tools.md#role-rules) but follow the same rules.

## Where it sits

Between Server Bootstrap and every protected router. See [Architecture 2.1](../03-ARCHITECTURE-AND-LIFECYCLE.md#21-server) and the login flow in [4.1](../03-ARCHITECTURE-AND-LIFECYCLE.md#41-user-logs-in).

## Key files, functions, types

| Item | Location | What it does |
| --- | --- | --- |
| `UserRole` | [types/user.ts:1](../../server/src/types/user.ts#L1) | `"employee" \| "manager" \| "admin"`. |
| `User` | [types/user.ts:3-9](../../server/src/types/user.ts#L3-L9) | A row of `users.csv`, including `passwordHash`. |
| `AuthTokenPayload` | [types/user.ts:12-17](../../server/src/types/user.ts#L12-L17) | What goes in the JWT and on `req.user`. Never the hash. |
| `Request.user` | [types/express.d.ts:3-9](../../server/src/types/express.d.ts#L3-L9) | Declaration merging that adds the optional `user` field to Express's `Request`. |
| `AuthService.validateCredentials` | [auth.service.ts:35-45](../../server/src/services/auth.service.ts#L35-L45) | Finds the user by exact username, bcrypt-compares the password. |
| `AuthService.issueToken` | [auth.service.ts:47-55](../../server/src/services/auth.service.ts#L47-L55) | Signs a 1-hour JWT. |
| `AuthService.verifyToken` | [auth.service.ts:57-63](../../server/src/services/auth.service.ts#L57-L63) | Returns the payload, or `null` for any failure. |
| `login` | [auth.controller.ts:4-31](../../server/src/controllers/auth.controller.ts#L4-L31) | `POST /auth/login` handler. |
| `authenticate` | [authenticate.ts:4-25](../../server/src/middleware/authenticate.ts#L4-L25) | Global middleware. Sets `req.user` or answers 401. |
| `requireRole` | [authorize.ts:4-19](../../server/src/middleware/authorize.ts#L4-L19) | Middleware factory: 403 unless the role is in the list. |
| `requireOwnRecordOrRole` | [authorize.ts:24-49](../../server/src/middleware/authorize.ts#L24-L49) | Middleware factory: elevated roles pass; others pass only if the URL's `:employeeId` is their own. |
| `loginLimiter` | [rateLimiters.ts:5-19](../../server/src/middleware/rateLimiters.ts#L5-L19) | 5 attempts per 15 minutes per IP. |
| `chatLimiter` | [rateLimiters.ts:25-37](../../server/src/middleware/rateLimiters.ts#L25-L37) | 10 requests per minute per user. |

## Who can call what (REST)

| Route | Rule | Where |
| --- | --- | --- |
| `POST /auth/login`, `GET /`, `/api-docs` | Public | [app.ts:35-47](../../server/src/app.ts#L35-L47) |
| `/employees/*`, `/departments`, `/projects/*` | Any signed-in user | No role middleware on these routers |
| `GET /attendance`, `/salaries`, `/salaries/highest`, `/salaries/average`, `/salaries/range`, `/performance`, `/performance/top` | manager, admin | e.g. [salaries.routes.ts:43](../../server/src/routes/salaries.routes.ts#L43) |
| `/attendance/employee/:employeeId`, `/attendance/percentage/:employeeId`, `/salaries/:employeeId`, `/performance/employee/:employeeId` | Own record, or manager/admin | e.g. [salaries.routes.ts:185-189](../../server/src/routes/salaries.routes.ts#L185-L189) |
| `/approvals/*`, `/traces/*`, `/logs`, `/metrics` | manager, admin | e.g. [approvals.route.ts:46](../../server/src/routes/approvals.route.ts#L46) |
| `/chat` and `/chat/sessions` | Any signed-in user | [chat.route.ts:58](../../server/src/routes/chat.route.ts#L58) |
| `/chat/:sessionId/*` | The session's owner only, whatever their role | [chat.controller.ts:245-270](../../server/src/controllers/chat.controller.ts#L245-L270) |

Note the last row: session access is by **ownership**, not role. An admin cannot read a manager's transcript through these endpoints.

## Non-obvious logic

### Fail-fast secret

```
const JWT_SECRET: string = process.env.JWT_SECRET ?? (() => { throw ... })();
```

([auth.service.ts:16-20](../../server/src/services/auth.service.ts#L16-L20)). The immediately-invoked arrow function only runs when the variable is undefined, and it throws during module import. The alternative, signing tokens with `undefined`, would produce tokens anyone could forge. The explicit `: string` annotation also means the rest of the file never deals with `string | undefined`.

### `verifyToken` swallows the reason

Expired, malformed, and wrongly-signed tokens all return `null` ([auth.service.ts:57-63](../../server/src/services/auth.service.ts#L57-L63)), and `authenticate` answers "Invalid or expired token" for all of them ([authenticate.ts:17-21](../../server/src/middleware/authenticate.ts#L17-L21)). The client treats any 401 the same way, so the distinction is not needed.

### The JWT payload is trusted as-is

`jwt.verify(...) as AuthTokenPayload` is a type cast, not a validation ([auth.service.ts:59](../../server/src/services/auth.service.ts#L59)). That is safe because only this server can sign tokens. It also means the role in the token is what counts for up to an hour: editing `users.csv` does not affect tokens already issued.

### Why two different rate-limit keys

- Login has no identity yet, so the key is the IP, passed through `ipKeyGenerator` so IPv6 addresses are grouped properly ([rateLimiters.ts:12](../../server/src/middleware/rateLimiters.ts#L12)).
- Chat runs after `authenticate`, so `req.user!.userId` is safe ([rateLimiters.ts:30](../../server/src/middleware/rateLimiters.ts#L30)). Per-IP would be wrong: an office shares one IP, and one person has several.

Both use custom `handler`s so a 429 has the same `{ success, message }` shape as other errors.

### `requireOwnRecordOrRole`

Three steps ([authorize.ts:28-48](../../server/src/middleware/authorize.ts#L28-L48)): no user means 401; an elevated role passes immediately; otherwise the URL parameter (default name `employeeId`) must equal the caller's own `employeeId` from the token. The comparison uses the token, never anything the client sends in a body.

### Login error messages do not leak

"User not found" and "wrong password" both become `null`, then one 401 message ([auth.controller.ts:13-18](../../server/src/controllers/auth.controller.ts#L13-L18)). An attacker cannot use the endpoint to discover valid usernames. Note that bcrypt is skipped for unknown users, so response time still differs slightly.

## Inputs, outputs, side effects, dependencies

- **Inputs:** `Authorization` header, login body, `JWT_SECRET`, `data/users.csv`.
- **Outputs:** `req.user`; 401, 403, 429 responses; a signed JWT.
- **Side effects:** in-memory rate-limit counters.
- **Depends on:** [Domain Data](domain-data.md) for `csvService`.
- **Used by:** every protected route; `req.user` is passed into agent runs as `context` by the [Chat API](chat-api.md).

## Why it is built this way, and trade-offs

- **Users in a CSV** keeps the project database-free for seed data. There is no registration, password change, or user management. Because `csvService` caches forever, editing `users.csv` needs a server restart; see [09](../09-ISSUES-AND-OPEN-QUESTIONS.md#inconsistencies).
- **Stateless JWT with no refresh and no revocation.** Simple, but logout is client-side only and a stolen token works until it expires.
- **In-memory rate limits** reset on restart and would not be shared across multiple server instances.
- **Role checks duplicated in two places** (routes and tools). The comment at [roleAccess.ts:4-5](../../server/src/tools/roleAccess.ts#L4-L5) acknowledges this. A change to a rule must be made in both.

## Source files covered

- `server/src/services/auth.service.ts`
- `server/src/controllers/auth.controller.ts`
- `server/src/routes/auth.route.ts`
- `server/src/middleware/authenticate.ts`
- `server/src/middleware/authorize.ts`
- `server/src/middleware/rateLimiters.ts`
- `server/src/types/user.ts`
- `server/src/types/express.d.ts`
- `data/users.csv`
