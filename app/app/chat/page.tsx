// Temporary AI chat UI (docs/06_AI_Safety_and_Persona.md, docs/07_Launch_Readiness_Checklist.md
// §5–§6).
//
// Minimal flow to validate Phase 6: pick up to 3 READY documents, start an ephemeral chat, ask
// grounded questions, see supporting document/page sources, and hit limit warnings safely. There
// are deliberately no "save chat" / history affordances — chat is temporary only.

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { startChat, sendMessage } from "@/lib/actions/chat";

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
        if (!status.sessionId) {
          setIsLoadingDocuments(false);
          return;
        }

        const docsRes = await fetch(`/api/documents?sessionId=${status.sessionId}`);
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
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Ask about your documents</h1>
          <Link href="/app/workspace" className="text-sm text-blue-600 hover:underline">
            Back to workspace
          </Link>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Select up to {MAX_DOCUMENTS} ready documents. Answers come only from the text in the
          documents you choose.
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {isLoadingDocuments ? (
          <p className="text-sm text-gray-500">Loading your documents…</p>
        ) : readyDocuments.length === 0 ? (
          <div className="rounded-lg border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-700">
              You don&apos;t have any ready documents yet. Finish a document to chat about it.
            </p>
            <Link
              href="/app/workspace"
              className="inline-block mt-3 text-sm font-medium text-blue-600 hover:underline"
            >
              Go to workspace
            </Link>
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {readyDocuments.map((doc) => {
                const checked = selectedIds.includes(doc.id);
                const disabled = !checked && selectedIds.length >= MAX_DOCUMENTS;
                return (
                  <li key={doc.id}>
                    <label
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${
                        checked
                          ? "border-blue-500 bg-blue-50"
                          : disabled
                          ? "border-gray-200 opacity-50 cursor-not-allowed"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleDocument(doc.id)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium text-gray-900">{doc.title}</span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <p className="mt-2 text-xs text-gray-500">
              {selectedIds.length} of {MAX_DOCUMENTS} selected
            </p>

            <button
              onClick={handleStartChat}
              disabled={selectedIds.length === 0 || isStarting}
              className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isStarting ? "Starting…" : "Start chat"}
            </button>
          </>
        )}
      </div>
    );
  }

  // ---- Chat screen ----------------------------------------------------------
  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[100dvh] p-4 sm:p-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-semibold text-gray-900">Chat</h1>
        <Link href="/app/workspace" className="text-sm text-blue-600 hover:underline">
          Back to workspace
        </Link>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {activeDocuments.map((doc) => (
          <span
            key={doc.documentId}
            className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
          >
            {doc.title}
          </span>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto rounded-lg border border-gray-200 p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500">
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
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              {message.content}
            </div>
            {message.role === "ASSISTANT" && message.sources.length > 0 && (
              <div className="mt-1 text-xs text-gray-500">
                Sources:{" "}
                {message.sources
                  .map((source) =>
                    source.pageNumber
                      ? `${source.documentTitle} (page ${source.pageNumber})`
                      : source.documentTitle
                  )
                  .join(", ")}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {limits?.approachingLimit && !limits.limitReached && (
        <p className="mt-2 text-xs text-amber-700">
          This chat is getting long. For the clearest answers, you may want to start a fresh chat
          soon.
        </p>
      )}

      {error && (
        <div className="mt-2 rounded-md bg-red-50 border border-red-200 p-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {limits?.limitReached ? (
        <div className="mt-3 rounded-md bg-gray-100 p-3 text-center text-sm text-gray-700">
          This chat has reached its limit. Start a new chat for more questions.
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
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
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={handleSend}
            disabled={isSending || !input.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSending ? "…" : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}
