# Model Routing and Fallback

## Purpose

This document defines how the Conditions Translator selects AI models for each
task, how environment variables control those selections, and how agents should
handle model changes, fallbacks, and testing across phases.

---

## Model Roles

The application uses three distinct AI tasks, each with its own model variable:

| Variable | Task | Requirement |
|---|---|---|
| `OPENAI_OCR_MODEL` | Page image → raw text extraction | Vision-capable model required |
| `OPENAI_SECTION_MODEL` | Accepted page text → plain-language sections | Strong instruction-following |
| `OPENAI_CHAT_MODEL` | Document-grounded Q&A chat | Strong instruction-following, context window |

Each variable is set in `env.example` and loaded server-side via `lib/env.ts`.
No model name is ever hardcoded in application code.

---

## Why Three Separate Variables

- **OCR** requires a vision-capable model. Not all OpenAI models support image input.
- **Section generation** is a one-time batch task. A slower, more capable model
  is acceptable here because the user sees a processing screen.
- **Chat** is interactive. Latency matters more. A faster model may be preferred
  even if it is slightly less capable.

Keeping them separate lets you swap one without affecting the others and makes
it easy to compare models during testing without changing application code.

---

## Environment Variable Configuration

```env
# Vision-capable model for OCR (image input required)
OPENAI_OCR_MODEL="replace-with-vision-capable-model"

# Model for generating plain-language sections from accepted page text
OPENAI_SECTION_MODEL="replace-with-section-generation-model"

# Model for document-grounded chat
OPENAI_CHAT_MODEL="replace-with-chat-model"
```

Set real model names in `.env.local` before running OCR or chat features locally.
These values are never exposed to the browser.

---

## Model Selection Guidelines

When choosing values for each variable:

**`OPENAI_OCR_MODEL`**
- Must support image/vision input via the OpenAI API.
- Verify the model accepts `image_url` content blocks before selecting.
- Check current OpenAI documentation — vision-capable models change frequently.

**`OPENAI_SECTION_MODEL`**
- Does not require vision capability.
- Prioritize instruction-following quality over speed.
- Latency is less critical — user sees a processing screen.

**`OPENAI_CHAT_MODEL`**
- Does not require vision capability.
- Prioritize response speed and context window size.
- Must reliably follow the document-grounding safety rules in `06_AI_Safety_and_Persona.md`.

---

## Checking Current Model Availability

Before setting any model name, verify it against current OpenAI documentation:

- [OpenAI Models overview](https://platform.openai.com/docs/models)
- Do not rely on model names from memory or older docs — models are deprecated
  and renamed frequently.
- Verify vision support explicitly for `OPENAI_OCR_MODEL`.

---

## Fallback Behavior

The MVP does not implement automatic model fallback between providers. If a model
request fails:

- The request fails with an error.
- The user sees the appropriate retry UI (Re-upload Page, Retry section generation,
  or a chat error message).
- No silent fallback to a different model occurs.

Multi-provider OCR fallback is listed as a post-MVP feature in the MVP Cut Line
section of `08_Conditions_Translator_Implementation_Roadmap.md`.

---

## Testing Across Models

When comparing models during development:

1. Change the relevant env variable in `.env.local`.
2. Restart the dev server so `lib/env.ts` picks up the new value.
3. Run the relevant phase tests.
4. Document results in `.agent-memory/WORK_LOG.md` if the change affects
   a decision about which model to use in production.

Never commit a specific model name to the codebase — always use the env variable.

---

## Agent Instructions

- Never hardcode a model name in application code. Always read from the env variable.
- If a phase requires OCR and `OPENAI_OCR_MODEL` is not set or is a placeholder,
  stop and ask before proceeding.
- If OpenAI releases a new vision-capable model during development, update
  `.env.local` and document the change in `.agent-memory/WORK_LOG.md`.
- Do not implement multi-provider fallback unless explicitly requested — it is
  out of scope for MVP.

---

## Related Documents

- `env.example` — variable definitions and placeholders
- `lib/env.ts` — server-side env validation
- `06_AI_Safety_and_Persona.md` — chat grounding rules the model must follow
- `03_OCR_Specifications.md` — OCR task requirements
- `08_Conditions_Translator_Implementation_Roadmap.md` — phase build order
