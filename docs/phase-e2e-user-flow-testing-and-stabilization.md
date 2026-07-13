# Phase E2E — End-to-End User Flow Testing and Stabilization

## Purpose
This document defines the end-to-end testing and stabilization pass that runs after Phase 8 and before Phase 9 Cleanup, Reliability, and Demo Validation.

Its purpose is to validate that all already-implemented user-facing flows work together in realistic use before cleanup, retention, retry hardening, and demo-readiness work begin.

This is not a new feature phase. It is a structured testing and bug-fix pass focused on proving that the MVP behaves correctly as a complete user journey.

## Why this phase exists
By the end of Phase 8, the core product path should exist across:
- temporary entry and privacy notice
- document creation and labeling
- upload and page management
- OCR and page acceptance
- Finish Document and READY transition
- generated sections
- temporary AI chat
- account creation and ownership transfer
- dashboard access
- saved-document management
- deletion

Those systems may pass unit tests or targeted implementation checks while still failing in real browser use when a person clicks through the app from start to finish.

This phase exists to catch those integration and UX-level failures before Phase 9. It prevents cleanup and demo work from being built on top of a broken or partial happy path.

## Scope
This phase covers testing and stabilizing features that are already implemented.

Included:
- manual browser testing of the implemented flow
- realistic user interaction testing across forms and transitions
- reproduction and fixing of blockers found during testing
- retesting after fixes
- documenting known limitations that remain

Not included:
- adding deferred features
- broad redesign work
- rich visual polish unrelated to a tested failure
- new product scope beyond the MVP path
- cleanup/retention infrastructure that belongs to Phase 9

## Goal
Validate the complete implemented user flow through realistic interaction testing, fix blockers discovered during testing, and confirm the app is stable enough to proceed into cleanup, reliability, and demo validation.

## Build
- Run the app through the full implemented happy path in the browser.
- Test the product the way a real user would use it, not only through isolated API calls.
- Verify all major forms, buttons, transitions, loading states, and error states that already exist.
- Identify failures by exact step, reproduce them, and log them clearly.
- Fix blocking issues found during testing.
- Re-test the affected flow after each fix.
- Keep this phase focused on stabilization of existing functionality.

## Core flows to test
1. Enter the app and reach the correct starting route.
2. Accept the privacy/safety notice.
3. Create and label a new Document.
4. Upload one or more supported page images.
5. Remove, replace, or re-upload pages where supported.
6. Run OCR and review extracted text.
7. Accept valid pages and reject invalid ones.
8. Finish Document.
9. Reach PROCESSING and then READY.
10. Open and review generated sections.
11. Start temporary AI chat using READY Documents.
12. Ask grounded and follow-up questions.
13. Trigger the save flow.
14. Create an account or sign in.
15. Verify ownership transfer of temporary Documents.
16. Continue using the app after transfer.
17. Open dashboard and confirm saved-document visibility.
18. Open sections from the dashboard.
19. Start fresh chat from saved READY Documents.
20. Observe duplicate-label warning behavior where applicable.
21. Delete a saved Document.
22. Verify immediate post-delete access removal and expected UI behavior.

## Expected outputs
This phase should produce:
- a pass/fail record for each tested flow
- issue logs with reproduction steps
- bug-fix branches or commits for blockers discovered
- updated notes on known limitations
- confidence that the implemented MVP path works in realistic use

## Completion criteria
This phase is complete when:
- the core happy path can be run end-to-end without a blocker
- upload, OCR, READY transition, chat, account creation, ownership transfer, dashboard access, and deletion have all been tested in realistic browser use
- major failures found during testing have been fixed or explicitly documented
- testing results are recorded clearly enough for later handoff
- the app is stable enough that Phase 9 can focus on cleanup, retention, retry, and demo validation rather than first-discovery feature breakage

## Testing guidance
Suggested manual checks:
- homepage entry or redirect behavior
- temporary session/bootstrap behavior
- privacy notice interaction
- document creation and label validation
- upload form behavior with supported image types
- page-order and page-removal behavior
- OCR success path
- OCR failure or poor-quality rejection path
- page acceptance and re-upload behavior
- Finish Document flow
- PROCESSING and READY state transitions
- generated sections visibility and usefulness
- temporary AI chat grounding behavior
- follow-up question handling
- save/sign-up and sign-in flows
- account creation cancel path if implemented
- ownership transfer continuity
- dashboard ownership scope
- dashboard section viewing
- fresh chat from saved Documents
- duplicate-label warning behavior
- deletion and immediate disappearance from user-visible lists
- clarity of error messages shown to the user

## Failure logging template
Use this format for each issue found during testing:

### Issue title
- Area:
- Branch:
- Environment:
- Reproducible: Yes / No / Sometimes
- Severity: blocker / high / medium / low

#### Steps to reproduce
1. 
2. 
3. 

#### Expected result

#### Actual result

#### UI error text

#### Terminal/server output

#### Network details
- Route:
- Method:
- Status:

#### Notes
- Likely layer: UI / route / auth / upload / OCR / DB / storage / chat / transfer / dashboard / deletion
- Related files if known:

## Agent handoff guidance
When assigning work from this phase to a coding agent, provide:
1. The PRD.
2. The Architecture Overview.
3. Any relevant subsystem spec for the failing area.
4. This E2E testing document.
5. The latest issue log or reproduction notes.
6. The current implementation roadmap.

Require the agent to report:
- files changed
- assumptions
- tests run
- tests not run
- whether the bug was reproduced
- exact fix made
- remaining limitations
- whether the failing user flow now passes manually

## Relationship to later phases
This phase comes before Phase 9 Cleanup, Reliability, and Demo Validation.

Phase E2E is where already-built flows are tested and stabilized.
Phase 9 is where retention, cleanup jobs, retry hardening, sensitive-log review, and full demo validation are completed on top of a working product path.
