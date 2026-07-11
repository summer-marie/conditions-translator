# User Personas

## Status

Approved MVP user personas.

These personas represent the primary users considered during the design of the Conditions Translator MVP. They are intended to guide user experience decisions, workflow design, accessibility, and future feature development.

---

# Purpose

These personas help answer a simple question throughout development:

> "Who is this feature helping?"

They are not intended to represent every possible user. Instead, they represent the primary user groups the MVP is designed to support.

---

# Primary Persona 1 — User with Basic Supervision

## Profile

- Single supervision program
- One supervision document
- Typically 1–4 pages
- Limited special conditions
- Moderate technical experience

## Goals

- Understand supervision requirements.
- Read conditions in plain language.
- Quickly find answers without searching legal documents.

## Pain Points

- Legal wording is confusing.
- Doesn't know where information is located.
- Unsure whether they are interpreting the document correctly.

## User Stories

- As a user, I want to upload my supervision document so I can ask questions about it.
- As a user, I want explanations in plain language instead of legal terminology.
- As a user, I want every answer to identify where it came from in my document.

---

# Primary Persona 2 — User Managing Multiple Supervision Documents

## Profile

- Multiple supervision-related documents
- Conditions may span several documents
- Different agencies or programs
- Needs cross-document understanding

## Goals

- Ask questions using more than one document.
- Understand how multiple documents relate.
- Identify conflicting information.

## Pain Points

- Information is spread across multiple documents.
- Conditions are difficult to compare.
- Unsure which document contains the answer.

## User Stories

- As a user, I want to select multiple documents for one conversation.
- As a user, I want the AI to identify conflicting conditions without deciding which one controls.
- As a user, I want every answer to identify which document it used.

---

# Primary Persona 3 — User with Complex Supervision Requirements

## Profile

May have several active supervision requirements including:

- Treatment programs
- GPS monitoring
- Travel restrictions
- Curfews
- No-contact orders
- Employment requirements
- Drug testing
- Court-ordered programs

Typically has longer and more complex documentation.

## Goals

- Understand multiple related restrictions.
- Find specific conditions quickly.
- Reduce confusion caused by lengthy paperwork.

## Pain Points

- Large amount of documentation.
- Many overlapping conditions.
- Frequently updated paperwork.

## User Stories

- As a user, I want related conditions organized into understandable sections.
- As a user, I want to ask about one restriction without searching every page.
- As a user, I want the AI to explain uncertainty rather than guess.

---

# UX Persona — First-Time User

## Profile

- Recently received supervision paperwork.
- Never used the application.
- May have limited technical confidence.
- May be unfamiliar with legal terminology.

## Goals

- Understand what the application does.
- Successfully upload documents.
- Trust the AI responses.
- Feel confident using the application.

## Pain Points

- Doesn't know where to begin.
- Unsure whether uploads were successful.
- Doesn't understand how AI answers are generated.

## User Stories

- As a first-time user, I want the application to explain its purpose before I upload documents.
- As a first-time user, I want confirmation that each uploaded page scanned correctly.
- As a first-time user, I want to understand why the AI gave a particular answer.

---

# Design Validation Questions

When designing new features, ask:

- Does this help the Basic Supervision user?
- Does this improve the experience for users managing multiple documents?
- Does this simplify complex supervision requirements?
- Would a first-time user understand what to do next?
- Does this increase trust?
- Does this reduce confusion?
- Would removing this feature negatively impact one or more personas?

---

# Dependencies

Related Documents

- README
- 01_MVP_PRD.md
- 02_Architecture_Overview
- 06_AI_Safety_and_Persona
- 07_Launch_Readiness_Checklist
