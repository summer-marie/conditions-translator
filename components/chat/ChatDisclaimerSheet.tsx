"use client";

/**
 * Mobile-only chat disclaimer acknowledgment, shown as a compact bottom sheet rather than a
 * full-screen overlay (contrast `components/landing/PrivacyGateModal.tsx`, which is a
 * different, full-screen gate for a different notice — see `lib/session/chatDisclaimer.ts`'s
 * module docstring for why the two are kept separate).
 *
 * Focus-trapped like the app's other overlays (`hooks/useFocusTrap.ts`), but deliberately has
 * no Cancel/Escape/backdrop-dismiss path: the disclaimer must be acknowledged (the "Got it"
 * button) before chat use is unblocked, and the server independently enforces the same rule
 * (`lib/session/chatDisclaimer.ts`'s `requireChatDisclaimerAcknowledged`), so this UI is a
 * courtesy, not the only gate.
 *
 * Hidden at the `md` breakpoint and up via the outer wrapper's `md:hidden` — the desktop
 * disclaimer is the compact banner rendered inline in `app/app/chat/page.tsx` instead.
 *
 * @module components/chat/ChatDisclaimerSheet
 */

import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { useFocusTrap } from "@/hooks/useFocusTrap";

/** Props for {@link ChatDisclaimerSheet}. */
interface ChatDisclaimerSheetProps {
  /** Whether the sheet is visible (i.e. the disclaimer has not yet been acknowledged). */
  open: boolean;
  /** Called when the user taps "Got it"; the caller persists acknowledgment and re-fetches state. */
  onAcknowledge: () => void;
  /** Whether an acknowledgment request is in flight (disables/spinner on the action button). */
  isSubmitting?: boolean;
}

/**
 * Renders the mobile chat-disclaimer bottom sheet, or nothing when `open` is `false`.
 *
 * @param props - {@link ChatDisclaimerSheetProps}.
 * @returns The rendered sheet, or `null` when closed.
 */
export function ChatDisclaimerSheet({
  open,
  onAcknowledge,
  isSubmitting = false,
}: ChatDisclaimerSheetProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(open, sheetRef);

  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50 flex items-end bg-black/40">
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-disclaimer-sheet-title"
        className="w-full rounded-t-xl border-t p-4"
        style={{
          backgroundColor: "var(--color-background-card)",
          borderColor: "var(--color-border-card)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
        }}
      >
        <h2
          id="chat-disclaimer-sheet-title"
          className="mb-2"
          style={{
            fontSize: "var(--font-size-h3)",
            fontWeight: "var(--font-weight-h3)",
            color: "var(--color-text-heading)",
          }}
        >
          Before you chat
        </h2>
        <p
          className="mb-4"
          style={{ fontSize: "var(--font-size-body)", color: "var(--color-text-body)" }}
        >
          This assistant explains your uploaded documents in plain language. It does not give
          legal advice and cannot say whether you&apos;ve violated a condition — for those
          questions, talk to your supervising officer or an attorney.
        </p>
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          onClick={onAcknowledge}
          isLoading={isSubmitting}
        >
          Got it
        </Button>
      </div>
    </div>
  );
}
