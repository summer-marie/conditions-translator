// Shared app navigation shell: desktop sidebar + mobile bottom tab bar.
//
// Wraps /app/* page content in app/app/layout.tsx. Hides itself on /app/save and
// /app/start since those are single-task entry/onboarding screens, not persistent
// app destinations (see design-specs/functionality/dashboard-spec.md "Navigation Rules"
// and login-spec.md, which frame this app's real routes differently from the
// generic wireframe exports).

"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/Button";

const NAV_ITEMS = [
  { href: "/app/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/app/workspace", label: "Workspace", icon: WorkspaceIcon },
  { href: "/app/chat", label: "Chat", icon: ChatIcon },
];

const HIDDEN_ROUTES = ["/app/save", "/app/start"];

interface FinishedDocument {
  id: string;
  title: string;
}

const THEME_STORAGE_KEY = "theme";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "sidebar-collapsed";
type Theme = "light" | "dark";

function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({ children }: { children: React.ReactNode }) {
  return (
    // useSearchParams() (used below to highlight the active document link) requires a Suspense
    // boundary in the App Router. The fallback still renders children so page content is never
    // blocked on it -- useSearchParams() is synchronous in a client component and this only
    // matters for the build-time static-generation check.
    <Suspense fallback={<main id="main-content">{children}</main>}>
      <AppNavContent>{children}</AppNavContent>
    </Suspense>
  );
}

function AppNavContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [finishedDocuments, setFinishedDocuments] = useState<FinishedDocument[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuRef = useRef<HTMLElement | null>(null);
  useFocusTrap(menuOpen, mobileMenuRef);

  // Overflow actions (Review pages / Delete document) for a finished document row in the sidenav
  // or mobile menu -- id of the document whose menu/sheet is currently open, or null. Shared by
  // both the desktop popover and mobile action sheet (DocumentActionsMenu below): only one is
  // ever visible at a given viewport, so one state/ref pair is enough.
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);
  const actionsPopoverRef = useRef<HTMLDivElement | null>(null);
  const actionsSheetRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(openActionsFor !== null, actionsPopoverRef);
  useFocusTrap(openActionsFor !== null, actionsSheetRef);

  const [deleteDocModal, setDeleteDocModal] = useState<{
    isOpen: boolean;
    document: FinishedDocument | null;
    isDeleting: boolean;
    error: string | null;
  }>({ isOpen: false, document: null, isDeleting: false, error: null });
  const deleteDocModalRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(deleteDocModal.isOpen, deleteDocModalRef);

  useEffect(() => {
    if (openActionsFor === null) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenActionsFor(null);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openActionsFor]);

  useEffect(() => {
    if (!deleteDocModal.isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleDeleteDocCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deleteDocModal.isOpen]);

  function handleReviewPagesClick() {
    setOpenActionsFor(null);
  }

  function handleDeleteDocClick(doc: FinishedDocument) {
    setOpenActionsFor(null);
    setDeleteDocModal({ isOpen: true, document: doc, isDeleting: false, error: null });
  }

  function handleDeleteDocCancel() {
    setDeleteDocModal({ isOpen: false, document: null, isDeleting: false, error: null });
  }

  async function handleDeleteDocConfirm() {
    if (!deleteDocModal.document) return;
    const documentId = deleteDocModal.document.id;

    setDeleteDocModal((prev) => ({ ...prev, isDeleting: true, error: null }));

    try {
      const response = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete document");
      }

      setFinishedDocuments((prev) => prev.filter((d) => d.id !== documentId));
      setDeleteDocModal({ isOpen: false, document: null, isDeleting: false, error: null });

      // If the deleted document was the one currently open in the workspace, its ?documentId=
      // now points nowhere -- send the user back to the plain workspace route, which already
      // falls back to the active intake document (or the empty state) on its own.
      if (pathname === "/app/workspace" && searchParams.get("documentId") === documentId) {
        router.push("/app/workspace");
      }
    } catch (error) {
      setDeleteDocModal((prev) => ({
        ...prev,
        isDeleting: false,
        error: error instanceof Error ? error.message : "Failed to delete document",
      }));
    }
  }
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

  // Lists the current owner's finished documents (organized/"Sections" view available) as extra
  // sidenav destinations, alongside the fixed Dashboard/Workspace/Chat items. Reuses the existing
  // owner-aware GET /api/documents endpoint used elsewhere (dashboard, chat, workspace) -- guests
  // get their temporary session's documents, signed-in users get their persisted ones, with no
  // separate nav-specific persistence. Re-fetched on route change so a document finished in the
  // workspace shows up here without a full reload.
  useEffect(() => {
    if (HIDDEN_ROUTES.includes(pathname)) return;
    let cancelled = false;
    async function loadFinishedDocuments() {
      try {
        const res = await fetch("/api/documents");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const finished: FinishedDocument[] = (data.documents ?? [])
          .filter((d: { status: string }) => d.status !== "IN_PROGRESS")
          .map((d: { id: string; title: string }) => ({ id: d.id, title: d.title }));
        setFinishedDocuments(finished);
      } catch {
        // Non-fatal: the sidenav just won't show document links if this fails.
      }
    }
    loadFinishedDocuments();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

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

          {!collapsed && finishedDocuments.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-(--color-surface-nav-foreground-muted)">
                Documents
              </p>
              {finishedDocuments.map((doc) => {
                const active = pathname === "/app/workspace" && searchParams.get("documentId") === doc.id;
                return (
                  <div key={doc.id} className="relative flex items-center gap-0.5">
                    <Link
                      href={`/app/workspace?documentId=${doc.id}`}
                      aria-current={active ? "page" : undefined}
                      title={doc.title}
                      className={`flex h-9 min-w-0 flex-1 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-surface-nav-foreground) ${
                        active
                          ? "bg-(--color-surface-nav-active-bg) text-(--color-surface-nav-active-foreground)"
                          : "text-(--color-surface-nav-foreground) hover:bg-white/10"
                      }`}
                    >
                      <DocumentIcon />
                      <span className="truncate min-w-0">{doc.title}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setOpenActionsFor(openActionsFor === doc.id ? null : doc.id)}
                      aria-label={`Actions for ${doc.title}`}
                      aria-haspopup="menu"
                      aria-expanded={openActionsFor === doc.id}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-(--color-surface-nav-foreground) hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-surface-nav-foreground)"
                    >
                      <OverflowIcon />
                    </button>
                    {openActionsFor === doc.id && (
                      <DocumentActionsMenu
                        variant="popover"
                        document={doc}
                        popoverRef={actionsPopoverRef}
                        onClose={() => setOpenActionsFor(null)}
                        onReviewPagesClick={handleReviewPagesClick}
                        onDeleteClick={() => handleDeleteDocClick(doc)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
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

            {finishedDocuments.length > 0 && (
              <div className="mt-2 border-t border-white/10 pt-2">
                <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-(--color-surface-nav-foreground-muted)">
                  Documents
                </p>
                {finishedDocuments.map((doc) => {
                  const active = pathname === "/app/workspace" && searchParams.get("documentId") === doc.id;
                  return (
                    <div key={doc.id} className="flex items-center gap-0.5">
                      <Link
                        href={`/app/workspace?documentId=${doc.id}`}
                        onClick={() => setMenuOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`flex h-10 min-w-0 flex-1 items-center gap-3 rounded-md px-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-surface-nav-foreground) ${
                          active
                            ? "bg-(--color-surface-nav-active-bg) text-(--color-surface-nav-active-foreground)"
                            : "text-(--color-surface-nav-foreground) hover:bg-white/10"
                        }`}
                      >
                        <DocumentIcon />
                        <span className="truncate min-w-0">{doc.title}</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setOpenActionsFor(doc.id)}
                        aria-label={`Actions for ${doc.title}`}
                        aria-haspopup="menu"
                        aria-expanded={openActionsFor === doc.id}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-(--color-surface-nav-foreground) hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-surface-nav-foreground)"
                      >
                        <OverflowIcon />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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

      {/* Mobile action sheet: rendered once here at the top level (not nested inside the mobile
          menu's own <nav>) because that nav and the fixed bottom tab bar are z-index siblings --
          the bottom tab bar comes later in DOM order and would otherwise win the stacking tie and
          intercept taps on the sheet's buttons despite the sheet's own higher z-index, since a
          z-index only wins against siblings within the same stacking context as its parent. */}
      {openActionsFor &&
        (() => {
          const doc = finishedDocuments.find((d) => d.id === openActionsFor);
          if (!doc) return null;
          return (
            <div id="mobile-action-sheet-root" className="md:hidden">
              <DocumentActionsMenu
                variant="sheet"
                document={doc}
                sheetRef={actionsSheetRef}
                onClose={() => setOpenActionsFor(null)}
                onReviewPagesClick={() => {
                  setOpenActionsFor(null);
                  setMenuOpen(false);
                }}
                onDeleteClick={() => handleDeleteDocClick(doc)}
              />
            </div>
          );
        })()}

      {/* Delete document confirmation modal, reachable from the sidenav/mobile-menu overflow
          actions on any finished document. Mirrors app/app/dashboard/page.tsx's delete-document
          modal pattern exactly (same copy, same layout, same Cancel/Delete Button pair) since
          this is the same destructive action, just reachable from a second entry point. */}
      {deleteDocModal.isOpen && deleteDocModal.document && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleDeleteDocCancel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="nav-delete-modal-title"
        >
          <div
            ref={deleteDocModalRef}
            className="bg-(--color-background-card) rounded-lg shadow-xl max-w-md w-full p-6 border border-(--color-border-card)"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              <h2
                id="nav-delete-modal-title"
                className="font-(--font-weight-h2) mb-2"
                style={{ fontSize: 'var(--font-size-h2)', color: 'var(--color-text-heading)' }}
              >
                Delete document?
              </h2>
              <p style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-body)' }}>
                This will permanently delete{" "}
                <span className="font-medium">{deleteDocModal.document.title}</span> and all its
                pages. This action cannot be undone.
              </p>
              {deleteDocModal.error && (
                <p className="text-(--color-accent-destructive) text-sm mt-2">{deleteDocModal.error}</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                onClick={handleDeleteDocCancel}
                disabled={deleteDocModal.isDeleting}
                variant="secondary"
                size="md"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteDocConfirm}
                disabled={deleteDocModal.isDeleting}
                variant="danger"
                size="md"
                isLoading={deleteDocModal.isDeleting}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
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

function DocumentIcon() {
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
        d="M5 3h7l3 3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 3v3h3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Overflow actions (Review pages / Delete document) for one finished-document sidenav/mobile-menu
// row. Deliberately short and focused -- two actions only, per the chosen UX direction. Renders
// either an anchored popover (desktop, "popover") or a bottom action sheet (mobile, "sheet");
// callers pass the matching ref/variant rather than this component picking responsively itself,
// since the two call sites already live in separate desktop/mobile JSX blocks (matching this
// file's existing convention of duplicating desktop vs. mobile nav markup rather than branching
// internally on viewport).
function DocumentActionsMenu({
  variant,
  document,
  popoverRef,
  sheetRef,
  onClose,
  onReviewPagesClick,
  onDeleteClick,
}: {
  variant: "popover" | "sheet";
  document: FinishedDocument;
  popoverRef?: React.RefObject<HTMLDivElement | null>;
  sheetRef?: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onReviewPagesClick: () => void;
  onDeleteClick: () => void;
}) {
  if (variant === "popover") {
    return (
      <>
        {/* Invisible backdrop: closes the popover on an outside click without dimming the page,
            matching typical popover (not modal) weight. */}
        <div className="fixed inset-0 z-40" onClick={onClose} />
        <div
          ref={popoverRef}
          role="menu"
          aria-label={`Actions for ${document.title}`}
          className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-(--color-border-card) bg-(--color-background-card) py-1 shadow-lg"
        >
          <Link
            href={`/app/workspace?documentId=${document.id}&panel=pages`}
            role="menuitem"
            onClick={onReviewPagesClick}
            className="flex h-9 items-center px-3 text-sm text-(--color-text-body) hover:bg-(--color-background-subtle)"
          >
            Review pages
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={onDeleteClick}
            className="flex h-9 w-full items-center px-3 text-left text-sm text-(--color-accent-destructive) hover:bg-(--color-background-subtle)"
          >
            Delete document
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        role="menu"
        aria-label={`Actions for ${document.title}`}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t border-(--color-border-card) bg-(--color-background-card) p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg"
      >
        <p className="truncate px-3 pb-2 pt-1 text-sm font-medium text-(--color-text-meta)">
          {document.title}
        </p>
        <Link
          href={`/app/workspace?documentId=${document.id}&panel=pages`}
          role="menuitem"
          onClick={onReviewPagesClick}
          className="flex min-h-11 items-center rounded-md px-3 text-base text-(--color-text-body) hover:bg-(--color-background-subtle)"
        >
          Review pages
        </Link>
        <button
          type="button"
          role="menuitem"
          onClick={onDeleteClick}
          className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-base text-(--color-accent-destructive) hover:bg-(--color-background-subtle)"
        >
          Delete document
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-1 flex min-h-11 w-full items-center justify-center rounded-md border border-(--color-border-strong) text-base font-medium text-(--color-text-body) hover:bg-(--color-background-subtle)"
        >
          Cancel
        </button>
      </div>
    </>
  );
}

function OverflowIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <circle cx="10" cy="4.5" r="1.4" />
      <circle cx="10" cy="10" r="1.4" />
      <circle cx="10" cy="15.5" r="1.4" />
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
