// Shared app navigation shell: desktop sidebar + mobile bottom tab bar.
//
// Wraps /app/* page content in app/app/layout.tsx. Hides itself on /app/save and
// /app/start since those are single-task entry/onboarding screens, not persistent
// app destinations (see design-specs/functionality/dashboard-spec.md "Navigation Rules"
// and login-spec.md, which frame this app's real routes differently from the
// generic wireframe exports).

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/app/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/app/workspace", label: "Workspace", icon: WorkspaceIcon },
  { href: "/app/chat", label: "Chat", icon: ChatIcon },
];

const HIDDEN_ROUTES = ["/app/save", "/app/start"];

const THEME_STORAGE_KEY = "theme";
type Theme = "light" | "dark";

function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  // Always starts "light" to exactly match the server render (server has no access to
  // localStorage/matchMedia). Reading those during the initial client render instead
  // would make this component's hydrated output differ from the server's, which forces
  // React to discard and client-render the whole tree from the nearest boundary --
  // that recovery skips re-running the blocking theme script in app/layout.tsx and
  // resets <html data-theme> back to its server-rendered "light" default. Confirmed via
  // a real production-build reproduction: every route that renders AppNav lost dark
  // mode on load, while routes that don't (save, start) kept it correctly. Syncing from
  // the DOM after mount (below) avoids ever creating that mismatch in the first place.
  const [theme, setTheme] = useState<Theme>("light");

  // One-time sync from the DOM attribute the blocking script in app/layout.tsx already
  // set before hydration; can't be known without reading the DOM, so this can't be
  // derived without an effect.
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(current);
    }
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (e.g. private browsing) -- theme still applies this session
    }
  }

  useEffect(() => {
    if (!menuOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  if (HIDDEN_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="md:flex md:min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col border-r border-(--color-border-divider) bg-(--color-background-sidebar)">
        <div className="flex h-16 items-center justify-between border-b border-(--color-border-divider) px-4">
          <Link
            href="/app/dashboard"
            className="font-(--font-weight-h3) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) rounded"
            style={{ fontSize: "var(--font-size-h3)", color: "var(--color-text-heading)" }}
          >
            Conditions Translator
          </Link>
          <ThemeToggleButton theme={theme} onToggle={toggleTheme} />
        </div>
        <nav className="flex-1 space-y-1 p-4" aria-label="Main navigation">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActiveRoute(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) ${
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

      {/* Mobile top bar */}
      <header className="md:hidden fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-(--color-border-divider) bg-(--color-background-page) px-4">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-(--color-text-body) hover:bg-(--color-border-divider) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring)"
        >
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
        <Link
          href="/app/dashboard"
          onClick={() => setMenuOpen(false)}
          className="truncate font-(--font-weight-h3) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) rounded"
          style={{ fontSize: "var(--font-size-h3)", color: "var(--color-text-heading)" }}
        >
          Conditions Translator
        </Link>
        <ThemeToggleButton theme={theme} onToggle={toggleTheme} className="ml-auto" />
      </header>

      {/* Mobile menu (hamburger dropdown) */}
      {menuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/30"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <nav
            id="mobile-nav-menu"
            className="md:hidden fixed inset-x-0 top-14 z-40 space-y-1 border-b border-(--color-border-divider) bg-(--color-background-page) p-2 shadow-lg"
            aria-label="Main navigation"
          >
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActiveRoute(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) ${
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
        </>
      )}

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-(--color-border-divider) bg-(--color-background-page)"
        aria-label="Main navigation"
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActiveRoute(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--color-border-focus-ring) ${
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
      <div className="min-w-0 flex-1 pt-14 pb-16 md:pt-0 md:pb-0">{children}</div>
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

function ThemeToggleButton({
  theme,
  onToggle,
  className = "",
}: {
  theme: Theme;
  onToggle: () => void;
  className?: string;
}) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-(--color-text-body) hover:bg-(--color-border-divider) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) ${className}`}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="10" cy="10" r="3.5" />
      <path
        d="M10 2v2M10 16v2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M2 10h2M16 10h2M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
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
        d="M16 12.5A6.5 6.5 0 1 1 7.5 4a5 5 0 0 0 8.5 8.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      className="h-5 w-5"
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      className="h-5 w-5"
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}
