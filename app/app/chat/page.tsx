// Temporary AI chat UI (docs/06_AI_Safety_and_Persona.md, docs/07_Launch_Readiness_Checklist.md
// §5–§6).
//
// Minimal flow to validate Phase 6: pick up to 3 READY documents, start an ephemeral chat, ask
// grounded questions, see supporting document/page sources, and hit limit warnings safely. There
// are deliberately no "save chat" / history affordances — chat is temporary only.

"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { startChat, sendMessage } from "@/lib/actions/chat";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

type DocumentStatus =
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PROCESSING"
  | "READY"
  | "PROCESSING_FAILED";

interface ReadyDocument {
  id: string;
  title: string;
  status: DocumentStatus;
}

interface ChatSource {
  documentId: string;
  documentTitle: string;
  pageId: string | null;
  pageNumber: number | null;
}

interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  sources: ChatSource[];
}

interface ChatLimits {
  userMessageCount: number;
  totalMessageCount: number;
  maxUserMessages: number;
  maxTotalMessages: number;
  limitReached: boolean;
  approachingLimit: boolean;
}

const MAX_DOCUMENTS = 3;

export default function ChatPage() {
  const [readyDocuments, setReadyDocuments] = useState<ReadyDocument[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  // Set once the workspace is owned by a signed-in account (Phase 7). null while temporary.
  const [savedUserId, setSavedUserId] = useState<string | null>(null);

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

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function loadReadyDocuments() {
      try {
        const statusRes = await fetch("/api/session/status");
        const status = await statusRes.json();
        setSavedUserId(status.userId ?? null);
        // A temporary session OR a signed-in account (Phase 7) can own READY documents.
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

  function toggleDocument(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((docId) => docId !== id);
      }
      if (prev.length >= MAX_DOCUMENTS) {
        return prev; // Enforce the 3-document max in the UI (server also enforces it).
      }
      return [...prev, id];
    });
  }

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

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !chatSessionId || isSending) return;

    setIsSending(true);
    setError(null);

    // Optimistically show the user's question; the server persists it and returns the answer.
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
      // Roll back the optimistic message so the count stays truthful.
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMessage.id));
      setInput(trimmed);
      setError(
        err instanceof Error ? err.message : "We couldn't send your message. Please try again."
      );
    } finally {
      setIsSending(false);
    }
  }

  // ---- Selection screen -----------------------------------------------------
  if (!chatSessionId) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h1
            className="font-(--font-weight-h2)"
            style={{ fontSize: 'var(--font-size-h2)', color: 'var(--color-text-heading)' }}
          >
            Ask about your documents
          </h1>
          <div className="flex items-center gap-3">
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

        {error && (
          <div 
            className="mb-4 rounded-md p-3" 
            style={{ 
              backgroundColor: 'var(--color-accent-destructive-bg)', 
              borderColor: 'var(--color-border-card)' 
            }}
          >
            <p 
              className="text-sm" 
              style={{ color: 'var(--color-accent-destructive)' }}
            >
              {error}
            </p>
          </div>
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
                      className={`flex items-center gap-3 rounded-lg p-3 cursor-pointer ${
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
              disabled={selectedIds.length === 0}
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

  // ---- Chat screen ----------------------------------------------------------
  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-7.5rem)] md:h-dvh p-4 md:p-6">
      <div className="flex items-center justify-between mb-3">
        <h1
          className="font-(--font-weight-h3)"
          style={{ fontSize: 'var(--font-size-h3)', color: 'var(--color-text-heading)' }}
        >
          Chat
        </h1>
        <div className="flex items-center gap-3">
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

      <Card
        variant="default"
        padding="sm"
        shadow={false}
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
                {message.sources.map((source, index) => (
                  <React.Fragment key={`${source.documentId}-${source.pageId}`}>
                    {index > 0 && <span className="mx-1">,</span>}
                    <Badge variant="processing" size="sm">
                      {source.pageNumber
                        ? `${source.documentTitle}, Page ${source.pageNumber}`
                        : source.documentTitle}
                    </Badge>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </Card>

      {limits?.approachingLimit && !limits.limitReached && (
        <div 
          className="mt-2 p-2 rounded-md" 
          style={{ backgroundColor: 'var(--color-accent-warning-bg)' }}
        >
          <p 
            style={{ 
              color: 'var(--color-accent-warning)', 
              fontSize: 'var(--font-size-caption)' 
            }}
          >
            This chat is getting long. For the clearest answers, you may want to start a fresh chat
            soon.
          </p>
        </div>
      )}

      {error && (
        <div 
          className="mt-2 rounded-md p-2" 
          style={{ 
            backgroundColor: 'var(--color-accent-destructive-bg)', 
            borderColor: 'var(--color-border-card)' 
          }}
        >
          <p 
            className="text-sm" 
            style={{ color: 'var(--color-accent-destructive)' }}
          >
            {error}
          </p>
        </div>
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
            placeholder="Ask a question…"
            disabled={isSending}
            fullWidth={false}
            className="flex-1"
            style={{
              color: 'var(--color-text-body)',
              backgroundColor: 'var(--color-background-page)'
            }}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim()}
            isLoading={isSending}
            variant="primary"
          >
            Send
          </Button>
        </div>
      )}
    </div>
  );
}
