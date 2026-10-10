# Client App Shell

## Purpose and responsibility

Everything that wraps the pages: the HTML entry, the React root, global providers, the route table, the route guard, the header layout, and theming. It decides which page renders for a URL and what surrounds it.

## Where it sits

Top of the client. See [Architecture 2.2](../03-ARCHITECTURE-AND-LIFECYCLE.md#22-client) and the [client startup flow](../03-ARCHITECTURE-AND-LIFECYCLE.md#34-client-startup).

## Key files

| File | Role |
| --- | --- |
| [client/index.html](../../client/index.html) | Root `<div>`, pre-paint theme script, module script tag. |
| [client/src/main.tsx](../../client/src/main.tsx) | `createRoot(...).render(<StrictMode><App /></StrictMode>)`. |
| [client/src/App.tsx](../../client/src/App.tsx) | Providers and routes. |
| [client/src/components/protected-route.tsx](../../client/src/components/protected-route.tsx) | Login and role gate. |
| [client/src/components/app-layout.tsx](../../client/src/components/app-layout.tsx) | Header, nav, user menu, `<Outlet />`. |
| [client/src/components/theme-provider.tsx](../../client/src/components/theme-provider.tsx), [theme-toggle.tsx](../../client/src/components/theme-toggle.tsx), [hooks/use-theme.ts](../../client/src/hooks/use-theme.ts) | Theme state, UI, and context. |
| [client/vite.config.ts](../../client/vite.config.ts), `tsconfig*.json`, [eslint.config.js](../../client/eslint.config.js), [components.json](../../client/components.json) | Tooling. |

## The route tree

[App.tsx:14-33](../../client/src/App.tsx#L14-L33):

```
ThemeProvider
└─ BrowserRouter
   └─ AuthProvider
      ├─ /login                      → LoginPage
      ├─ ProtectedRoute              (must be signed in)
      │  └─ AppLayout                (header + Outlet)
      │     ├─ /chat/:sessionId?     → ChatPage
      │     └─ ProtectedRoute roles=[manager, admin]
      │        └─ /approvals         → ApprovalsPage
      ├─ *                           → redirect to /chat
      └─ Toaster
```

Routes without a `path` are **layout routes**: they render for their children and place the matched child at `<Outlet />`. Nesting is how the guard and the header apply to several pages without repeating them.

`/chat/:sessionId?` has an optional parameter, so one route serves both a new chat (`/chat`) and a saved one (`/chat/<uuid>`).

Provider order matters: `AuthProvider` sits inside `BrowserRouter`, although it does not use router hooks itself. `ThemeProvider` is outermost because even the login page is themed.

## Non-obvious logic

### `ProtectedRoute`

[protected-route.tsx:13-24](../../client/src/components/protected-route.tsx#L13-L24). Two checks, two redirects:

1. No user → `/login`, with the attempted location saved in router state as `from`.
2. A `roles` prop that does not include the user's role → `/chat`.

Otherwise it renders `<Outlet />`.

It is used twice, nested. The outer one checks login only; the inner one adds the role check for `/approvals`.

`LoginPage` always navigates to `/chat` after signing in ([login-page.tsx:37](../../client/src/pages/login-page.tsx#L37)). The saved `from` location is never read, so a deep link to `/approvals` or `/chat/<id>` is lost on login.

This guard is for user experience. A user who edits their role in dev tools can render the Approvals page, but every API call it makes is refused by the server with 403.

### `AppLayout`

[app-layout.tsx:27-99](../../client/src/components/app-layout.tsx#L27-L99). The header shows the Approvals link only when `canReviewApprovals(user.role)` is true ([app-layout.tsx:51-56](../../client/src/components/app-layout.tsx#L51-L56)). The avatar shows the first two letters of the username.

`if (!user) return null` on [line 30](../../client/src/components/app-layout.tsx#L30) can never be hit at runtime because `ProtectedRoute` is its parent. It is there so TypeScript knows `user` is non-null below.

Logout calls `logout()` and then navigates explicitly ([app-layout.tsx:32-35](../../client/src/components/app-layout.tsx#L32-L35)). Even without the navigate call, the guard would redirect once `user` became `null`.

`DropdownMenuTrigger render={<Button ... />}` is the Base UI way to say "use this element as the trigger" (other libraries call it `asChild`).

The outer `h-dvh flex flex-col` plus `min-h-0` on `<main>` is what lets the chat page scroll its message list while the header and composer stay put.

### Theme: no flash on load

Three pieces cooperate:

1. **Before React:** an inline script in `index.html` reads `localStorage["employee-ai.theme"]` and adds the `dark` class to `<html>` if the stored value is `dark`, or is `system`/missing and the OS prefers dark ([index.html:8-22](../../client/index.html#L8-L22)). Because it runs synchronously in `<head>`, the first paint already has the right colours.
2. **In React:** `ThemeProvider` holds the user's choice (`light`, `dark`, `system`) in state, initialised from storage ([theme-provider.tsx:17-27](../../client/src/components/theme-provider.tsx#L17-L27), [theme-provider.tsx:38](../../client/src/components/theme-provider.tsx#L38)).
3. **Following the OS:** `useSyncExternalStore(subscribeToSystem, getSystemDark)` subscribes to the `prefers-color-scheme` media query ([theme-provider.tsx:30-39](../../client/src/components/theme-provider.tsx#L30-L39)). When the OS switches, React re-renders and `resolvedTheme` changes.

An effect then keeps the `dark` class and `color-scheme` style on `<html>` in sync ([theme-provider.tsx:46-50](../../client/src/components/theme-provider.tsx#L46-L50)).

The storage key string appears twice: in `index.html` (plain script, cannot import) and as `THEME_STORAGE_KEY` ([use-theme.ts:13](../../client/src/hooks/use-theme.ts#L13)). A comment in the HTML says to keep them in sync.

`theme` is what the user picked; `resolvedTheme` is what is applied. The toggle's icon uses `resolvedTheme`, the check mark uses `theme` ([theme-toggle.tsx:18-19](../../client/src/components/theme-toggle.tsx#L18-L19), [theme-toggle.tsx:35](../../client/src/components/theme-toggle.tsx#L35)).

### Context files are split from provider files

`use-auth.ts` and `use-theme.ts` export the context object and the hook; the provider components live in `components/`. This satisfies the `react-refresh/only-export-components` lint rule, which wants component files to export only components so hot reload works reliably.

### Tooling notes

- **React Compiler** runs as a Babel preset ([vite.config.ts:9-13](../../client/vite.config.ts#L9-L13)). It memoizes components and values automatically. The explicit `useCallback` and `useMemo` calls in the code are still needed where a stable identity is part of an effect's dependency list.
- **`@` alias** is declared twice, for Vite ([vite.config.ts:14-16](../../client/vite.config.ts#L14-L16)) and for TypeScript ([tsconfig.app.json:25](../../client/tsconfig.app.json#L25)).
- **`erasableSyntaxOnly`** ([tsconfig.app.json:22](../../client/tsconfig.app.json#L22)) forbids TypeScript features that emit code (enums, parameter properties). That is why `ApiError` assigns `this.status` by hand ([api.ts:17-24](../../client/src/lib/api.ts#L17-L24)).
- **`npm run build`** runs `tsc -b` first, so a type error fails the build.

## Inputs, outputs, side effects, dependencies

- **Inputs:** the URL, `localStorage`, the OS colour scheme.
- **Outputs:** the rendered page tree.
- **Side effects:** toggles a class on `<html>`; writes the theme to `localStorage`.
- **Depends on:** [Client Auth](client-auth.md) for `useAuth`, [Client UI Kit](client-ui-kit.md).

## Why it is built this way, and trade-offs

- **Guards as layout routes** keep pages free of auth checks; a page can assume it only renders for an allowed user.
- **Client-side routing with `BrowserRouter`** needs the host to serve `index.html` for every path. Vite's dev server does; a static host would need a rewrite rule.
- **No error boundary.** A render error anywhere unmounts the whole app to a blank page.
- **No code splitting.** All three pages ship in one bundle, which is fine at this size.

## Source files covered

- `client/index.html`
- `client/src/main.tsx`
- `client/src/App.tsx`
- `client/src/components/app-layout.tsx`
- `client/src/components/protected-route.tsx`
- `client/src/components/theme-provider.tsx`
- `client/src/components/theme-toggle.tsx`
- `client/src/hooks/use-theme.ts`
- `client/vite.config.ts`
- `client/package.json`
- `client/tsconfig.json`
- `client/tsconfig.app.json`
- `client/tsconfig.node.json`
- `client/eslint.config.js`
- `client/components.json`
- `client/.env.example`
- `client/.gitignore`
- `client/README.md`
- `client/TESTING.md`
