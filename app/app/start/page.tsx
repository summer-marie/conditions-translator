// Privacy notice gate.
//
// Before a temporary user can create their first Document, display a privacy notice.
// The notice clearly states: data is temporary, retention policy, and that no
// account is required to proceed.
// User must explicitly accept (click "I Understand") before any Document is created.

import { acceptPrivacy } from "@/lib/actions/privacy";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { APP_NAME } from "@/lib/constants";

export default function StartPage() {
  return (
    <div className="min-h-screen bg-(--color-background-page) flex items-center justify-center p-4">
      <Card padding="lg" className="max-w-2xl w-full">
        <h1
          className="font-(--font-weight-h1) mb-6"
          style={{ fontSize: "var(--font-size-h1)", color: "var(--color-text-heading)" }}
        >
          Welcome to {APP_NAME}
        </h1>

        <div
          className="space-y-4 mb-8"
          style={{ fontSize: "var(--font-size-body)", color: "var(--color-text-body)" }}
        >
          <p>Before you begin, please understand how we handle your data:</p>

          <Alert tone="processing" radius="md" padding="md">
            <h2
              className="mb-2"
              style={{
                fontSize: "var(--font-size-h3)",
                fontWeight: "var(--font-weight-h3)",
                color: "var(--color-accent-processing)",
              }}
            >
              Privacy Notice
            </h2>
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

        <form action={acceptPrivacy}>
          <Button type="submit" variant="primary" size="lg" fullWidth>
            I Understand
          </Button>
        </form>
      </Card>
    </div>
  );
}
