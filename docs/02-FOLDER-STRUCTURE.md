# Folder Structure

Every tracked folder and important file, one line each. Files marked *(runtime)* are created when the app runs and are git-ignored.

```
employee-ai-assistant/
├── .gitignore                      Ignores node_modules, .env files, and the runtime SQLite files
├── .claude/
│   └── skills/update-docs/SKILL.md The /update-docs skill that keeps docs/ in sync with code changes
├── .vscode/
│   └── launch.json                 Debug config; points at runner.ts with Windows-style paths (stale, see 09)
│
├── data/                           Seed CSVs, HR policy documents, and the runtime SQLite database
│   ├── employees.csv               100 employees: identity, department, designation, status
│   ├── departments.csv             10 departments: name, head, budget
│   ├── attendance.csv              100 daily attendance rows
│   ├── salaries.csv                100 salary rows: base, bonus, CTC, currency
│   ├── performance.csv             100 yearly review rows: rating, promotion eligibility, comments
│   ├── projects.csv                100 project assignment rows: role, dates, allocation
│   ├── users.csv                   7 login accounts: username, bcrypt hash, role, linked employeeId
│   ├── policies/                   HR policy documents in markdown with frontmatter; the source for policy search
│   │   ├── leave-policy.md                 HR-POL-001
│   │   ├── work-from-home-policy.md        HR-POL-002
│   │   ├── code-of-conduct.md              HR-POL-003
│   │   └── expense-reimbursement-policy.md FIN-POL-001
│   └── app.db, app.db-wal, app.db-shm   (runtime) SQLite database and WAL sidecar files
│
├── docs/                           This documentation
│
├── server/                         Express API + agents
│   ├── package.json                Two scripts: `dev` (nodemon + tsx) and `ingest:policies`
│   ├── tsconfig.json               Strict NodeNext config; only `src/` is included
│   ├── .env                        (untracked) JWT_SECRET, OPENAI_API_KEY, DATABASE_URL
│   ├── scripts/                    Manual scenario scripts run with tsx; they call the real OpenAI API
│   │   ├── test-orchestrator.ts            Routing scenarios
│   │   ├── test-agent-scope.ts             Cross-domain question and hand-back scenarios
│   │   ├── test-scope-guardrail.ts         Off-topic input scenarios
│   │   ├── test-injection-guardrail.ts     Prompt-injection scenarios
│   │   ├── test-sensitive-info-guardrail.ts  Output-leak scenarios
│   │   ├── test-hallucination-guardrail.ts   Groundedness scenarios plus a trace-closure check
│   │   └── test-tool-misuse-guardrail.ts     Bad tool-argument scenarios
│   └── src/
│       ├── server.ts               Entry point: load env, register tracing, listen
│       ├── app.ts                  Express app: CORS, JSON, logger, public routes, auth, protected routes
│       ├── config/
│       │   └── openai.ts           Plain OpenAI client, used only for embeddings
│       ├── db/
│       │   ├── database.ts         Opens data/app.db, enables WAL, creates the six tables
│       │   ├── vectorDb.ts         Lazy Postgres connection pool for policy knowledge
│       │   └── knowledgeSchema.ts  Embedding model constants; creates the knowledge.chunks table (called by ingestion only)
│       ├── knowledge/              Policy ingestion pipeline
│       │   ├── chunker.ts          Splits a policy document into section-based chunks (pure function)
│       │   ├── embedder.ts         Turns texts into embedding vectors through the OpenAI API
│       │   └── ingest.ts           Entry point of `npm run ingest:policies`: chunk, embed, replace rows in one transaction
│       ├── openapi/
│       │   └── swagger.ts          OpenAPI base definition and shared schemas; scans routes/*.ts for @openapi comments
│       ├── middleware/
│       │   ├── authenticate.ts     Verifies the Bearer JWT and sets req.user
│       │   ├── authorize.ts        requireRole and requireOwnRecordOrRole
│       │   ├── httpLogger.ts       Logs every request to pino and to request_logs on response finish
│       │   └── rateLimiters.ts     loginLimiter (per IP) and chatLimiter (per user)
│       ├── routes/                 One Express router per resource, each with @openapi doc comments
│       │   ├── auth.route.ts       POST /auth/login
│       │   ├── chat.route.ts       POST /chat, GET /chat/sessions, GET and DELETE on /chat/:sessionId...
│       │   ├── approvals.route.ts  GET /approvals, POST /approvals/:approvalId/decision
│       │   ├── traces.route.ts     GET /traces, GET /traces/:traceId
│       │   ├── logs.route.ts       GET /logs
│       │   ├── metrics.route.ts    GET /metrics
│       │   ├── employee.routes.ts      GET /employees...
│       │   ├── attendance.routes.ts    GET /attendance...
│       │   ├── departments.route.ts    GET /departments
│       │   ├── salaries.routes.ts      GET /salaries...
│       │   ├── performance.routes.ts   GET /performance...
│       │   └── projects.routes.ts      GET /projects...
│       ├── controllers/            Request handlers, one file per router
│       │   ├── auth.controller.ts        login
│       │   ├── chat.controller.ts        The chat turn, plus session list, transcript, approvals, delete
│       │   ├── approvals.controller.ts   List approvals; decide one and resume the paused run
│       │   ├── traces.controller.ts      List and fetch traces
│       │   ├── logs.controller.ts        List request logs
│       │   ├── metrics.controller.ts     Return computed metrics
│       │   └── (attendance|departments|employee|performance|projects|salaries).controller.ts   Thin REST wrappers over the services
│       ├── services/               Data access over the CSVs, plus auth and policy retrieval
│       │   ├── csv.service.ts      Generic cached CSV reader
│       │   ├── auth.service.ts     Credential check, JWT issue and verify
│       │   ├── knowledgeRetrieval.service.ts   Vector similarity search over policy chunks
│       │   └── (attendance|department|employee|performance|project|salary).service.ts   Filters and aggregates per domain
│       ├── tools/                  Functions the LLM can call
│       │   ├── roleAccess.ts       Shared role helpers: denyEmployees, needsApprovalUnlessEmployee, isEmployee
│       │   ├── policy.tool.ts      search_hr_policies
│       │   └── (attendance|department|employee|performance|project|salary).tool.ts     Tool definitions per domain
│       ├── agents/
│       │   ├── orchestrator.agent.ts     Router agent (plain and structured) and the back-handoff wiring
│       │   ├── shared/
│       │   │   ├── createDomainAgent.ts      Factory that builds the plain and structured variants
│       │   │   └── instructionFragments.ts   Reusable prompt text
│       │   └── domains/
│       │       ├── (attendance|department|employee|performance|project|salary).agent.ts   Instructions and tool list per specialist
│       │       └── policy.agent.ts     The Policy Agent: answers only from retrieved policy passages
│       ├── guardrails/
│       │   ├── inputSafety.guardrail.ts      Scope + prompt-injection check on user input
│       │   ├── sensitiveInfo.guardrail.ts    Blocks answers that leak keys, prompts, tool names, stack traces
│       │   ├── hallucination.guardrail.ts    Blocks answers not supported by tool results
│       │   ├── toolMisuse.guardrail.ts       Validates tool arguments (employee ID, department ID, search query)
│       │   └── validators.ts                 The ID, search query, and date validators
│       ├── orchestrator/
│       │   └── runner.ts           Runs, pauses, and resumes the agent graph; the bridge between HTTP and the SDK
│       ├── conversation/
│       │   ├── conversation.service.ts   History API used by controllers
│       │   ├── session.store.ts          SQL for sessions and messages
│       │   ├── sessionId.ts              UUID validation for client-chosen session ids
│       │   └── types.ts                  ConversationMessage
│       ├── approvals/
│       │   └── approvalStore.ts    SQL for paused tool calls and their serialized run state
│       ├── logging/
│       │   ├── logger.ts           pino instance
│       │   ├── requestLogStore.ts  SQL for request_logs (capped at 1000)
│       │   └── metricsService.ts   Aggregates over request_logs
│       ├── tracing/
│       │   ├── registerTracing.ts            Adds the custom trace processor once
│       │   ├── structuredLoggingProcessor.ts Receives SDK trace and span events
│       │   └── traceStore.ts                 SQL for traces and spans (capped at 200 traces)
│       ├── types/
│       │   ├── user.ts                 UserRole, User, AuthTokenPayload
│       │   ├── express.d.ts            Adds `user` to Express's Request type
│       │   ├── structuredResponse.ts   zod schema for structured answers
│       │   └── (attendance|department|employee|performance|project|salary).ts   Domain model + raw CSV row type
│       └── utils/
│           └── safeToolExecute.ts  Wraps a tool's execute so errors become JSON strings
│
└── client/                         React single-page app
    ├── package.json                dev, build, lint, preview scripts
    ├── index.html                  Root element and the pre-paint theme script
    ├── vite.config.ts              React plugin, React Compiler, Tailwind plugin, the @ alias
    ├── components.json             shadcn/ui generator config
    ├── eslint.config.js            Lint rules; relaxes react-refresh for ui/
    ├── tsconfig*.json              Project references: app (src) and node (vite config)
    ├── .env.example                VITE_API_URL
    ├── README.md                   Client-focused readme; also the only place with full-stack setup steps
    ├── TESTING.md                  Manual test guide by role
    ├── public/favicon.svg
    └── src/
        ├── main.tsx                Mounts <App /> in StrictMode
        ├── App.tsx                 Providers and the route tree
        ├── index.css               Tailwind imports and theme tokens
        ├── pages/
        │   ├── login-page.tsx      Sign-in form
        │   ├── chat-page.tsx       Sidebar + ChatView (messages, composer)
        │   └── approvals-page.tsx  Pending approvals dashboard
        ├── components/
        │   ├── app-layout.tsx      Header, nav, user menu, <Outlet />
        │   ├── auth-provider.tsx   Session state derived from the stored JWT
        │   ├── protected-route.tsx Login and role gate for routes
        │   ├── theme-provider.tsx  Light / dark / system theme state
        │   ├── theme-toggle.tsx    Theme dropdown
        │   ├── tool-arguments.tsx  Renders a tool call's JSON arguments as key/value pairs
        │   ├── chat/
        │   │   ├── chat-sidebar.tsx        Conversation history grouped by day
        │   │   ├── message-bubble.tsx      One message, or the typing skeleton
        │   │   ├── markdown.tsx            react-markdown wrapper
        │   │   ├── approval-notice.tsx     "Waiting for approval" card
        │   │   └── delete-chat-dialog.tsx  Delete confirmation
        │   ├── approvals/
        │   │   ├── approvals-table.tsx     Pending rows with Approve / Reject
        │   │   └── reject-dialog.tsx       Optional rejection reason
        │   └── ui/                 shadcn-generated primitives (button, card, dialog, table, ...)
        ├── hooks/
        │   ├── use-auth.ts          AuthContext and useAuth
        │   ├── use-theme.ts         ThemeContext and useTheme
        │   ├── use-chat.ts          State and effects for one conversation
        │   ├── use-chat-sessions.ts Conversation list for the sidebar
        │   └── use-approvals.ts     Pending approvals list and the decide action
        ├── lib/
        │   ├── api.ts           All HTTP calls and SSE parsing
        │   ├── auth-storage.ts  Token in localStorage, with the reasoning
        │   ├── jwt.ts           Decode (not verify) a JWT, check expiry
        │   ├── roles.ts         APPROVER_ROLES, canReviewApprovals
        │   ├── format.ts        Tool name and date formatting, session grouping
        │   └── utils.ts         cn() class-name helper
        └── types/
            ├── api.ts           Response shapes mirrored from the server
            └── chat.ts          ChatMessage, WaitingApproval, SessionSeed
```

## Naming notes

- Route files are inconsistently named: some end in `.route.ts`, others in `.routes.ts`. Both mean the same thing.
- Server imports end in `.js` even though the files are `.ts`. That is required by `"moduleResolution": "NodeNext"` ([server/tsconfig.json:9-10](../server/tsconfig.json#L9-L10)).
- Client imports use the `@/` alias for `client/src/` ([client/vite.config.ts:14-16](../client/vite.config.ts#L14-L16)).
