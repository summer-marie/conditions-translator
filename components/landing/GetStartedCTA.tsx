"use client";

/**
 * The landing page's primary call-to-action button.
 *
 * Opens the {@link PrivacyGateModal} overlay instead of navigating to a separate page first.
 * Uses simple local `open` state rather than a route-intercepting modal, since the dialog has
 * no shareable URL and nothing to deep-link to.
 *
 * @module components/landing/GetStartedCTA
 */

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PrivacyGateModal } from "@/components/landing/PrivacyGateModal";

/**
 * Renders the CTA button and its attached privacy-gate modal.
 *
 * @param props - Component props.
 * @param props.label - Button label. Defaults to "Add your first document".
 * @param props.size - Button size. Defaults to `"lg"`.
 * @param props.fullWidth - Whether the button fills its container. Defaults to `false`.
 * @param props.className - Extra classes appended to the button.
 * @returns The rendered button plus its (closed by default) modal.
 */
export function GetStartedCTA({
  label = "Add your first document",
  size = "lg",
  fullWidth = false,
  className = "",
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="primary"
        size={size}
        fullWidth={fullWidth}
        className={className}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <PrivacyGateModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
