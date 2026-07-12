// Tests for temporary chat orchestration (docs/06_AI_Safety_and_Persona.md,
// docs/07_Launch_Readiness_Checklist.md §5–§6, docs/09_Coding_Risk_Register.md R-002/R-004).
//
// Covers: session creation validates the selection first; message limits are enforced before the
// model is called; follow-ups include prior history; grounded answers persist true source
// mappings; missing-source answers persist NO citation; conflicts surface both sources; chat is
// scoped by owner + expiry (not permanent history) and messages are per-session.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createChatSession,
  sendChatMessage,
  getChatSessionState,
} from "@/lib/chat/session";
import { prisma } from "@/lib/database/prisma";
import { assembleChatContext } from "@/lib/chat/context";
import { generateChatAnswer } from "@/lib/chat/client";
import { CHAT_MAX_USER_MESSAGES } from "@/lib/constants";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    chatSession: { create: vi.fn(), findFirst: vi.fn() },
    chatMessage: { findMany: vi.fn(), create: vi.fn() },
    document: { findMany: vi.fn() },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/chat/context", () => ({
  assembleChatContext: vi.fn(),
}));

vi.mock("@/lib/chat/client", () => ({
  generateChatAnswer: vi.fn(),
}));

const owner = { kind: "temporary" as const, temporarySessionId: "session-123" };

const singleDocContext = {
  documents: [
    {
      documentNumber: 1,
      documentId: "doc-1",
      title: "Conditions",
      pages: [{ pageNumber: 1, pageId: "page-1", text: "Report monthly." }],
    },
  ],
  documentsBlock: "=== Document 1 ===\nReport monthly.",
  totalCharacters: 15,
};

const twoDocContext = {
  documents: [
    {
      documentNumber: 1,
      documentId: "doc-1",
      title: "Old Conditions",
      pages: [{ pageNumber: 1, pageId: "page-1", text: "Curfew at 8pm." }],
    },
    {
      documentNumber: 2,
      documentId: "doc-2",
      title: "New Conditions",
      pages: [{ pageNumber: 1, pageId: "page-2", text: "Curfew at 10pm." }],
    },
  ],
  documentsBlock: "=== Document 1 ===\nCurfew at 8pm.\n\n=== Document 2 ===\nCurfew at 10pm.",
  totalCharacters: 28,
};

// chatMessage.create echoes back what it was asked to create so orchestration can build its view.
function mockChatMessageCreate() {
  vi.mocked(prisma.chatMessage.create).mockImplementation(((args: any) => {
    if (args.data.role === "USER") {
      return Promise.resolve({
        id: "user-msg",
        role: "USER",
        content: args.data.content,
        createdAt: new Date(),
      });
    }
    const created = (args.data.sources?.create ?? []).map((s: any) => ({
      documentId: s.documentId,
      pageId: s.pageId,
      document: { title: "T" },
    }));
    return Promise.resolve({
      id: "asst-msg",
      role: "ASSISTANT",
      content: args.data.content,
      createdAt: new Date(),
      sources: created,
    });
  }) as any);
}

// The 2nd op in the send transaction is the assistant message.create call args.
function assistantCreateArgs() {
  const calls = vi.mocked(prisma.chatMessage.create).mock.calls;
  const call = calls.find((c: any[]) => (c[0] as any).data.role === "ASSISTANT");
  return (call![0] as any).data;
}

describe("createChatSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.chatSession.create).mockResolvedValue({ id: "chat-1" } as any);
  });

  it("validates the selection, then creates a session attached to the selected documents", async () => {
    vi.mocked(assembleChatContext).mockResolvedValue(singleDocContext as any);

    const state = await createChatSession(owner, ["doc-1"]);

    expect(assembleChatContext).toHaveBeenCalledWith(owner, ["doc-1"]);
    const createArgs = vi.mocked(prisma.chatSession.create).mock.calls[0][0] as any;
    expect(createArgs.data.temporarySessionId).toBe("session-123");
    expect(createArgs.data.expiresAt).toBeInstanceOf(Date);
    expect(createArgs.data.documents.create).toEqual([{ documentId: "doc-1" }]);

    expect(state.chatSessionId).toBe("chat-1");
    expect(state.documents).toEqual([{ documentId: "doc-1", title: "Conditions" }]);
    expect(state.messages).toEqual([]); // a fresh session starts with no history
  });

  it("does not create a session when the selection is invalid (e.g. a non-owned/non-READY doc)", async () => {
    vi.mocked(assembleChatContext).mockRejectedValue(
      Object.assign(new Error("unavailable"), { code: "DOCUMENT_NOT_AVAILABLE" })
    );

    await expect(createChatSession(owner, ["doc-x"])).rejects.toMatchObject({
      code: "DOCUMENT_NOT_AVAILABLE",
    });
    expect(prisma.chatSession.create).not.toHaveBeenCalled();
  });
});

describe("sendChatMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.chatSession.findFirst).mockResolvedValue({
      id: "chat-1",
      temporarySessionId: "session-123",
      documents: [{ documentId: "doc-1" }],
    } as any);
    vi.mocked(assembleChatContext).mockResolvedValue(singleDocContext as any);
    mockChatMessageCreate();
  });

  it("scopes the chat lookup by owner AND expiry (temporary, not permanent history)", async () => {
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([]);
    vi.mocked(generateChatAnswer).mockResolvedValue({
      answer: "You report monthly.",
      foundRelevantSource: true,
      conflictDetected: false,
      sources: [{ documentNumber: 1, pageNumbers: [1] }],
    });

    await sendChatMessage(owner, "chat-1", "Do I report monthly?");

    const where = (vi.mocked(prisma.chatSession.findFirst).mock.calls[0][0] as any).where;
    expect(where.id).toBe("chat-1");
    expect(where.temporarySessionId).toBe("session-123");
    expect(where.expiresAt).toHaveProperty("gt"); // expired sessions are excluded
  });

  it("throws when the chat session is not found / expired / not owned", async () => {
    vi.mocked(prisma.chatSession.findFirst).mockResolvedValue(null);

    await expect(sendChatMessage(owner, "chat-1", "hi")).rejects.toMatchObject({
      code: "CHAT_SESSION_NOT_FOUND",
    });
    expect(generateChatAnswer).not.toHaveBeenCalled();
  });

  it("includes prior temporary chat history when answering a follow-up", async () => {
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([
      { role: "USER", content: "What is my curfew?", createdAt: new Date(1) },
      { role: "ASSISTANT", content: "It is 9pm.", createdAt: new Date(2) },
    ] as any);
    vi.mocked(generateChatAnswer).mockResolvedValue({
      answer: "Yes, 9pm every night.",
      foundRelevantSource: true,
      conflictDetected: false,
      sources: [{ documentNumber: 1, pageNumbers: [1] }],
    });

    await sendChatMessage(owner, "chat-1", "Every night?");

    expect(generateChatAnswer).toHaveBeenCalledWith({
      documentsBlock: singleDocContext.documentsBlock,
      history: [
        { role: "user", content: "What is my curfew?" },
        { role: "assistant", content: "It is 9pm." },
      ],
      latestUserMessage: "Every night?",
    });
  });

  it("enforces the user-message limit BEFORE calling the model", async () => {
    const maxedOut = Array.from({ length: CHAT_MAX_USER_MESSAGES }, () => ({
      role: "USER",
      content: "q",
      createdAt: new Date(),
    }));
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValue(maxedOut as any);

    await expect(sendChatMessage(owner, "chat-1", "one more")).rejects.toMatchObject({
      code: "CHAT_LIMIT_REACHED",
    });
    expect(generateChatAnswer).not.toHaveBeenCalled();
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it("rejects an empty message", async () => {
    await expect(sendChatMessage(owner, "chat-1", "   ")).rejects.toMatchObject({
      code: "EMPTY_MESSAGE",
    });
  });

  it("persists a grounded answer with true source mappings (documentNumber/pageNumber -> ids)", async () => {
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([]);
    vi.mocked(generateChatAnswer).mockResolvedValue({
      answer: "You must report to your officer monthly.",
      foundRelevantSource: true,
      conflictDetected: false,
      sources: [{ documentNumber: 1, pageNumbers: [1] }],
    });

    const result = await sendChatMessage(owner, "chat-1", "What are my reporting rules?");

    expect(assistantCreateArgs().sources.create).toEqual([
      { documentId: "doc-1", pageId: "page-1" },
    ]);
    expect(result.message.sources).toEqual([
      { documentId: "doc-1", documentTitle: "Conditions", pageId: "page-1", pageNumber: 1 },
    ]);
  });

  it("stores NO citation for a missing-source answer, even if the model returned sources", async () => {
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([]);
    vi.mocked(generateChatAnswer).mockResolvedValue({
      answer: "No relevant source was found in the selected documents.",
      foundRelevantSource: false,
      // A defensive case: the model wrongly included a citation; it must be ignored.
      conflictDetected: false,
      sources: [{ documentNumber: 1, pageNumbers: [1] }],
    });

    const result = await sendChatMessage(owner, "chat-1", "Can I travel to Canada?");

    expect(assistantCreateArgs().sources.create).toEqual([]);
    expect(result.message.sources).toEqual([]);
  });

  it("surfaces both sources for a conflicting-document answer", async () => {
    vi.mocked(prisma.chatSession.findFirst).mockResolvedValue({
      id: "chat-1",
      temporarySessionId: "session-123",
      documents: [{ documentId: "doc-1" }, { documentId: "doc-2" }],
    } as any);
    vi.mocked(assembleChatContext).mockResolvedValue(twoDocContext as any);
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([]);
    vi.mocked(generateChatAnswer).mockResolvedValue({
      answer:
        "Document 1 says curfew is 8pm; Document 2 says 10pm. They appear to differ — confirm with your officer.",
      foundRelevantSource: true,
      conflictDetected: true,
      sources: [
        { documentNumber: 1, pageNumbers: [1] },
        { documentNumber: 2, pageNumbers: [1] },
      ],
    });

    const result = await sendChatMessage(owner, "chat-1", "What is my curfew?");

    expect(assistantCreateArgs().sources.create).toEqual([
      { documentId: "doc-1", pageId: "page-1" },
      { documentId: "doc-2", pageId: "page-2" },
    ]);
    expect(result.message.sources.map((s) => s.documentId)).toEqual(["doc-1", "doc-2"]);
  });
});

describe("getChatSessionState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.chatSession.findFirst).mockResolvedValue({
      id: "chat-1",
      temporarySessionId: "session-123",
      documents: [{ documentId: "doc-1" }],
    } as any);
    vi.mocked(prisma.document.findMany).mockResolvedValue([
      { id: "doc-1", title: "Conditions" },
    ] as any);
  });

  it("returns only messages belonging to this chat session (messages are per-session)", async () => {
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([]);

    const state = await getChatSessionState(owner, "chat-1");

    const findManyArgs = vi.mocked(prisma.chatMessage.findMany).mock.calls[0][0] as any;
    expect(findManyArgs.where).toEqual({ chatSessionId: "chat-1" });
    expect(state.messages).toEqual([]); // a separate/new session shows no other session's messages
  });

  it("throws for an expired or non-owned session", async () => {
    vi.mocked(prisma.chatSession.findFirst).mockResolvedValue(null);

    await expect(getChatSessionState(owner, "chat-1")).rejects.toMatchObject({
      code: "CHAT_SESSION_NOT_FOUND",
    });
  });
});
