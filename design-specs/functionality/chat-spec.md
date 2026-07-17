# AI Chat — Functionality Spec

## Overview
Chat interface where users ask questions about their uploaded documents. The AI responds with plain-language answers grounded in document content, with page-level citations. Chat is ephemeral — sessions are temporary and not permanently stored.

## Layout Structure

### Browser (1440px)
- Navbar (top, 64px): Same as Dashboard
- Sidebar (left, 240px): Multi-document selector with checkboxes (max 3 documents)
- Chat Area (center): Message thread with input bar at bottom
- Document Inspector (right, 320px, collapsible): Shows pages from selected documents, highlights cited pages

### Mobile (390px)
- Navbar (top, 56px): Back arrow + document name + Ready badge
- Document strip (below navbar): "SELECTED DOCUMENTS (N)" with document name pills, tap to expand picker
- Full-width chat: Messages fill screen
- Fixed input bar (bottom): Text input + send button, above keyboard when active

## Chat Session Rules (IMPORTANT)

### Ephemeral by Design
- Chat sessions are TEMPORARY — they are not permanently stored
- Sessions have an expiration (ChatSession.expiresAt)
- There is NO persistent chat history list or sidebar showing past conversations
- When user navigates away and returns, they start a fresh session
- Do NOT implement browsable chat history or saved conversations

### Multi-Document Support
- Users can select UP TO 3 documents with READY status per session (CHAT_MAX_DOCUMENTS = 3)
- Left sidebar (browser) shows all available documents with checkboxes
- Top strip (mobile) shows selected document name pills
- AI responses are grounded across ALL selected documents simultaneously
- Changing document selection starts a new session

## Chat Components

### Message Bubble — User
- Aligned right
- Deep-navy background (#0F1B33 light mode, #374151 dark mode)
- White text
- Rounded corners (12px, bottom-right squared)
- Timestamp below (meta color, caption size)

### Message Bubble — AI
- Aligned left
- Content surface background (#E6ECF3 light mode, #1F2937 dark mode)
- Standard text color
- Rounded corners (12px, bottom-left squared)
- AI avatar icon (small, left of first message in sequence)
- May contain:
  - Plain text paragraphs
  - Bullet lists
  - Citation pills (inline, clickable)

### Citation Pill
- Inline pill badge within AI message text
- Format: "Document Name, Page X" or just "Page X" if single document selected
- Informational blue text color (#2563EB) with blue background at 10% opacity
- On click (browser): Highlights the cited page in the Document Inspector panel
- On click (mobile): Scrolls to show page reference
- Citations are PAGE-LEVEL ONLY — no section names, no line numbers

### Cited Source Block
- Appears below AI message text
- Shows "Cited Source: Page 2, Page 3" (page numbers only)
- Links to view cited pages in inspector

### Typing Indicator
- Three animated dots in AI bubble placeholder
- Shows while AI is generating response
- Replaced by actual message when complete

### Input Bar
- Text input (multi-line, auto-expands up to 4 lines)
- Send button (deep navy primary #0F1B33, right side) — disabled when input is empty
- Placeholder: "Ask about your document..."
- Keyboard shortcut: Enter to send, Shift+Enter for new line

## Document Inspector Panel (Browser Right Panel)

### Header
- "DOCUMENT INSPECTOR" title
- Active document name + page count
- "READY" status badge

### Content
- "DOCUMENT PAGES" subheader
- List of pages numbered sequentially (Page 1, Page 2, etc.)
- Each page shows page number and first line of OCR text as preview
- Cited pages highlighted with informational blue (#2563EB) left border and "(cited)" label
- Non-cited pages have neutral styling

## AI Behavior and Grounding Rules

### Response Format
- AI always responds in plain language, avoiding jargon
- Responses reference specific pages with citations
- AI references documents by name when multiple are selected
- Example: "According to your probation order (Page 2), you must..."

### Citation Behavior
- Citations reference PAGE NUMBERS ONLY
- AI does NOT know section titles — sections are not in the model context
- AI does NOT support line-level citations — OCR text has no line offset tracking
- No "OCR source snippet" quote boxes — only page references
- ChatSourceReferenceSchema supports: documentNumber + pageNumbers only
- Multiple page citations allowed per statement
- Format in responses: "(Page X)" or "(Pages X-Y)"

### What AI Cannot Do
- Cannot cite by section name (sections not in model context)
- Cannot cite by line number (no line offset tracking in OCR pipeline)
- Cannot show verbatim OCR excerpts as quote blocks (no excerpt/offset in SectionSource)
- Cannot maintain conversation history across sessions (ephemeral design)

### Error States
- AI service unavailable: "I'm having trouble connecting. Please try again in a moment." + Retry button
- Document not processed: "This document hasn't been fully processed yet. Please wait for OCR to complete."
- Rate limited: "You've sent too many messages. Please wait a moment before trying again."
- No documents selected: "Select at least one document to start chatting."
- Too many documents: "You can select up to 3 documents at a time."

## Interactions

### Starting a Chat
1. User navigates to AI Chat
2. If no document selected: prompt "Select a document to chat about" with document picker showing READY documents
3. User checks 1-3 documents via checkboxes
4. Chat area activates with suggested questions:
   - "Summarize this document"
   - "What are the key terms?"
   - "Are there any deadlines or dates mentioned?"

### Sending a Message
1. User types question in input bar
2. Clicks send or presses Enter
3. User message appears immediately (right-aligned)
4. Typing indicator appears (left-aligned)
5. AI response streams in (text appears progressively)
6. Citation pills are interactive once message is complete

### Changing Documents
- Via left sidebar checkboxes (browser) — check/uncheck documents
- Via top strip "Tap to expand" (mobile) — opens document picker bottom sheet
- Changing selection clears the current session and starts fresh
- Only documents with READY status are selectable

## Accessibility
- Chat messages announced to screen readers as they arrive
- Citation pills have aria-label describing the page reference
- Input bar supports keyboard navigation
- Typing indicator has aria-live="polite" announcement
- Send button has clear aria-label
- Document checkboxes are keyboard accessible

## Performance
- Messages render incrementally (streaming)
- Input remains responsive during AI generation
- Document list loads from cached state (no refetch on each visit)
