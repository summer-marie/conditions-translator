# Login and Signup Flow — Functionality Spec

## Overview
Authentication flow supporting username-only accounts (email optional). Clear warnings about password recovery limitations when email is omitted.

## Routes
- /login — Existing user sign-in
- /signup — New account creation
- /forgot-password — Password reset (email required)

## Layout Structure

### Browser (1440px)
- Split layout: Left panel (branded, deep-navy #0F1B33 background with app tagline/illustration),
  Right panel (content surface #E6ECF3 — **not** pure white; white is used only inside the input
  interiors)
- Form panel is vertically centered with max-width 400px

### Mobile (390px)
- Single column: Small branded header (logo + tagline), full-width form below
- No split panel on mobile — all content stacks vertically

## Login Screen

### Form Fields
1. Username or Email — single input, accepts either
2. Password — input with show/hide toggle icon
3. Remember Me — checkbox (optional)

### Actions
- Sign In button (primary, full-width)
- Forgot Password? link routes to /forgot-password
- Don't have an account? Sign Up link routes to /signup

### Validation
- Empty fields: "Username or email is required" / "Password is required"
- Invalid credentials: "Invalid username/email or password" (generic, no indication which is wrong)
- Rate limiting: After 5 failed attempts, show "Too many attempts. Try again in 5 minutes."

## Signup Screen

### Form Fields (in order)
1. Username (required) — text input
   - Validation: 3-50 chars, alphanumeric + underscores, unique
   - Real-time availability check (debounced, shows checkmark or "taken" indicator)
2. Email (optional) — email input
   - Helper text below: "Optional — used for password recovery only"
   - If left empty, show warning callout box (amber border, amber icon):
     "Without an email, we cannot recover your password if you forget it. Make sure to store your password securely."
3. Password (required) — password input with strength indicator
   - Minimum 8 characters
   - Strength bar: Weak (red) / Fair (amber) / Strong (success green)
4. Confirm Password (required) — must match password field

### Actions
- Create Account button (primary, full-width)
- Already have an account? Sign In link routes to /login

### Email Warning Flow
1. User fills username + password but leaves email blank
2. On form submit attempt, show modal/callout:
   - Title: "No email provided"
   - Body: "You won't be able to reset your password if you forget it. Are you sure you want to continue without an email?"
   - Buttons: "Add Email" (secondary) | "Continue Without Email" (primary)
3. If user clicks "Continue Without Email" — account created, proceed to dashboard
4. If user clicks "Add Email" — focus returns to email field

### Post-Signup
- Successful signup — auto-login — redirect to /dashboard
- Show welcome toast: "Account created! Start by uploading a document."

## Forgot Password Screen

### Form Fields
1. Email — email input (required here)

### Logic
- If the account has no email on file: "No email is associated with this account. Password cannot be reset."
- If email found: "If an account with that email exists, we've sent reset instructions."
- Never confirm whether an email exists in the system (security)

### Actions
- Send Reset Link button (primary, full-width)
- Back to Sign In link routes to /login

## Component States

### Input Fields
- Default: Subtle border (#C5CFDC); white input interior
- Focus: Navy border (#0F1B33) + focus ring
- Error: Destructive border (#DC2626) + error message below in red
- Success: Success green border (#16A34A) + checkmark icon (for username availability)

### Buttons
- Default: Deep-navy primary (#0F1B33) — Sign In / Create Account are the screen's primary action,
  not green
- Loading: Spinner replaces text, button disabled
- Disabled: Reduced opacity (0.5), no pointer events

### Password Strength Indicator
- Bar below password field, fills left-to-right
- Colors: less than 8 chars = destructive red (#DC2626), 8-11 chars = warning amber (#D97706),
  12+ with mix = success green (#16A34A)
- Text label: "Weak" / "Fair" / "Strong"

## Accessibility
- All form fields have associated labels (not just placeholders)
- Error messages linked via aria-describedby
- Focus trap within modal dialogs
- Tab order follows visual order
- Enter key submits form from any field

## Security Notes
- Passwords hashed SERVER-SIDE with scrypt (Node built-in crypto, no native dependencies)
- Do NOT hash client-side — server handles all hashing with proper salting
- No password requirements beyond 8-char minimum (avoid complexity theater)
- Session tokens stored in httpOnly cookies
- CSRF protection on all form submissions

