/**
 * Server Action for privacy-notice acceptance.
 *
 * @module lib/actions/privacy
 */

"use server";

import { redirect } from "next/navigation";
import { getOrCreateTemporarySession, acceptPrivacyNotice } from "@/lib/session/temporary";

/**
 * Accepts the privacy notice for the current temporary session, then redirects to the workspace.
 *
 * A temporary session is created first if the visitor doesn't have one yet — e.g. when
 * arriving via the landing page's privacy-gate modal, which (unlike `/app/start`) is not
 * reached through the bootstrap redirect in `app/app/layout.tsx` that would otherwise have
 * created the session.
 *
 * @returns Never returns normally; issues a Next.js redirect to `/app/workspace`.
 */
export async function acceptPrivacy() {
  await getOrCreateTemporarySession();

  await acceptPrivacyNotice();

  redirect("/app/workspace");
}