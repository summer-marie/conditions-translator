// Server Actions for privacy notice acceptance.

"use server";

import { redirect } from "next/navigation";
import { getTemporarySession, acceptPrivacyNotice } from "@/lib/session/temporary";

/**
 * Accepts the privacy notice for the current temporary session.
 * Redirects to the workspace after acceptance.
 */
export async function acceptPrivacy() {
  // Get or create temporary session
  const session = await getTemporarySession();
  
  if (!session) {
    throw new Error("No active session found");
  }

  // Mark privacy notice as accepted
  await acceptPrivacyNotice();

  // Redirect to workspace
  redirect("/app/workspace");
}