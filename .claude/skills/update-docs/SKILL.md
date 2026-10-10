---
name: update-docs
description: Update the docs/ folder to reflect code changes since the last documented commit. Use when new code is added or changed, when the user says "update docs", "sync docs", or runs /update-docs.
---

# update-docs

Update the documentation in `docs/` incrementally so it matches the code. Do not regenerate it from scratch. All paths below are relative to the repository root (`git rev-parse --show-toplevel`), which may be above the current working directory.

## Steps

### 1. Read the metadata

Read `docs/.docs-meta.json` to get `lastDocumentedCommit` and `moduleMap`.

If the file is missing, stop and tell the user to run the full documentation prompt first.

`moduleMap` keys are source paths or globs; values are the owning module doc. Key syntax:

- an exact path, e.g. `server/src/app.ts`
- `dir/**` for everything under a folder
- `{a,b,c}` for alternatives, e.g. `server/src/routes/{logs,metrics,traces}.route.ts`

When several keys match a file, the most specific one (exact path over glob) owns it.

### 2. Find what changed

- `git diff --name-status <lastDocumentedCommit>..HEAD`
- Also include uncommitted changes from `git status --porcelain`
- Ignore `docs/`, lockfiles, build output, and generated files (`node_modules/`, `dist/`, `data/app.db*`).
- If nothing relevant changed, say so and stop.

### 3. Map each changed file to its owning doc(s) via `moduleMap`

- **Added files with no match:** decide whether they belong to an existing module or need a new `docs/04-modules/<module>.md`, and add the mapping.
- **Deleted files:** remove their references from all docs.
- **Renamed files:** update every path and `file:line` reference.

### 4. Read the changed code and the affected docs, then update ONLY the affected sections

- `04-modules/<module>.md` for changed logic, functions, types. Keep its "Source files covered" list current.
- `03-ARCHITECTURE-AND-LIFECYCLE.md` if components, connections, startup, flows, state transitions, or error handling changed. Update the affected Mermaid diagrams AND their numbered walkthroughs, and keep component names consistent across all diagrams.
- `02-FOLDER-STRUCTURE.md` for added, removed, or moved files or folders.
- `01-READING-ORDER.md` if new entry points or core files were added.
- `05-CONCEPTS.md` for any new library, pattern, or concept.
- `06-DATA-AND-STATE.md` for schema, type, or state changes (update the `erDiagram` too).
- `07-GLOSSARY.md` for new project-specific terms.
- `08-SELF-CHECK.md`: add 1–2 questions covering significant new functionality.
- `09-ISSUES-AND-OPEN-QUESTIONS.md`: add new issues, remove resolved ones.
- `00-OVERVIEW.md` only if the stack, setup, env vars, or architecture changed. Add any new module doc to its table of contents.

A change in one file often shifts line numbers for the rest of that file. For every changed source file, re-check all `file:line` references to it across `docs/`, not only the ones in the sections you edited.

### 5. Verify

- Every `file:line` reference in edited docs points to the right code.
- All relative links between docs still resolve.
- All edited Mermaid diagrams are valid and render on GitHub: labels with special characters are quoted, at most about 15 nodes per diagram.
- No documentation was written outside `docs/`.

### 6. Record the update

- Prepend an entry to `docs/CHANGELOG.md`: date, commit range, files changed, docs updated, one-line summary.
- Update `docs/.docs-meta.json`: `lastDocumentedCommit` = current HEAD, `lastUpdated` = now, `moduleMap` with any new mappings.

If the working tree had uncommitted changes that you documented, say so in the changelog entry, because `lastDocumentedCommit` cannot point at them.

### 7. Report back

In under 10 lines: which docs were updated, what's new, and any open questions.

## Rules

- Explain WHY over WHAT, use `file:line` references, no large code pastes.
- Write references as links that are both readable and clickable, matching the existing docs: `[path/to/file.ts:12-34](../path/to/file.ts#L12-L34)` (one more `../` from inside `04-modules/`).
- Never modify source code.
- Preserve existing content and tone; edit surgically rather than rewriting files.
- All output stays inside `docs/`.
- Only document what exists in the code. If something cannot be determined, add it under "Open questions" in `09-ISSUES-AND-OPEN-QUESTIONS.md` instead of guessing.
