# Cline Project Rules

These rules apply to Cline-hosted models, including Z.AI models used through Cline.

Read and follow the repository-root `AGENTS.md` before making changes.

## Critical Rules

- Ask for clarification when requirements or next steps are unclear.
- Preserve the approved architecture.
- Never change the PRD.
- Never bypass `READY`, ownership, authorization, privacy, or AI grounding rules.
- Use PowerShell commands only.
- Create a dedicated branch when the environment permits.
- Make small, logical local commits when the environment permits.
- Never push or merge.
- Check current official documentation before configuring important dependencies.
- Update `.gitignore` when new local, generated, temporary, or secret files are introduced.
- Report tests run, tests not run, assumptions, files changed, and commits created.
- Use `.agent-memory/` for cross-agent handoff notes.
- Stop and ask before changing architecture, lifecycle, ownership, data retention, or major providers.

## Required Reading

1. `README.md`
2. `docs/01_MVP_PRD.md`
3. `docs/02_Architecture_Overview.md`
4. Relevant subsystem specification
5. `AGENTS.md`
6. Current task instructions

If any instructions conflict, stop and ask the user.
