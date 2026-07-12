// Layout for all /app/* routes (start, workspace).
//
// Guarantees a temporary session exists before any page or Server Action under /app/* runs.
// This replaces middleware-based session bootstrap: Server Components cannot set cookies
// during render (Next.js restricts cookies().set() to Server Actions/Route Handlers/Middleware),
// so this layout only reads the session and redirects to a Route Handler when one is needed.
// See .agent-memory/DECISIONS.md for why this moved out of middleware (now proxy.ts).

import { redirect } from "next/navigation";
import { getTemporarySession } from "@/lib/session/temporary";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getTemporarySession();

  if (!session) {
    redirect("/api/session/bootstrap");
  }

  return <>{children}</>;
}
