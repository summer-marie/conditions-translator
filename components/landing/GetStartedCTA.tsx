"use client";

// The landing page's primary CTA: opens the privacy-notice gate as an overlay instead of
// navigating to a separate page first. Local component state, not a route-intercepting modal --
// this dialog has no shareable URL and nothing to deep-link to, so state this simple is
// sufficient.

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PrivacyGateModal } from "@/components/landing/PrivacyGateModal";

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
