# CLAUDE.md

## Purpose

This file defines how Claude Code should work on the Conditions Translator project.

Keep this file concise. Detailed product and architecture rules live in the project documentation.

---

# 1. Non-Negotiable Rules

Claude must:

- Read the project documentation before implementation.
- Ask for clarification whenever the task, requirements, or next step is unclear.
- Preserve the approved architecture unless an explicit architecture-change process is followed.
- Never change the PRD.
- Never bypass the `READY` document requirement.
- Never bypass ownership or authorization checks.
- Never expose server secrets.
- Never push or merge Git branches.
- Make all local commits.
- Use PowerShell commands only.
- Update `.gitignore` when new local, generated, temporary, or secret files are introduced.
- Keep commits small, logical, and descriptive.
- Check current official documentation before installing or configuring dependencies whose setup may have changed.

---

# 2. Required Reading Order

Before coding:

1. `README.md`
2. `docs/01_MVP_PRD.md`
3. `docs/02_Architecture_Overview.md`
4. Relevant subsystem specification
5. `docs/08_Conditions_Translator_Implementation_Roadmap.md`
6. Relevant risk and launch-readiness sections

Do not start implementation until the applicable specification has been reviewed.

---

# 3. Git Workflow

## Branches

Create a dedicated branch for each:

- phase
- feature
- test effort
- bug fix
- refactor
- rework
- documentation change
- chore

Use these prefixes:

```text
feat/
fix/
refactor/
test/
docs/
chore/
rework/
build/
ci/
```

Examples:

```text
feat/document-intake
test/prisma-ownership
fix/chat-session-expiry
refactor/ocr-service
docs/update-schema-spec
chore/configure-eslint
rework/account-transfer
```

Claude may create branches and make local commits.

Claude must not:

- push branches
- merge branches
- open or merge pull requests without explicit instruction

The user will push and merge through GitHub.

## Staging Discipline

- Stage files individually by name (`git add <file> <file> ...`). Never use `git add -A` or `git add .`.
- Only stage files that are actually in scope for the current task.
- After each commit, report which touched files were included and which untracked/modified files were deliberately left out, so leftover changes in the working tree are never mistaken for a staging failure.

---

# 4. Commit Rules

Use small, coherent commits.

Do not commit an entire phase or large feature as one oversized commit.

Use conventional prefixes:

```text
feat:
fix:
refactor:
test:
docs:
chore:
build:
ci:
perf:
style:
revert:
```

Examples:

```text
feat: add temporary document creation flow
test: cover exclusive document ownership constraints
fix: prevent expired sessions from loading documents
refactor: separate OCR validation from provider client
docs: update account ownership specification
chore: ignore generated local files
```

Commit messages must be:

- descriptive
- concise
- understandable to another developer or employer
- focused on one coherent change

A phase may contain many commits.

---

# 5. PowerShell-Only Commands

All commands must be written for PowerShell.

Do not provide Bash syntax unless explicitly requested.

Use PowerShell for:

- package installation
- file creation
- directory creation
- environment setup
- testing
- database commands
- Git commands
- local development
- build commands
- cleanup

Examples:

```powershell
npm install
npm run dev
npm run build
npm run test
npx prisma generate
npx prisma migrate dev
Copy-Item .env.example .env.local
New-Item -ItemType Directory -Path .claude\session-memory -Force
```

---

# 6. Dependency and Documentation Checks

Before installing or configuring important dependencies:

1. Read the relevant project specification.
2. Check current official documentation.
3. Confirm the integration pattern is current.
4. Explain any setup choice that differs from older examples.
5. Avoid relying on outdated syntax.

This is especially important for:

- Prisma
- Next.js
- authentication libraries
- OpenAI SDK
- Vercel Blob
- Neon
- testing frameworks
- build tooling

Do not install a dependency based only on memory when current setup details may have changed.

---

# 7. Architecture Boundaries

Claude must preserve these invariants:

- A Document is the central domain object.
- Pages belong to exactly one Document.
- A Document has exactly one owner:
  - user
  - or temporary session
- Only `READY` Documents are available to AI.
- Accepted page text is the factual source of truth.
- AI chat is temporary.
- Full chat history is not permanent.
- AI answers are grounded in selected READY Documents.
- General AI knowledge must not fill supervision gaps.
- Architecture changes require a separate Decision Log entry and explicit approval.

---

# 8. Package Scripts

Keep `package.json` scripts clear and easy to inspect.

Add scripts incrementally as functionality is implemented.

Suggested structure:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:schema": "vitest run tests/schema",
    "test:auth": "vitest run tests/auth",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:validate": "prisma validate"
  }
}
```

Do not add scripts that duplicate existing behavior without a clear reason.

---

# 9. Testing Expectations

Required for:

- schema and ORM changes
- authentication
- authorization and ownership
- document lifecycle
- deletion and cleanup
- security-sensitive code
- environment configuration
- temporary sessions

Strongly advised for:

- OCR
- AI prompts
- safety behavior
- section generation
- uploads
- dashboard
- multi-document chat

Optional for:

- documentation-only changes
- styling-only changes
- copy changes
- non-functional refactors

Always report:

- tests run
- tests passed
- tests failed
- tests not run
- known gaps

---

# 10. UI Rules

Current UI guidance is intentionally limited.

- Mobile-first.
- Must also work in desktop browsers.
- Prioritize functional flows before polish.
- Prefer one primary decision per screen where practical.
- Use clear loading, empty, success, and error states.
- Do not invent final styling or interaction patterns before wireframes exist.
- Add basic wireframes when a flow needs validation.
- Preserve readability, accessibility, and simple navigation.
- Avoid overbuilding the visual system before core logic is stable.

---

# 11. Clarification Rule

If Claude is unsure:

- stop
- explain what is unclear
- ask a focused clarification question
- do not guess at architecture
- do not invent requirements
- do not proceed silently

This applies to:

- unclear requirements
- conflicting documents
- uncertain implementation direction
- missing dependencies
- ambiguous acceptance criteria
- unclear test expectations

---

# 12. Local Session Memory

Use local memory files for long sessions and context handoff.

Repository location:

```text
.claude/
  session-memory/
    CURRENT_SESSION.md
    DECISIONS.md
    OPEN_QUESTIONS.md
    WORK_LOG.md
```

Required behavior:

- Read these files before resuming work in a new session.
- Update `CURRENT_SESSION.md` during long sessions.
- Record durable decisions in `DECISIONS.md`.
- Record unresolved issues in `OPEN_QUESTIONS.md`.
- Add concise chronological notes to `WORK_LOG.md`.
- Never store secrets, tokens, passwords, private document text, or sensitive user data.
- Keep entries concise.
- Update `.gitignore` based on whether each file should remain local or be committed.

Recommended policy:

Local only:
- `CURRENT_SESSION.md`
- `WORK_LOG.md`

May be committed when project-relevant:
- `DECISIONS.md`
- `OPEN_QUESTIONS.md`

---

# 13. AI Change Summary

For meaningful changes, report:

1. What changed?
2. Why was it changed?
3. Which specification guided the work?
4. What assumptions were made?
5. What tests were run?
6. What remains untested?
7. What should happen next?

---

# 14. Stop Conditions

Stop and ask before:

- changing architecture
- changing the PRD
- changing ownership behavior
- changing document lifecycle states
- changing AI grounding rules
- replacing a major framework or provider
- introducing permanent chat storage
- weakening authorization
- changing data-retention behavior
- installing a major dependency without checking current official documentation
