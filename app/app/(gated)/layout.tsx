/**
 * Layout for the gated `/app/*` routes that require an owner (Workspace, Chat, Dashboard).
 *
 * Guarantees a temporary session exists before any of these pages or their Server Actions run —
 * but only for unsigned visitors. Signed-in users already carry their own auth session (a
 * separate cookie/table, `lib/auth/session.ts`), so they're checked first and skip the
 * temp-session gate.
 *
 * `/app/save` and `/app/start` intentionally sit outside this route group: neither needs an
 * owner to already exist before it renders (`/app/start` creates its own session on submit via
 * `acceptPrivacy`, and `/app/save`'s sign-in/create-account actions tolerate having no temporary
 * session to transfer). This gate used to also cover those two routes from the shared
 * `app/app/layout.tsx`, which meant a visitor with no session cookie yet clicking "Log in" was
 * silently redirected through `/api/session/bootstrap` -> `/app/start` -> `/app/workspace`,
 * losing their actual destination and landing in a fresh temporary workspace instead of the
 * sign-in form.
 *
 * This replaces middleware-based session bootstrap: Server Components can't set cookies during
 * render (Next.js restricts `cookies().set()` to Server Actions/Route Handlers/Middleware), so
 * this layout only reads the session and redirects to a Route Handler when one is needed.
 *
 * @module app/app/(gated)/layout
 */

import { redirect } from "next/navigation";
import { getTemporarySession } from "@/lib/session/temporary";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Server layout that gates Workspace/Chat/Dashboard on an owner.
 *
 * @param props - Component props.
 * @param props.children - The routed page content.
 * @returns The page content; redirects to `/api/session/bootstrap` when a temporary session
 *   must be created first.
 */
export default async function GatedLayout({
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

  return <>{children}</>;
}
