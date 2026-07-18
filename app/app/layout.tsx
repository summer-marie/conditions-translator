// Layout for all /app/* routes (start, workspace).
//
// Guarantees a temporary session exists before any page or Server Action under /app/* runs --
// but only for unsigned visitors. Signed-in users already carry their own auth session (a
// separate cookie/table, lib/auth/session.ts) and don't need a temporary one, so they're checked
// first and skip the temp-session gate entirely. Without this check, a signed-in user deep-linking
// straight into e.g. /app/workspace would still fail the temp-session check (they typically have
// no tmp_session cookie), get bounced through the bootstrap redirect, and land on /app/start
// instead of the route they actually asked for -- not a loop, just the wrong landing spot.
//
// This replaces middleware-based session bootstrap: Server Components cannot set cookies
// during render (Next.js restricts cookies().set() to Server Actions/Route Handlers/Middleware),
// so this layout only reads the session and redirects to a Route Handler when one is needed.
// See .agent-memory/DECISIONS.md for why this moved out of middleware (now proxy.ts).

import { redirect } from "next/navigation";
import { getTemporarySession } from "@/lib/session/temporary";
import { getCurrentUser } from "@/lib/auth/session";
import { AppNav } from "@/components/layout/AppNav";

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
