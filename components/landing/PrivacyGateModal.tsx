"use client";

// The privacy-notice gate, presented as an overlay from the landing page's primary CTA.
// Same notice copy and intent as app/app/start/page.tsx (the standalone fallback route still
// reached when workspace/chat detect an unaccepted session), duplicated rather than shared --
// small enough content that a shared import wasn't worth touching that route in this pass.

import { useEffect, useRef } from "react";
import { acceptPrivacy } from "@/lib/actions/privacy";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export function PrivacyGateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(open, modalRef);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-gate-title"
    >
      <div
        ref={modalRef}
        className="bg-(--color-background-card) rounded-lg shadow-xl max-w-2xl w-full p-6 border border-(--color-border-card) max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="privacy-gate-title"
          className="mb-4"
          style={{
            fontSize: "var(--font-size-h2)",
            fontWeight: "var(--font-weight-h2)",
            color: "var(--color-text-heading)",
          }}
        >
          Before you begin
        </h2>

        <div
          className="space-y-4 mb-6"
          style={{ fontSize: "var(--font-size-body)", color: "var(--color-text-body)" }}
        >
          <p>Please understand how we handle your data:</p>

          <Alert tone="processing" radius="md" padding="md">
            <h3
              className="mb-2"
              style={{
                fontSize: "var(--font-size-h3)",
                fontWeight: "var(--font-weight-h3)",
                color: "var(--color-accent-processing)",
              }}
            >
              Privacy Notice
            </h3>
            <ul
              className="list-disc list-inside space-y-2"
              style={{ color: "var(--color-accent-processing)" }}
            >
              <li>
                <strong>Your data is temporary:</strong> Temporary documents become unavailable
                after 24 hours.
              </li>
              <li>
                <strong>No account required:</strong> You can upload and translate documents
                without creating an account.
              </li>
              <li>
                <strong>Privacy-first:</strong> Your documents are never shared or used for
                training purposes.
              </li>
              <li>
                <strong>AI is document-grounded:</strong> The AI only answers from your uploaded
                document content.
              </li>
              <li>
                <strong>Chat is temporary:</strong> Conversation history is not permanently
                stored.
              </li>
            </ul>
          </Alert>

          <p>
            By clicking &quot;I Understand&quot;, you acknowledge that your data is temporary and
            will become unavailable after 24 hours. You can choose to create an account later if
            you want to save your work permanently.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <form action={acceptPrivacy}>
            <Button type="submit" variant="primary" size="lg" className="w-full sm:w-auto">
              I Understand
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
