/**
 * Layout for all `/app/*` routes.
 *
 * Guarantees a temporary session exists before any page or Server Action under `/app/*` runs —
 * but only for unsigned visitors. Signed-in users already carry their own auth session (a
 * separate cookie/table, `lib/auth/session.ts`), so they're checked first and skip the
 * temp-session gate. Without that, a signed-in user deep-linking into e.g. `/app/workspace`
 * would fail the temp-session check (they usually have no `tmp_session` cookie), get bounced
 * through the bootstrap redirect, and land on `/app/start` instead of the route they asked for.
 *
 * This replaces middleware-based session bootstrap: Server Components can't set cookies during
 * render (Next.js restricts `cookies().set()` to Server Actions/Route Handlers/Middleware), so
 * this layout only reads the session and redirects to a Route Handler when one is needed.
 *
 * @module app/app/layout
 */

import { redirect } from "next/navigation";
import { getTemporarySession } from "@/lib/session/temporary";
import { getCurrentUser } from "@/lib/auth/session";
import { AppNav } from "@/components/layout/AppNav";

/**
 * Server layout that gates `/app/*` on an owner and wraps content in the {@link AppNav} shell.
 *
 * @param props - Component props.
 * @param props.children - The routed page content.
 * @returns The nav-wrapped content; redirects to `/api/session/bootstrap` when a temporary
 *   session must be created first.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    const session = await getTemporarySession();

    if (!session) {
      redirect("/api/session/bootstrap");
    }
  }

  return <AppNav>{children}</AppNav>;
}
