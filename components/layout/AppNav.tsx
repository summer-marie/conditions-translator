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
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { APP_NAME } from "@/lib/constants";

const NAV_ITEMS = [
  { href: "/app/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/app/workspace", label: "Workspace", icon: WorkspaceIcon },
  { href: "/app/chat", label: "Chat", icon: ChatIcon },
];

const HIDDEN_ROUTES = ["/app/save", "/app/start"];

const THEME_STORAGE_KEY = "theme";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "sidebar-collapsed";
type Theme = "light" | "dark";

function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuRef = useRef<HTMLElement | null>(null);
  useFocusTrap(menuOpen, mobileMenuRef);
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

  // Same reasoning as theme above: starts "false" (expanded) to exactly match the server
  // render, then syncs from localStorage after mount rather than during the initial client
  // render, so this component's hydrated output never diverges from the server's.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true");
    } catch {
      // localStorage unavailable (e.g. private browsing) -- stays expanded this session
    }
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
    } catch {
      // localStorage unavailable -- collapse still applies this session
    }
  }

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
      // Focus restore to the trigger on close is handled by useFocusTrap's cleanup.
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  if (HIDDEN_ROUTES.includes(pathname)) {
    return <main id="main-content">{children}</main>;
  }

  return (
    <div className="md:flex md:min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-(--color-background-page) focus:px-4 focus:py-2 focus:text-(--color-text-heading) focus:outline-none focus:ring-2 focus:ring-(--color-border-focus-ring)"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex md:shrink-0 md:flex-col border-r border-(--color-border-divider) bg-(--color-background-sidebar) transition-[width] duration-200 ease-in-out ${
          collapsed ? "md:w-16" : "md:w-60"
        }`}
      >
        <div
          className={`flex h-16 items-center border-b border-white/10 ${
            collapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          {!collapsed && (
            <Link
              href="/app/dashboard"
              className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-surface-nav-foreground) rounded"
            >
              <Image
                src="/dark-mode-logo.png"
                alt={APP_NAME}
                width={113}
                height={32}
                className="h-8 w-auto object-contain"
              />
            </Link>
          )}
          <div className="flex items-center gap-1">
            {!collapsed && <ThemeToggleButton theme={theme} onToggle={toggleTheme} />}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-controls="desktop-sidebar-nav"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-(--color-surface-nav-foreground) hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-surface-nav-foreground)"
            >
              {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </button>
          </div>
        </div>
        <nav
          id="desktop-sidebar-nav"
          className={`flex-1 space-y-1 ${collapsed ? "px-2 py-4" : "p-4"}`}
          aria-label="Main navigation"
        >
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActiveRoute(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? label : undefined}
                title={collapsed ? label : undefined}
                className={`flex h-9 items-center gap-3 rounded-md text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-surface-nav-foreground) ${
                  collapsed ? "justify-center px-0" : "px-3"
                } ${
                  active
                    ? "bg-(--color-surface-nav-active-bg) text-(--color-surface-nav-active-foreground)"
                    : "text-(--color-surface-nav-foreground) hover:bg-white/10"
                }`}
              >
                <Icon />
                {!collapsed && label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile top bar (navy nav chrome) */}
      <header className="md:hidden fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-white/10 bg-(--color-surface-navigation) px-4">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-(--color-surface-nav-foreground) hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-surface-nav-foreground)"
        >
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
        <Link
          href="/app/dashboard"
          onClick={() => setMenuOpen(false)}
          className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-surface-nav-foreground) rounded"
        >
          <Image
            src="/dark-mode-logo.png"
            alt={APP_NAME}
            width={99}
            height={28}
            className="h-7 w-auto object-contain"
          />
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
            ref={mobileMenuRef}
            className="md:hidden fixed inset-x-0 top-14 z-40 space-y-1 border-b border-white/10 bg-(--color-surface-navigation) p-2 shadow-lg"
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
                  className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-surface-nav-foreground) ${
                    active
                      ? "bg-(--color-surface-nav-active-bg) text-(--color-surface-nav-active-foreground)"
                      : "text-(--color-surface-nav-foreground) hover:bg-white/10"
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

      {/* Mobile bottom tab bar (navy nav chrome) */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-(--color-surface-navigation)"
        aria-label="Main navigation"
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActiveRoute(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--color-surface-nav-foreground) ${
                active ? "text-(--color-surface-nav-active-foreground)" : "text-(--color-surface-nav-foreground-muted)"
              }`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Page content */}
      <main id="main-content" className="min-w-0 flex-1 pt-14 pb-16 md:pt-0 md:pb-0">
        {children}
      </main>
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
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-(--color-surface-nav-foreground) hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-surface-nav-foreground) ${className}`}
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

function ChevronLeftIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M12.5 4.5L7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M7.5 4.5L13 10l-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
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
