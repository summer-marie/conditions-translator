// Shared app navigation shell: desktop sidebar + mobile bottom tab bar.
//
// Wraps /app/* page content in app/app/layout.tsx. Hides itself on /app/save and
// /app/start since those are single-task entry/onboarding screens, not persistent
// app destinations (see design-specs/functionality/dashboard-spec.md "Navigation Rules"
// and login-spec.md, which frame this app's real routes differently from the
// generic wireframe exports).

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/app/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/app/workspace", label: "Workspace", icon: WorkspaceIcon },
  { href: "/app/chat", label: "Chat", icon: ChatIcon },
];

const HIDDEN_ROUTES = ["/app/save", "/app/start"];

function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (HIDDEN_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="lg:flex lg:min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col border-r border-(--color-border-divider) bg-(--color-background-sidebar)">
        <Link
          href="/app/dashboard"
          className="flex h-16 items-center px-4 border-b border-(--color-border-divider) font-(--font-weight-h3)"
          style={{ fontSize: "var(--font-size-h3)", color: "var(--color-text-heading)" }}
        >
          Conditions Translator
        </Link>
        <nav className="flex-1 space-y-1 p-4" aria-label="Main navigation">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActiveRoute(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-(--color-accent-success) text-(--color-text-inverse)"
                    : "text-(--color-text-body) hover:bg-(--color-border-divider)"
                }`}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-(--color-border-divider) bg-(--color-background-page)"
        aria-label="Main navigation"
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActiveRoute(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium ${
                active ? "text-(--color-accent-success)" : "text-(--color-text-meta)"
              }`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Page content */}
      <div className="min-w-0 flex-1 pb-16 lg:pb-0">{children}</div>
    </div>
  );
}

function DashboardIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="11" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="11" width="6" height="6" rx="1" />
      <rect x="11" y="11" width="6" height="6" rx="1" />
    </svg>
  );
}

function WorkspaceIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M10 3v9M10 3l-3 3M10 3l3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M3 4h14v9H7l-4 3V4z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
