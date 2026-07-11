# AGENTS.md

## Purpose

Universal operating rules for coding agents working on Conditions Translator.

This is the cross-agent source of truth for Codex, Cline-hosted models such as Z.AI, Copilot-compatible agents, and other repository-aware coding assistants.

Tool-specific instruction files may add workflow details but must not contradict this file.

---

## Non-Negotiable Rules

Every agent must:

- Read the project documentation before implementation.
- Ask for clarification whenever the task, requirements, or next step is unclear.
- Preserve the approved architecture unless an explicit architecture-change process is followed.
- Never change the PRD.
- Never bypass the `READY` Document requirement.
- Never bypass ownership or authorization checks.
- Never expose server secrets.
- Never push or merge Git branches.
- Create branches when the environment permits.
- Make small, logical local commits when the environment permits.
- Use PowerShell commands only.
- Update `.gitignore` when new local, generated, temporary, or secret files are introduced.
- Check current official documentation before installing or configuring dependencies whose setup may have changed.
- Report limitations when the environment cannot perform Git, testing, file, or package operations.

---

## Instruction Precedence

This is the single canonical documentation authority hierarchy for the project. Other project documents must refer to this hierarchy rather than restating it.

Follow instructions in this order:

1. Frozen PRD
2. Architecture Overview
3. Relevant subsystem specification
4. `AGENTS.md`
5. Tool-specific instructions such as `CLAUDE.md` or `.clinerules/`
6. Current task instructions

A current task may refine implementation details, but it may not silently override architecture, ownership, privacy, AI grounding, lifecycle states, retention, or security.

When sources conflict, the higher-authority source wins. Do not guess which source controls. Stop and ask for clarification.

---

## Required Reading Order

Before coding:

1. `README.md`
2. `docs/01_MVP_PRD.md`
3. `docs/02_Architecture_Overview.md`
4. Relevant subsystem specification
5. `docs/08_Conditions_Translator_Implementation_Roadmap.md`
6. Relevant sections of the Launch Readiness Checklist, Coding Risk Register, and Testing Guide

Do not begin implementation until the applicable specification has been reviewed.

---

## Git Workflow

Create a dedicated branch for each phase, feature, test effort, bug fix, refactor, rework, documentation change, or chore.

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

Agents may create local branches, make local commits, and inspect Git status/history.

Agents must not push, merge, force-push, delete remote branches, or merge pull requests.

The user handles pushing and GitHub merges.

If the environment cannot create branches or commits, report that clearly and provide the exact PowerShell commands the user should run.

---

## Commit Rules

Use small, coherent commits. Do not commit an entire phase or large feature as one oversized commit.

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

Commit messages must be descriptive, concise, understandable to another developer or employer, and focused on one coherent change.

A phase may contain many commits.

---

## PowerShell-Only Commands

All commands must be written for PowerShell.

Do not provide Bash syntax unless explicitly requested.

Examples:

```powershell
npm install
npm run dev
npm run build
npm run test
npx prisma generate
npx prisma migrate dev
Copy-Item .env.example .env.local
New-Item -ItemType Directory -Path .agent-memory -Force
```

---

## Dependency and Official Documentation Checks

Before installing or configuring important dependencies:

1. Read the relevant project specification.
2. Check current official documentation.
3. Confirm the integration pattern is current.
4. Explain any setup choice that differs from older examples.
5. Avoid relying on outdated syntax.
6. Record important setup decisions in session memory or the Decision Log.

This is especially important for Prisma, Next.js, authentication libraries, OpenAI SDK, Vercel Blob, Neon, testing frameworks, and build tooling.

---

## Architecture Invariants

Every agent must preserve:

- A Document is the central domain object.
- Pages belong to exactly one Document.
- A Document has exactly one owner: user or temporary session.
- Only `READY` Documents are available to AI.
- Accepted page text is the factual source of truth.
- AI chat is temporary.
- Full chat history is not permanent.
- AI answers are grounded in selected `READY` Documents.
- General AI knowledge must not fill supervision gaps.
- Architecture changes require a separate Decision Log entry, affected documentation updates, and explicit approval before implementation.

---

## Package Scripts

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

Do not add duplicate or confusing scripts without a clear reason.

---

## Testing Expectations

Required for:

- schema and ORM changes
- authentication
- authorization and ownership
- document lifecycle
- deletion and cleanup
- security-sensitive code
- environment configuration
- temporary session behavior

Strongly advised for:

- OCR
- AI prompts
- AI safety behavior
- section generation
- upload workflow
- dashboard
- multi-document chat

Optional for:

- documentation-only updates
- styling-only changes
- copy changes
- non-functional refactors

Always report tests run, tests passed, tests failed, tests not run, and known gaps.

---

## UI Rules

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

## Clarification Rule

If an agent is unsure:

- stop
- explain what is unclear
- ask a focused clarification question
- do not guess at architecture
- do not invent requirements
- do not proceed silently

---

## Shared Agent Memory

Use:

```text
.agent-memory/
  CURRENT_SESSION.md
  DECISIONS.md
  OPEN_QUESTIONS.md
  WORK_LOG.md
```

Required behavior:

- Read these files before resuming work.
- Update `CURRENT_SESSION.md` during long sessions.
- Record durable implementation decisions in `DECISIONS.md`.
- Record unresolved issues in `OPEN_QUESTIONS.md`.
- Add concise chronological notes to `WORK_LOG.md`.
- Never store secrets, tokens, passwords, private document text, or sensitive user data.
- Keep entries concise.

Recommended Git policy:

Local only:
- `CURRENT_SESSION.md`
- `WORK_LOG.md`

Potentially committed:
- `DECISIONS.md`
- `OPEN_QUESTIONS.md`

Claude-specific memory remains separate under `.claude/session-memory/`.

---

## Tool-Specific Files

Claude Code must also read `CLAUDE.md`.

Cline-hosted models, including Z.AI through Cline, must also follow `.clinerules/`.

A Copilot-specific bridge may exist at `.github/copilot-instructions.md` and must not contradict this file.

---

## Change Summary

For meaningful changes, report:

1. What changed?
2. Why was it changed?
3. Which specification guided the work?
4. What assumptions were made?
5. What tests were run?
6. What remains untested?
7. What should happen next?
8. Which commits were created?

---

## Stop Conditions

Stop and ask before:

- changing architecture
- changing the PRD
- changing ownership behavior
- changing lifecycle states
- changing AI grounding rules
- replacing a major framework or provider
- introducing permanent chat storage
- weakening authorization
- changing data-retention behavior
- installing a major dependency without checking current official documentation
