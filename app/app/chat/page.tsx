/**
 * Temporary AI chat UI (`docs/06_AI_Safety_and_Persona.md`,
 * `docs/07_Launch_Readiness_Checklist.md` §5–§6).
 *
 * The Phase 6 flow: pick up to 3 READY documents, start an ephemeral chat, ask grounded
 * questions, see supporting document/page sources, and hit limit warnings safely. There are
 * deliberately no "save chat" / history affordances — chat is temporary only.
 *
 * @module app/app/chat/page
 */

"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { startChat, sendMessage } from "@/lib/actions/chat";
import { acknowledgeChatDisclaimer } from "@/lib/actions/chatDisclaimer";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { DocumentInspector } from "@/components/chat/DocumentInspector";
import { ChatDisclaimerSheet } from "@/components/chat/ChatDisclaimerSheet";

/** A document's lifecycle status, as returned by the documents API. */
type DocumentStatus =
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PROCESSING"
  | "READY"
  | "PROCESSING_FAILED";

/** A READY document eligible for selection into a chat. */
interface ReadyDocument {
  id: string;
  title: string;
  status: DocumentStatus;
}

/** A resolved citation attached to an assistant message. */
interface ChatSource {
  documentId: string;
  documentTitle: string;
  pageId: string | null;
  pageNumber: number | null;
}

/** A chat message shaped for rendering. */
interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  sources: ChatSource[];
}

/** Message-budget counters and warning/blocking flags for the active chat. */
interface ChatLimits {
  userMessageCount: number;
  totalMessageCount: number;
  maxUserMessages: number;
  maxTotalMessages: number;
  limitReached: boolean;
  approachingLimit: boolean;
}

/** UI cap on documents selectable into one chat (the server enforces the same limit). */
const MAX_DOCUMENTS = 3;

/**
 * Renders the chat page: document selection, then the grounded chat with its inspector panel.
 *
 * State & side effects:
 * - Loads the current owner (via `/api/session/status`) and their READY documents on mount.
 * - Tracks the document selection, then the active chat session (id, documents, messages,
 *   limits) once started.
 * - Optimistically renders the user's message on send, rolling it back on failure.
 * - Derives the set of cited page ids for the desktop {@link DocumentInspector} and auto-scrolls
 *   to the newest message.
 *
 * @returns The rendered selection screen, or the chat screen once a session is started.
 */
export default function ChatPage() {
  const [readyDocuments, setReadyDocuments] = useState<ReadyDocument[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  // Set to the account id once the workspace is owned by a signed-in user (Phase 7); null while
  // the workspace is still temporary.
  const [savedUserId, setSavedUserId] = useState<string | null>(null);
  // Chat-specific "not legal advice" disclaimer acknowledgment (lib/session/chatDisclaimer.ts) —
  // separate from the Privacy Notice gate. `null` while unknown (status still loading), so the
  // banner/sheet and the Start Chat gating below never flash before the real value is known.
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState<boolean | null>(null);
  const [isAcknowledgingDisclaimer, setIsAcknowledgingDisclaimer] = useState(false);

  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [activeDocuments, setActiveDocuments] = useState<{ documentId: string; title: string }[]>(
    []
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [limits, setLimits] = useState<ChatLimits | null>(null);

  const [isStarting, setIsStarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Desktop-only Document Inspector state: which page a clicked citation should scroll to and
  // highlight, and whether the panel is expanded (local to this screen, not persisted).
  const [focusedPageId, setFocusedPageId] = useState<string | null>(null);
  const [inspectorExpanded, setInspectorExpanded] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const citedPageIds = useMemo(() => {
    const ids = new Set<string>();
    for (const message of messages) {
      for (const source of message.sources) {
        if (source.pageId) ids.add(source.pageId);
      }
    }
    return ids;
  }, [messages]);

  useEffect(() => {
    async function loadReadyDocuments() {
      try {
        const statusRes = await fetch("/api/session/status");
        const status = await statusRes.json();
        setSavedUserId(status.userId ?? null);
        setDisclaimerAcknowledged(!!status.chatDisclaimerAcknowledged);
        // Either a temporary session or a signed-in account (Phase 7) can own READY documents;
        // bail out only when neither is present.
        if (!status.sessionId && !status.userId) {
          setIsLoadingDocuments(false);
          return;
        }

        const docsRes = await fetch(`/api/documents`);
        const data = await docsRes.json();
        const ready: ReadyDocument[] = (data.documents ?? []).filter(
          (doc: ReadyDocument) => doc.status === "READY"
        );
        setReadyDocuments(ready);
      } catch {
        setError("We couldn't load your documents. Please refresh and try again.");
      } finally {
        setIsLoadingDocuments(false);
      }
    }

    loadReadyDocuments();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * Toggles a document in/out of the selection, capping additions at {@link MAX_DOCUMENTS}.
   *
   * @param id - The document id to toggle.
   */
  function toggleDocument(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((docId) => docId !== id);
      }
      if (prev.length >= MAX_DOCUMENTS) {
        return prev; // At the UI cap; ignore further additions (the server enforces it too).
      }
      return [...prev, id];
    });
  }

  /**
   * Acknowledges the chat-specific disclaimer for the current owner, persisting it server-side
   * (`lib/actions/chatDisclaimer.ts`) so the banner/sheet does not reappear until the next
   * temporary session (or, for a signed-in user, never again).
   */
  async function handleAcknowledgeDisclaimer() {
    setIsAcknowledgingDisclaimer(true);
    setError(null);
    try {
      await acknowledgeChatDisclaimer();
      setDisclaimerAcknowledged(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't save your acknowledgment. Please try again."
      );
    } finally {
      setIsAcknowledgingDisclaimer(false);
    }
  }

  /**
   * Starts a chat grounded in the selected documents and loads the initial session state.
   */
  async function handleStartChat() {
    if (selectedIds.length === 0) return;
    setIsStarting(true);
    setError(null);
    try {
      const state = await startChat(selectedIds);
      setChatSessionId(state.chatSessionId);
      setActiveDocuments(state.documents);
      setMessages(state.messages);
      setLimits(state.limits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't start the chat. Please try again.");
    } finally {
      setIsStarting(false);
    }
  }

  /**
   * Sends the current input as a question, optimistically rendering it and rolling back on error.
   */
  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !chatSessionId || isSending) return;

    setIsSending(true);
    setError(null);

    // Show the user's question immediately; the server persists it and returns the answer.
    const optimisticUserMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "USER",
      content: trimmed,
      sources: [],
    };
    setMessages((prev) => [...prev, optimisticUserMessage]);
    setInput("");

    try {
      const result = await sendMessage(chatSessionId, trimmed);
      setMessages((prev) => [...prev, result.message]);
      setLimits(result.limits);
    } catch (err) {
      // Roll back the optimistic message (and restore the input) so the count stays truthful.
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMessage.id));
      setInput(trimmed);
      setError(
        err instanceof Error ? err.message : "We couldn't send your message. Please try again."
      );
    } finally {
      setIsSending(false);
    }
  }

  // Selection screen — shown until a chat session has been started.
  if (!chatSessionId) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h1
            className="min-w-0 truncate font-(--font-weight-h2)"
            style={{ fontSize: 'var(--font-size-h2)', color: 'var(--color-text-heading)' }}
          >
            Ask about your documents
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            {savedUserId ? (
              <Badge variant="success" size="sm">Saved</Badge>
            ) : (
              <Link
                href="/app/save"
                className="font-medium hover:underline"
                style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-body)' }}
              >
                Save workspace
              </Link>
            )}
            <Link
              href="/app/workspace"
              className="hover:underline"
              style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-accent-processing)' }}
            >
              Back to workspace
            </Link>
          </div>
        </div>

        <p
          className="mb-4"
          style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-body)' }}
        >
          Select up to {MAX_DOCUMENTS} ready documents. Answers come only from the text in the
          documents you choose.
        </p>

        {disclaimerAcknowledged === false && (
          <Alert
            tone="processing"
            role="status"
            bordered={false}
            padding="sm"
            className="hidden md:flex md:items-center md:justify-between md:gap-3 mb-4"
          >
            <p className="text-sm" style={{ color: 'var(--color-accent-processing)' }}>
              This assistant explains your documents in plain language. It is not legal advice —
              for compliance questions, talk to your supervising officer or an attorney.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAcknowledgeDisclaimer}
              isLoading={isAcknowledgingDisclaimer}
            >
              Got it
            </Button>
          </Alert>
        )}
        <ChatDisclaimerSheet
          open={disclaimerAcknowledged === false}
          onAcknowledge={handleAcknowledgeDisclaimer}
          isSubmitting={isAcknowledgingDisclaimer}
        />

        {error && (
          <Alert tone="destructive" role="alert" bordered={false} padding="sm" className="mb-4">
            <p
              className="text-sm"
              style={{ color: 'var(--color-accent-destructive)' }}
            >
              {error}
            </p>
          </Alert>
        )}

        {isLoadingDocuments ? (
          <p 
            className="text-sm" 
            style={{ color: 'var(--color-text-meta)' }}
          >
            Loading your documents…
          </p>
        ) : readyDocuments.length === 0 ? (
          <div 
            className="rounded-lg p-6 text-center" 
            style={{ 
              backgroundColor: 'var(--color-background-card)', 
              borderColor: 'var(--color-border-card)' 
            }}
          >
            <p 
              className="text-sm" 
              style={{ color: 'var(--color-text-body)' }}
            >
              You don&apos;t have any ready documents yet. Finish a document to chat about it.
            </p>
            <Link
              href="/app/workspace"
              className="inline-block mt-3 font-medium hover:underline"
              style={{ color: 'var(--color-accent-processing)' }}
            >
              Go to workspace
            </Link>
          </div>
        ) : (
          <>
            <ul 
              className="space-y-2" 
              style={{ listStyle: 'none', padding: 0, margin: 0 }}
            >
              {readyDocuments.map((doc) => {
                const checked = selectedIds.includes(doc.id);
                const disabled = !checked && selectedIds.length >= MAX_DOCUMENTS;
                return (
                  <li key={doc.id}>
                    <label
                      className={`flex items-center gap-3 rounded-lg p-3 cursor-pointer focus-within:ring-2 focus-within:ring-(--color-border-focus-ring) ${
                        checked
                          ? "border-2"
                          : disabled
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:shadow-md transition-shadow"
                      }`}
                      style={{
                        borderColor: checked ? 'var(--color-brand-primary)' : 'var(--color-border-card)',
                        backgroundColor: checked ? 'var(--color-accent-processing-bg)' : 'var(--color-background-card)'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleDocument(doc.id)}
                        className="h-4 w-4 accent-(--color-brand-primary)"
                      />
                      <span 
                        className="text-sm font-medium" 
                        style={{ color: 'var(--color-text-heading)' }}
                      >
                        {doc.title}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <p 
              className="mt-2" 
              style={{ color: 'var(--color-text-meta)', fontSize: 'var(--font-size-caption)' }}
            >
              {selectedIds.length} of {MAX_DOCUMENTS} selected
            </p>

            <Button
              onClick={handleStartChat}
              disabled={selectedIds.length === 0 || disclaimerAcknowledged !== true}
              isLoading={isStarting}
              fullWidth
              variant="primary"
              className="mt-4"
            >
              Start chat
            </Button>
          </>
        )}
      </div>
    );
  }

  // Chat screen — the message log, limit banners, composer, and desktop inspector panel.
  return (
    <div className="flex flex-col md:flex-row md:justify-center md:gap-6 h-[calc(100dvh-7.5rem)] md:h-dvh p-4 md:p-6">
    <div className="flex flex-col flex-1 min-h-0 min-w-0 max-w-2xl mx-auto md:mx-0 md:h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h1
          className="font-(--font-weight-h3)"
          style={{ fontSize: 'var(--font-size-h3)', color: 'var(--color-text-heading)' }}
        >
          Chat
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          {savedUserId ? (
            <Badge variant="success" size="sm">Saved</Badge>
          ) : (
            <Link
              href="/app/save"
              className="font-medium hover:underline"
              style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-body)' }}
            >
              Save workspace
            </Link>
          )}
          <Link
            href="/app/workspace"
            className="hover:underline"
            style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-accent-processing)' }}
          >
            Back to workspace
          </Link>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {activeDocuments.map((doc) => (
          <Badge key={doc.documentId} variant="neutral" size="sm">
            {doc.title}
          </Badge>
        ))}
      </div>

      {disclaimerAcknowledged === false && (
        <Alert
          tone="processing"
          role="status"
          bordered={false}
          padding="sm"
          className="hidden md:flex md:items-center md:justify-between md:gap-3 mb-3"
        >
          <p className="text-sm" style={{ color: 'var(--color-accent-processing)' }}>
            This assistant explains your documents in plain language. It is not legal advice —
            for compliance questions, talk to your supervising officer or an attorney.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAcknowledgeDisclaimer}
            isLoading={isAcknowledgingDisclaimer}
          >
            Got it
          </Button>
        </Alert>
      )}
      <ChatDisclaimerSheet
        open={disclaimerAcknowledged === false}
        onAcknowledge={handleAcknowledgeDisclaimer}
        isSubmitting={isAcknowledgingDisclaimer}
      />

      <Card
        variant="default"
        padding="sm"
        shadow={false}
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        className="flex-1 overflow-y-auto space-y-3"
      >
        {messages.length === 0 && (
          <p 
            className="text-sm text-center py-8" 
            style={{ color: 'var(--color-text-body)' }}
          >
            Ask a question about your selected documents to get started.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === "USER" ? "text-right" : "text-left"}
          >
            <div
              className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                message.role === "USER"
                  ? "rounded-br-md"
                  : "rounded-bl-md"
              }`}
              style={{
                backgroundColor: message.role === "USER" 
                  ? 'var(--color-brand-primary)' 
                  : 'var(--color-background-subtle)',
                color: message.role === "USER" 
                  ? 'var(--color-text-inverse)' 
                  : 'var(--color-text-body)'
              }}
            >
              {message.content}
            </div>
            {message.role === "ASSISTANT" && message.sources.length > 0 && (
              <div 
                className="mt-1 flex flex-wrap gap-1 items-center"
                style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-meta)' }}
              >
                <span>Sources:</span>
                {message.sources.map((source, index) => {
                  const label = source.pageNumber
                    ? `${source.documentTitle}, Page ${source.pageNumber}`
                    : source.documentTitle;
                  return (
                    <React.Fragment key={`${source.documentId}-${source.pageId}`}>
                      {index > 0 && <span className="mx-1">,</span>}
                      {source.pageId ? (
                        <button
                          type="button"
                          onClick={() => {
                            setFocusedPageId(source.pageId);
                            setInspectorExpanded(true);
                          }}
                          aria-label={`Jump to ${label} in the document inspector`}
                          className="rounded-full focus:outline-none focus:ring-2 focus:ring-(--color-border-focus-ring)"
                        >
                          <Badge variant="processing" size="sm">
                            {label}
                          </Badge>
                        </button>
                      ) : (
                        <Badge variant="processing" size="sm">
                          {label}
                        </Badge>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </Card>

      {limits?.approachingLimit && !limits.limitReached && (
        <Alert tone="warning" role="status" bordered={false} padding="xs" className="mt-2">
          <p
            style={{
              color: 'var(--color-accent-warning)',
              fontSize: 'var(--font-size-caption)'
            }}
          >
            This chat is getting long. For the clearest answers, you may want to start a fresh chat
            soon.
          </p>
        </Alert>
      )}

      {error && (
        <Alert tone="destructive" role="alert" bordered={false} padding="xs" className="mt-2">
          <p
            className="text-sm"
            style={{ color: 'var(--color-accent-destructive)' }}
          >
            {error}
          </p>
        </Alert>
      )}

      {limits?.limitReached ? (
        <div 
          className="mt-3 rounded-md p-3 text-center" 
          style={{ 
            backgroundColor: 'var(--color-background-subtle)', 
            color: 'var(--color-text-body)' 
          }}
        >
          <p className="text-sm">
            This chat has reached its limit. Start a new chat for more questions.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            aria-label="Ask a question"
            placeholder="Ask a question…"
            disabled={isSending || disclaimerAcknowledged !== true}
            fullWidth={false}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || disclaimerAcknowledged !== true}
            isLoading={isSending}
            variant="primary"
          >
            Send
          </Button>
        </div>
      )}
    </div>
    <DocumentInspector
      documents={activeDocuments}
      citedPageIds={citedPageIds}
      focusedPageId={focusedPageId}
      expanded={inspectorExpanded}
      onToggleExpanded={() => setInspectorExpanded((prev) => !prev)}
      className="hidden md:flex md:flex-col md:w-80 md:shrink-0 md:h-full"
    />
    </div>
  );
}
