# Vercel Deployment Guide — Conditions Translator MVP

## 1. Purpose

This document explains how to deploy the current MVP to Vercel,
including environment configuration for:
- Neon Postgres
- Prisma
- Vercel Blob (private store, OIDC)
- OpenAI (OCR + sections + chat)

It is optimized for testing OCR with phone uploads in a Vercel
preview or production environment.

## 2. Prerequisites

- Vercel account (project created for this repo)
- Neon Postgres database provisioned
- Vercel Blob private store connected to the project
- OpenAI API key with access to gpt-5-mini (or configured model)
- Local `.env.local` available for dev

## 3. Environment Variables

Refer to `env.example` for the authoritative list.

On Vercel, ensure these are set:

- `DATABASE_URL` → Neon connection string
- `OPENAI_API_KEY`
- `OPENAI_OCR_MODEL` → e.g. `gpt-5-mini`
- `BLOB_STORE_ID` → populated by `vercel env pull` for dev and
  via project connection in Vercel for preview/prod
- Any session/auth secrets (cookies, encryption keys) required
  by your auth system

Never use `NEXT_PUBLIC_` for secrets.

## 4. Vercel Blob Setup (Private Store, OIDC)

- In Phase 4, Vercel Blob was assumed to be a private store
  using OIDC. Make sure:
  - The Blob store is connected to this Vercel project.
  - Server-side code uses the Blob SDK without static
    `BLOB_READ_WRITE_TOKEN` in production.
- For local dev:
  - Run `vercel env pull .env.local` to populate Blob credentials.
  - Do not commit `.env.local`.

## 5. Neon / Prisma

- Ensure migrations have been applied to the Neon database
  (e.g., `npx prisma migrate deploy`).
- Confirm Prisma client generation is working against Neon.

## 6. Build & Preview

- `npm run lint`
- `npm run test`
- `npm run build`

In Vercel:
- Set the build command and output directory according to Next.js defaults.
- Use Preview deployments for branch testing (e.g.,
  `feat/e2e-testing-stabilization`).

## 7. Mobile / Phone OCR Testing Workflow

Once a Vercel preview is live:

1. Open the preview URL on your phone.
2. Enter temporary mode.
3. Create and label a document.
4. Use your phone camera to upload page images:
   - Prefer clear, well-lit photos.
5. Run OCR:
   - Confirm previews and extracted text.
6. Accept pages.
7. Finish document.
8. Reach `READY`.
9. Ask grounded questions.
10. (Optionally) create an account, transfer documents, and
    repeat OCR flows from a signed-in session.

Record:
- OCR success/failure
- Latency
- Any 502/timeout behavior
- Differences between temporary vs signed-in flows

## 8. Phase 9 — Scheduled Cleanup (Cron)

`vercel.json` defines an hourly Vercel Cron Job hitting `/api/cron/cleanup` (see
`lib/cleanup/sweep.ts` and `app/api/cron/cleanup/route.ts`), which deletes expired
`ChatSession`s and, for each expired `TemporarySession`, cleans up its Documents (Blob images
then DB rows, reusing the Phase 8 deletion pipeline) before removing the session row itself.

Required Vercel env vars for this to work:

- `CLEANUP_JOB_SECRET` — the value the route checks against the incoming bearer token.
- `CRON_SECRET` — set to the **same value** as `CLEANUP_JOB_SECRET`. Vercel's Cron feature only
  auto-attaches `Authorization: Bearer <value>` when an env var literally named `CRON_SECRET`
  exists; the route itself only ever reads `CLEANUP_JOB_SECRET`. Setting both to the same value
  is what makes Vercel's automatic header match what the route expects.

To trigger the sweep manually (e.g. to verify before relying on the schedule), from PowerShell:

```powershell
Invoke-RestMethod -Uri "https://<your-deployment>/api/cron/cleanup" `
  -Method Post `
  -Headers @{ Authorization = "Bearer $env:CLEANUP_JOB_SECRET" }
```

The response is a JSON summary of counts only (no document/page/chat content).

## 9. Known Deployment Risks

- OCR latency/timeouts on very large phone images.
- Any remaining ownership-related bugs that only appear in
  signed-in preview sessions.
- Missing UI affordances for multiple documents in workspace.

Document any new deployment-specific findings in:
- `docs/TESTING_GUIDE.md` (deployment section)
- `.agent-memory/OPEN_QUESTIONS.md`