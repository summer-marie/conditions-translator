# Landing Page — Functionality Spec

## Overview
Public-facing page that explains the app's value proposition and funnels visitors toward signup/login. No authentication required to view.

## Layout Structure

### Browser (1440px)
- Fixed Navbar: Logo left, nav links center (Features, How It Works, Pricing), Login + Sign Up buttons right
- Hero Section: Large headline, subtitle, primary CTA, optional hero illustration/screenshot
- Features Section: 3-column grid of feature cards with icons
- How It Works: Numbered step-by-step visual flow
- Social Proof / Trust: Usage stats or testimonial quotes
- Footer: Links, copyright, minimal

### Mobile (390px)
- Sticky Navbar: Logo left, hamburger menu right (expands to full-screen overlay)
- Stacked sections: All content in single column, full-width
- CTA buttons: Full-width on mobile

## Sections and Content

### Hero
- Headline: Bold statement about document understanding (e.g., "Understand Complex Documents in Plain Language")
- Subtitle: 1-2 sentences explaining OCR + AI analysis
- Primary CTA: "Get Started Free" routes to /signup
- Secondary CTA: "See How It Works" smooth scroll to How It Works section

### Features (3 cards)
1. Upload and OCR: "Upload document pages and get instant text extraction"
2. AI Analysis: "Get plain-language breakdowns of complex conditions and terms"
3. Ask Questions: "Chat with AI about your documents — get answers with citations"

Each card: Icon (top), title, 1-2 line description

### How It Works
1. Upload document page images
2. Review and accept OCR results
3. AI generates plain-language sections
4. Ask questions and get cited answers

Visual: Numbered steps with connecting lines/arrows, small illustrations per step

### Footer
- App name + tagline
- Links: Privacy Policy, Terms, Contact
- Copyright notice

## Interactions

### Navbar
- Scroll behavior: Navbar becomes opaque/shadowed after 100px scroll
- Nav links smooth-scroll to corresponding section
- Login button routes to /login
- Sign Up button routes to /signup (primary styled, emerald)

### CTA Buttons
- Primary: Emerald background, white text, hover darkens
- Secondary: Ghost style (text-only with underline or outline)
- All CTAs route to signup unless user is already authenticated (then route to dashboard)

### Mobile Menu
- Hamburger opens full-screen overlay
- Contains all nav links + Login/Sign Up buttons
- Close button (X) top-right
- Tapping link closes menu and navigates

## Responsive Behavior
- Features grid: 3 columns to 1 column on mobile
- Hero illustration: Hidden or scaled down on mobile
- Section spacing reduces on mobile (48px to 32px)
- Font sizes scale down proportionally (display 32px to 24px)

## Performance Notes
- Hero section should load immediately (no lazy load)
- Feature icons can be SVG inline for instant render
- Any illustrations below fold can lazy-load
