# Final Repository Structure Wireframe

## Recommended Final Structure

```text
conditions-translator/
│
├── README.md
├── CONTRIBUTING.md
├── CLAUDE.md
├── AGENTS.md
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
│
├── .github/
│   └── copilot-instructions.md          # Optional future Copilot bridge
│
├── .clinerules/
│   └── 01-project-rules.md              # Cline / Z.AI bridge
│
├── .agent-memory/
│   ├── CURRENT_SESSION.md               # Local only
│   ├── DECISIONS.md                     # May be committed
│   ├── OPEN_QUESTIONS.md                # May be committed
│   └── WORK_LOG.md                      # Local only
│
├── .claude/
│   └── session-memory/
│       ├── CURRENT_SESSION.md            # Local only
│       ├── DECISIONS.md                  # May be committed
│       ├── OPEN_QUESTIONS.md             # May be committed
│       └── WORK_LOG.md                   # Local only
│
├── docs/
│   ├── 01_MVP_PRD.md
│   ├── 02_Architecture_Overview.md
│   ├── 03_OCR_Specifications.md
│   ├── 04_Schema_Architecture.md
│   ├── 05_Account_Creation_and_Temporary_Access.md
│   ├── 06_AI_Safety_and_Persona.md
│   ├── 07_Launch_Readiness_Checklist.md
│   ├── 08_Conditions_Translator_Implementation_Roadmap.md
│   ├── 09_Coding_Risk_Register.md
│   ├── 10_Extended_Design_Reference.md
│   ├── User_Personas.md
│   ├── TESTING_GUIDE.md
│
├── app/
│   ├── api/
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── cleanup/
│   │   ├── documents/
│   │   └── ocr/
│   │
│   ├── dashboard/
│   ├── documents/
│   ├── upload/
│   ├── chat/
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── account/
│   ├── chat/
│   ├── documents/
│   ├── layout/
│   ├── ui/
│   └── upload/
│
├── lib/
│   ├── ai/
│   ├── auth/
│   ├── cleanup/
│   ├── database/
│   ├── documents/
│   ├── ocr/
│   ├── permissions/
│   ├── prompts/
│   ├── storage/
│   └── validation/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── public/
│
├── tests/
│   ├── ai/
│   ├── auth/
│   ├── cleanup/
│   ├── integration/
│   ├── ocr/
│   ├── schema/
│   └── ui/
│
├── types/
│   ├── ai.ts
│   ├── auth.ts
│   ├── documents.ts
│   ├── ocr.ts
│   └── safety.ts
│
└── scripts/
    ├── cleanup/
    ├── seed/
    └── testing/
```

---

# Placement Rules

## Repository Root

Keep these at the root because tools and contributors expect them there:

- `README.md`
- `CONTRIBUTING.md`
- `CLAUDE.md`
- `AGENTS.md`
- `.env.example`
- `.gitignore`
- `package.json`

## `docs/`

Keep product, architecture, specifications, personas, testing, and planning documents here.

## `.clinerules/`

Use for the Cline bridge so Z.AI through Cline receives critical instructions.

## `.agent-memory/`

Use for neutral cross-agent handoffs.

## `.claude/session-memory/`

Use only for Claude-specific continuity.

## `decision-logs/`

Use for approved architecture changes.

Do not rewrite history. Add a new decision record.

---

# Initial Setup Order

1. Create repository.
2. Initialize Next.js.
3. Move root instruction files into place.
4. Move documentation into `docs/`.
5. Create memory directories.
6. Update `.gitignore`.
7. Install dependencies after checking current official documentation.
8. Add package scripts.
9. Begin Phase 1 of the Implementation Roadmap.

---

# Recommended `.gitignore` Additions

```gitignore
.env
.env.local
.env.*.local

.agent-memory/CURRENT_SESSION.md
.agent-memory/WORK_LOG.md

.claude/session-memory/CURRENT_SESSION.md
.claude/session-memory/WORK_LOG.md

node_modules/
.next/
coverage/
dist/
*.log
```

Add framework- or tool-specific entries as dependencies are introduced.

---

# Notes

This wireframe is intentionally modular.

Directories should be created only when implementation reaches them.

Do not create empty complexity in advance unless it improves agent navigation.
