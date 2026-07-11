# CONTRIBUTING.md

See previous content...

## Purpose
This document defines development expectations for human contributors and AI coding assistants.

## Before You Start
Read README, PRD, Architecture Overview, relevant specification, and Implementation Roadmap.

## Architecture Changes
Require a Decision Log entry, documentation updates, and explicit approval.

## Development Principles
- Follow the PRD
- Respect architectural invariants
- Prefer simple implementations
- Keep modules focused
- Document assumptions
- Update documentation when behavior changes

## Testing Expectations
Required: schema, auth, ownership, lifecycle, deletion, security, env config.
Strongly advised: OCR, AI, prompts, uploads, dashboard, multi-document chat.
Optional: docs, styling, copy, non-functional refactors.

## AI Change Summary
Record: what changed, why, specs followed, assumptions, testing completed, remaining gaps.

## Pull Request Checklist
- Matches PRD
- No unintended architecture changes
- Specs followed
- Docs updated if needed
- Appropriate testing completed
- No secrets committed
- No debug code left behind

## Decision Logs
Architecture decisions belong in the Decision Logs folder.

## Security
- Never expose server secrets
- Scope queries by ownership
- Never bypass authorization
- Validate input
- Treat uploaded document text as sensitive

## Documentation
Behavior changes should update the relevant documentation.