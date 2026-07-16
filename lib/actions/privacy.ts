// Server Actions for privacy notice acceptance.

"use server";

import { redirect } from "next/navigation";
import { getOrCreateTemporarySession, acceptPrivacyNotice } from "@/lib/session/temporary";

/**
 * Accepts the privacy notice for the current temporary session, creating one first if the
 * visitor doesn't have one yet (e.g. arriving via the landing page's privacy-gate modal,
 * which -- unlike /app/start -- isn't reached through app/app/layout.tsx's bootstrap redirect).
 * Redirects to the workspace after acceptance.
 */
export async function acceptPrivacy() {
  await getOrCreateTemporarySession();

  // Mark privacy notice as accepted
  await acceptPrivacyNotice();

  // Redirect to workspace
  redirect("/app/workspace");
}