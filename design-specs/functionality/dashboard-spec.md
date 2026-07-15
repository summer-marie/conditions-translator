# Dashboard — Functionality Spec

## Overview
The Dashboard is the primary workspace where users manage uploaded documents, monitor OCR/AI processing status, and navigate to individual document views.

## Layout Structure

### Browser (1440px)
- Navbar (top, 64px): App logo left, search bar center, user avatar + settings right
- Sidebar (left, 240px): Navigation links — Dashboard (active), Documents, AI Chat, Settings
- Main Content Area: Document grid/list with status indicators
- Right Panel (320px, collapsible): Quick document preview on hover/select

### Mobile (390px)
- Navbar (top, 56px): Hamburger menu left, app logo center, user avatar right
- Bottom Tab Bar: Dashboard, Documents, Chat, Settings icons
- Full-width content: Document cards in single-column stack

## Components & States

### Document Card
- Default: Shows document name, page count, upload date, status badge
- Hover: Elevate shadow, show quick-action buttons (View, Delete)
- Selected: Left border accent (3px navy), slightly elevated
- Status badges:
  - Uploaded — neutral gray
  - Processing OCR — teal badge with spinner
  - OCR Complete — emerald badge
  - AI Ready — emerald badge, solid
  - Error — crimson badge

### Upload Area
- Default: Dashed border container with upload icon + "Drop files or click to upload"
- Drag Over: Border turns emerald, background tints green (subtle)
- Uploading: Progress bar within card, percentage text
- Accepts: Images only (PNG, JPG, TIFF) — one image = one page of a document

### Search & Filter Bar
- Search input with magnifier icon (searches document names)
- Filter dropdown: Status (All, Processing, Complete, Error)
- Sort: Date uploaded (newest/oldest), Name (A-Z/Z-A)

## Interactions

### Document Upload Flow
1. User drops image files or clicks upload area
2. Each image becomes a "page" within a new or existing document
3. Progress bar shows upload status per file
4. On complete, card appears with "Uploaded" badge
5. OCR runs automatically — badge transitions to "Processing OCR"
6. When OCR finishes, badge becomes "OCR Complete"

### Document Selection
- Click card — navigates to Document Detail view
- Long press (mobile) or right-click (browser) — context menu (Rename, Delete, Re-run OCR)
- Multi-select with checkboxes for bulk actions (delete, re-process)

### Accept Pages Flow
- Inside Document Detail, user reviews each OCR'd page
- "Accept" button per page confirms OCR output is satisfactory
- Once all pages accepted — document status becomes "AI Ready"
- AI analysis generates plain-language sections from accepted pages

## Navigation Rules
- Sidebar active state follows current route (emerald background on active item)
- Clicking app logo always returns to Dashboard
- Mobile bottom tab highlights active section
- Back navigation from Document Detail returns to Dashboard with scroll position preserved

## Empty States
- No documents: Illustration + "Upload your first document" CTA button
- No search results: "No documents match your search" with clear filter link
- Processing: Skeleton cards with pulse animation while loading

## Error Handling
- Upload failure: Toast notification with retry button
- OCR failure: Card shows error badge, "Retry" action available
- Network error: Banner at top "Connection lost — retrying..."
