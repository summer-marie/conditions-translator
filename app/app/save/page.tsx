// Save Workspace: account creation / sign-in entry point (Phase 7,
// docs/05_Account_Creation_and_Temporary_Access.md).
//
// Reached from the temporary workspace or chat via a "Save workspace" affordance. Creating an
// account or signing in transfers all temporary Documents (and the active chat) to the account.
// Canceling is pure navigation — it changes nothing server-side, so the temporary workspace and
// active chat are preserved and expiration continues normally.

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signUpAndSave, signInAndSave } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";

type Mode = "create" | "signin";

export default function SavePage() {
  return (
    // useSearchParams() requires a Suspense boundary in the App Router.
    <Suspense fallback={null}>
      <SavePageContent />
    </Suspense>
  );
}

function SavePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Supports /app/save?mode=signin so a "Log in" entry point (distinct from "Save workspace")
  // can land directly on the sign-in tab. TODO: this mode param + the separate "Log in" button
  // it's paired with (workspace header) is a stopgap — the save/sign-in UI could use a proper
  // pass later (see .agent-memory/OPEN_QUESTIONS.md).
  const initialMode: Mode = searchParams.get("mode") === "signin" ? "signin" : "create";
  const [mode, setMode] = useState<Mode>(initialMode);

  // Create-account fields.
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [acknowledgedNoRecovery, setAcknowledgedNoRecovery] = useState(false);

  // Sign-in fields.
  const [identifier, setIdentifier] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  // A username-only account (no email, no recovery email) has no recovery path — require the
  // user to acknowledge that before we let them create it.
  const needsRecoveryAck =
    username.trim().length > 0 && email.trim().length === 0 && recoveryEmail.trim().length === 0;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await signUpAndSave({
        email: email.trim() || null,
        username: username.trim() || null,
        password,
        recoveryEmail: recoveryEmail.trim() || null,
        acknowledgedNoRecovery,
      });
      setSavedCount(result.transfer.documentCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't create your account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await signInAndSave({ identifier: identifier.trim(), password: signInPassword });
      setSavedCount(result.transfer.documentCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't sign you in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---- Saved confirmation ---------------------------------------------------
  if (savedCount !== null) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6">
        <Alert tone="success" radius="lg" padding="lg" className="text-center">
          <h1 className="text-(length:--font-size-h2) font-(--font-weight-h2) text-(--color-accent-success) mb-2">
            Workspace saved
          </h1>
          <p className="text-sm text-(--color-accent-success)">
            {savedCount === 0
              ? "Your account is ready. Your documents are now saved to it."
              : `${savedCount} document${savedCount === 1 ? "" : "s"} ${
                  savedCount === 1 ? "is" : "are"
                } now saved to your account and will no longer expire.`}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Link href="/app/chat">
              <Button variant="primary" size="md" fullWidth>
                Continue to chat
              </Button>
            </Link>
            <Link
              href="/app/workspace"
              className="text-sm text-(--color-accent-success) hover:underline"
            >
              Back to workspace
            </Link>
          </div>
        </Alert>
      </div>
    );
  }

  // ---- Account form ---------------------------------------------------------
  return (
    <div className="max-w-md mx-auto p-4 sm:p-6">
      <Card padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-(length:--font-size-h2) font-(--font-weight-h2) text-(--color-text-heading)">
          Save your workspace
        </h1>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-(--color-text-body) hover:underline"
        >
          Cancel
        </button>
      </div>

      <p className="text-sm text-(--color-text-body) mb-4">
        Create an account or sign in to keep your documents. Your documents and current chat are
        preserved either way — if you cancel, you stay in temporary mode.
      </p>

      <div className="mb-4 flex rounded-md border border-(--color-border-card) p-1 text-sm">
        <button
          type="button"
          onClick={() => {
            setMode("create");
            setError(null);
          }}
          aria-pressed={mode === "create"}
          className={`flex-1 rounded px-3 py-1.5 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) ${
            mode === "create"
              ? "bg-(--color-brand-primary) text-(--color-text-inverse)"
              : "text-(--color-text-body)"
          }`}
        >
          Create account
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setError(null);
          }}
          aria-pressed={mode === "signin"}
          className={`flex-1 rounded px-3 py-1.5 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) ${
            mode === "signin"
              ? "bg-(--color-brand-primary) text-(--color-text-inverse)"
              : "text-(--color-text-body)"
          }`}
        >
          Sign in
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-(--color-accent-destructive) bg-(--color-accent-destructive-bg) p-3 text-sm text-(--color-accent-destructive)"
        >
          {error}
        </div>
      )}

      {mode === "create" ? (
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label htmlFor="create-email" className="block text-sm font-medium text-(--color-text-body) mb-1">Email</label>
            <Input
              id="create-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <p className="text-center text-xs text-(--color-text-meta)">or</p>

          <div>
            <label htmlFor="create-username" className="block text-sm font-medium text-(--color-text-body) mb-1">Username</label>
            <Input
              id="create-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              autoComplete="username"
              aria-describedby="create-username-hint"
            />
            <p id="create-username-hint" className="mt-1 text-xs text-(--color-text-meta)">Provide at least an email or a username.</p>
          </div>

          <div>
            <label htmlFor="create-password" className="block text-sm font-medium text-(--color-text-body) mb-1">Password</label>
            <PasswordInput
              id="create-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label htmlFor="create-recovery-email" className="block text-sm font-medium text-(--color-text-body) mb-1">
              Recovery email <span className="text-(--color-text-meta)">(optional)</span>
            </label>
            <Input
              id="create-recovery-email"
              type="email"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              placeholder="backup@example.com"
              autoComplete="email"
            />
          </div>

          {needsRecoveryAck && (
            <label className="flex items-start gap-2 rounded-md border border-(--color-accent-warning) bg-(--color-accent-warning-bg) p-3 text-sm text-(--color-accent-warning)">
              <input
                type="checkbox"
                checked={acknowledgedNoRecovery}
                onChange={(e) => setAcknowledgedNoRecovery(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-(--color-brand-primary)"
              />
              <span>
                I understand that with no email or recovery email, my account cannot be recovered if
                I forget my password.
              </span>
            </label>
          )}

          <Button type="submit" disabled={isSubmitting} isLoading={isSubmitting} variant="primary" fullWidth>
            Create account & save
          </Button>
        </form>
      ) : (
        <form onSubmit={handleSignIn} className="space-y-3">
          <div>
            <label htmlFor="signin-identifier" className="block text-sm font-medium text-(--color-text-body) mb-1">Email or username</label>
            <Input
              id="signin-identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="signin-password" className="block text-sm font-medium text-(--color-text-body) mb-1">Password</label>
            <PasswordInput
              id="signin-password"
              value={signInPassword}
              onChange={(e) => setSignInPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" disabled={isSubmitting} isLoading={isSubmitting} variant="primary" fullWidth>
            Sign in & save
          </Button>
        </form>
      )}
      </Card>
    </div>
  );
}
