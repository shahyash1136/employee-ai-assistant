# Documentation Changelog

Newest entry first. Each entry records what changed in `docs/` and the code commit it describes.

## 2026-10-10 — HR policy search (RAG) and the Policy Agent

- **Commit range:** `73c9b7b..225654c` (branch `main`; code change is `8e62f25` "Add HR policy RAG and policy agent")
- **Summary:** Documented the seventh specialist, the Postgres + pgvector policy store, and the ingestion script.
- **Files changed (21):**
  - Added: `server/src/agents/domains/policy.agent.ts`, `server/src/tools/policy.tool.ts`, `server/src/knowledge/{chunker,embedder,ingest}.ts`, `server/src/db/{vectorDb,knowledgeSchema}.ts`, `server/src/services/knowledgeRetrieval.service.ts`, `data/policies/*.md` (4 files)
  - Modified: `server/package.json`, `server/src/agents/orchestrator.agent.ts`, `server/src/agents/shared/createDomainAgent.ts`, `server/src/controllers/chat.controller.ts`, `server/src/guardrails/{inputSafety,sensitiveInfo,hallucination,toolMisuse}.guardrail.ts`, `server/src/guardrails/validators.ts`
- **Docs updated:**
  - New: `04-modules/policy-knowledge.md`
  - `03-ARCHITECTURE-AND-LIFECYCLE.md`: system context diagram; new sections 2.3 (Policy Knowledge components), 3.7 (ingestion script lifecycle), 4.5 (policy question flow); startup, continuous, shutdown, and error notes
  - `04-modules/`: `agents.md`, `tools.md`, `guardrails.md`, `server-bootstrap.md`, `database.md`, `observability.md`, `agent-runner.md`, `client-chat.md`
  - `00-OVERVIEW.md` (stack, diagram, `DATABASE_URL`, ingestion step), `01-READING-ORDER.md` (new Stage 10; later stages and rows renumbered), `02-FOLDER-STRUCTURE.md`, `05-CONCEPTS.md`, `06-DATA-AND-STATE.md` (new section 3; later sections renumbered), `07-GLOSSARY.md`, `08-SELF-CHECK.md` (questions 16 and 17)
  - `09-ISSUES-AND-OPEN-QUESTIONS.md`: removed the "branch is behind main" note and the stale-docs rows it explained; added B7, E9, R14 to R16, I19 to I21, new dead-code rows, gaps, and open questions
  - 67 `file:line` references shifted for the nine modified source files
- **Notes:**
  - Verified by running: `npm run ingest:policies -- --dry-run` (49 chunks from 4 documents). Not executed: embedding, Postgres queries, and the Policy Agent end to end.
  - `docs/`, `.claude/`, and the `.gitignore` edit are still uncommitted, so `lastDocumentedCommit` describes the code only.

## 2026-10-10 — Initial documentation generated

- **Commit:** `73c9b7b6f8010acc17632ef72fd544a74b100675` (branch `React-Application`)
- **Summary:** Initial documentation generated.
- **Docs created:** `00-OVERVIEW.md`, `01-READING-ORDER.md`, `02-FOLDER-STRUCTURE.md`, `03-ARCHITECTURE-AND-LIFECYCLE.md`, `05-CONCEPTS.md`, `06-DATA-AND-STATE.md`, `07-GLOSSARY.md`, `08-SELF-CHECK.md`, `09-ISSUES-AND-OPEN-QUESTIONS.md`, `.docs-meta.json`, and 19 module docs in `04-modules/` (13 server, 6 client).
- **Notes:**
  - `origin/main` is ahead of this commit by the HR-policy feature (`8e62f25`). It is not documented here.
  - The `*docs` line was removed from the root `.gitignore` (uncommitted) so `docs/` and `.claude/skills/update-docs/` can be tracked.
  - Created the `update-docs` skill for Claude Code at `.claude/skills/update-docs/SKILL.md`.
