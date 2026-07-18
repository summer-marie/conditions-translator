# Verity

Verity helps people understand supervision documents (probation, parole, and related paperwork) by translating them into plain language, using AI grounded only in the documents a user actually uploads.

The repository and codebase are still named `conditions-translator` — the product name Verity is used throughout the app itself.

## Features

- **No account required to start** — upload and work with documents in a temporary session; create an account later only if you want to keep them.
- **Document upload and OCR** — upload page images and extract text automatically.
- **OCR review and correction** — review the extracted text per page and correct it before accepting.
- **Automatic section organization** — finished documents are broken into logical sections instead of a flat page list.
- **Grounded AI chat** — ask questions and get answers sourced only from your uploaded, accepted document content, with citations back to the source page.
- **Account creation with workspace transfer** — signing up carries over everything built during a temporary session, with no re-upload required.
- **Installable app (PWA)** — Verity can be installed to a device home screen and launched like a native app.
- **Light and dark mode**, with a public marketing site (landing page, About, Terms, FAQ) alongside the authenticated app.

## How it works

1. Start without an account — a temporary session is created automatically.
2. Upload document pages; each page is run through OCR.
3. Review the extracted text per page and correct anything OCR got wrong, then accept the page.
4. Once all pages are accepted, finish the document — it's organized into sections and becomes available to the AI.
5. Ask questions in chat; answers are grounded only in the accepted text of documents you select, never general outside knowledge.
6. Optionally create an account at any point to save the session's work permanently — temporary sessions and their documents otherwise expire after a set retention window.

## Tech stack

- **Framework**: Next.js 16 (App Router) with React 19 and TypeScript
- **Database**: PostgreSQL (Neon) via Prisma ORM
- **Storage**: Vercel Blob for uploaded page images
- **AI**: OpenAI (OCR extraction, section generation, grounded chat)
- **Styling**: Tailwind CSS v4 with a token-based design system (light/dark mode)
- **Testing**: Vitest
- **Deployment**: Vercel, including a scheduled cleanup job (Vercel Cron) that enforces temporary-session retention

## Local development

```bash
git clone https://github.com/summer-marie/conditions-translator.git
cd conditions-translator
npm install
cp env.example .env.local   # fill in your database, OpenAI, and Blob credentials
npx prisma migrate deploy
npm run dev
```

Useful scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Current status

Verity is a working, actively developed MVP. The core flow — temporary sessions, upload, OCR with correction, sectioning, grounded chat, and account save/transfer — is implemented and tested end to end. Recent work has focused on the public-facing app experience (landing page and marketing pages, dark mode, responsive/visual polish) and PWA reliability, including a fix for an installed-app redirect loop and for signed-in users landing on the wrong page after a deep link. Ongoing work includes further UI refinement and expanded real-device OCR testing.
