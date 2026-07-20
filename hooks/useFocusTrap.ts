"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Selector matching every element that can receive keyboard focus inside a trap. */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus inside a modal-like overlay while it is open.
 *
 * Shared behavior for dialogs and dropdown menus with a backdrop. While `active`, it moves
 * focus into the container, keeps Tab/Shift+Tab cycling within it, and restores focus to
 * whatever was focused before it opened (normally the trigger control) once it closes.
 *
 * State & side effects:
 * - Keeps a ref to the previously-focused element so focus can be returned on cleanup.
 * - Adds a document-level `keydown` listener (removed on cleanup) to wrap Tab at the edges.
 * - Escape-to-close is intentionally NOT handled here — each caller owns its own Escape
 *   listener tied to its own close logic.
 *
 * @param active - Whether the trap is currently engaged (the overlay is open).
 * @param containerRef - Ref to the overlay's root element that focus is confined within.
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useFocusTrap(isOpen, ref);
 * return <div ref={ref} role="dialog">…</div>;
 * ```
 */
export function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>) {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Remember where focus was so it can be restored when the overlay closes.
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Move focus to the first focusable child, falling back to the container itself.
    const container = containerRef.current;
    const focusable = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? container)?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !container) return;

      const elements = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (elements.length === 0) return;

      const first = elements[0];
      const last = elements[elements.length - 1];

      // Wrap around at the edges so Tab never escapes the overlay: Shift+Tab off the first
      // element jumps to the last, and Tab off the last jumps back to the first.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Return focus to the trigger control that opened the overlay.
      previouslyFocused.current?.focus();
    };
  }, [active, containerRef]);
}
