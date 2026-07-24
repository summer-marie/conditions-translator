/**
 * Layout for all `/app/*` routes.
 *
 * Wraps every route in the shared {@link AppNav} chrome (which self-hides on `/app/save` and
 * `/app/start`). The owner/session gate that used to live here now lives in
 * `app/app/(gated)/layout.tsx`, scoped to Workspace/Chat/Dashboard only — see that file for why
 * `/app/save` and `/app/start` are intentionally excluded from it.
 *
 * @module app/app/layout
 */

import { AppNav } from "@/components/layout/AppNav";

/**
 * Shared layout wrapping all `/app/*` page content in the {@link AppNav} shell.
 *
 * @param props - Component props.
 * @param props.children - The routed page content.
 * @returns The nav-wrapped content.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppNav>{children}</AppNav>;
}
