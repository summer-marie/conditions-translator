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
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <h1 className="text-xl font-semibold text-green-900 mb-2">Workspace saved</h1>
          <p className="text-sm text-green-800">
            {savedCount === 0
              ? "Your account is ready. Your documents are now saved to it."
              : `${savedCount} document${savedCount === 1 ? "" : "s"} ${
                  savedCount === 1 ? "is" : "are"
                } now saved to your account and will no longer expire.`}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/app/chat"
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Continue to chat
            </Link>
            <Link href="/app/workspace" className="text-sm text-green-700 hover:underline">
              Back to workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- Account form ---------------------------------------------------------
  return (
    <div className="max-w-md mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Save your workspace</h1>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-gray-600 hover:underline"
        >
          Cancel
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Create an account or sign in to keep your documents. Your documents and current chat are
        preserved either way — if you cancel, you stay in temporary mode.
      </p>

      <div className="mb-4 flex rounded-md border border-gray-200 p-1 text-sm">
        <button
          type="button"
          onClick={() => {
            setMode("create");
            setError(null);
          }}
          className={`flex-1 rounded px-3 py-1.5 font-medium ${
            mode === "create" ? "bg-blue-600 text-white" : "text-gray-700"
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
          className={`flex-1 rounded px-3 py-1.5 font-medium ${
            mode === "signin" ? "bg-blue-600 text-white" : "text-gray-700"
          }`}
        >
          Sign in
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {mode === "create" ? (
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              autoComplete="email"
            />
          </div>

          <p className="text-center text-xs text-gray-400">or</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              autoComplete="username"
            />
            <p className="mt-1 text-xs text-gray-500">Provide at least an email or a username.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recovery email <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="email"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              placeholder="backup@example.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              autoComplete="email"
            />
          </div>

          {needsRecoveryAck && (
            <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <input
                type="checkbox"
                checked={acknowledgedNoRecovery}
                onChange={(e) => setAcknowledgedNoRecovery(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                I understand that with no email or recovery email, my account cannot be recovered if
                I forget my password.
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : "Create account & save"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSignIn} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email or username</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={signInPassword}
              onChange={(e) => setSignInPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSubmitting ? "Signing in…" : "Sign in & save"}
          </button>
        </form>
      )}
    </div>
  );
}
