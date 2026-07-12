// Temporary AI chat orchestration (docs/06_AI_Safety_and_Persona.md,
// docs/07_Launch_Readiness_Checklist.md §5–§6, docs/09_Coding_Risk_Register.md R-002/R-004).
//
// A ChatSession is ephemeral: it always has an expiresAt and is owned by exactly one owner (a
// temporary session for MVP; users arrive in Phase 7). It is NOT permanent history — reads are
// scoped by owner AND expiry, and the session cascades away with its owner. Messages persist only
// for the lifetime of this session.

import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { type Owner } from "@/lib/permissions/ownership";
import {
  CHAT_MAX_TOTAL_MESSAGES,
  CHAT_MAX_USER_MESSAGES,
  CHAT_SESSION_TTL_MINUTES,
  CHAT_WARNING_USER_MESSAGES,
} from "@/lib/constants";
import { assembleChatContext } from "@/lib/chat/context";
import { generateChatAnswer, type ChatHistoryMessage } from "@/lib/chat/client";

export interface ChatSourceView {
  documentId: string;
  documentTitle: string;
  pageId: string | null;
  pageNumber: number | null;
}

export interface ChatMessageView {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: Date;
  sources: ChatSourceView[];
}

export interface ChatLimits {
  userMessageCount: number;
  totalMessageCount: number;
  maxUserMessages: number;
  maxTotalMessages: number;
  limitReached: boolean;
  approachingLimit: boolean;
}

export interface ChatSessionState {
  chatSessionId: string;
  documents: { documentId: string; title: string }[];
  messages: ChatMessageView[];
  limits: ChatLimits;
}

export interface SendMessageResult {
  message: ChatMessageView;
  limits: ChatLimits;
}

// Owner filter for ChatSession (parallel to ownerWhere for Document, which is Document-typed).
function chatOwnerWhere(owner: Owner) {
  return owner.kind === "user"
    ? { userId: owner.userId }
    : { temporarySessionId: owner.temporarySessionId };
}

// Owner-scoped, non-expired chat session lookup. Never fetch a chat by id alone.
async function requireOwnedChatSession(owner: Owner, chatSessionId: string) {
  const chatSession = await prisma.chatSession.findFirst({
    where: {
      id: chatSessionId,
      ...chatOwnerWhere(owner),
      expiresAt: { gt: new Date() },
    },
    include: { documents: true },
  });

  if (!chatSession) {
    throw new AppError("Chat session not found.", 404, "CHAT_SESSION_NOT_FOUND");
  }

  return chatSession;
}

function computeLimits(userMessageCount: number, totalMessageCount: number): ChatLimits {
  return {
    userMessageCount,
    totalMessageCount,
    maxUserMessages: CHAT_MAX_USER_MESSAGES,
    maxTotalMessages: CHAT_MAX_TOTAL_MESSAGES,
    limitReached:
      userMessageCount >= CHAT_MAX_USER_MESSAGES ||
      totalMessageCount >= CHAT_MAX_TOTAL_MESSAGES,
    approachingLimit: userMessageCount >= CHAT_WARNING_USER_MESSAGES,
  };
}

/**
 * Creates a temporary chat session grounded in the selected READY documents.
 *
 * Selection is fully validated first (ownership, READY status, max-count, and the combined
 * confirmed-text limit) so an invalid or oversized selection never produces a session.
 */
export async function createChatSession(
  owner: Owner,
  documentIds: string[]
): Promise<ChatSessionState> {
  // Validates ownership/READY/limits and throws clearly on any problem (no truncation).
  const context = await assembleChatContext(owner, documentIds);

  const expiresAt = new Date(Date.now() + CHAT_SESSION_TTL_MINUTES * 60 * 1000);

  const chatSession = await prisma.chatSession.create({
    data: {
      ...(owner.kind === "user"
        ? { userId: owner.userId }
        : { temporarySessionId: owner.temporarySessionId }),
      expiresAt,
      documents: {
        create: context.documents.map((document) => ({ documentId: document.documentId })),
      },
    },
  });

  return {
    chatSessionId: chatSession.id,
    documents: context.documents.map((document) => ({
      documentId: document.documentId,
      title: document.title,
    })),
    messages: [],
    limits: computeLimits(0, 0),
  };
}

/**
 * Returns the current state of an owned, non-expired chat session: its documents, its messages
 * (oldest first, with resolved source references), and its limit counters.
 */
export async function getChatSessionState(
  owner: Owner,
  chatSessionId: string
): Promise<ChatSessionState> {
  const chatSession = await requireOwnedChatSession(owner, chatSessionId);

  const [documents, messages] = await Promise.all([
    prisma.document.findMany({
      where: { id: { in: chatSession.documents.map((d) => d.documentId) } },
      select: { id: true, title: true },
    }),
    prisma.chatMessage.findMany({
      where: { chatSessionId },
      orderBy: { createdAt: "asc" },
      include: {
        sources: { include: { document: { select: { title: true } } } },
      },
    }),
  ]);

  const titleById = new Map(documents.map((d) => [d.id, d.title]));

  const messageViews: ChatMessageView[] = messages
    .filter((message) => message.role === "USER" || message.role === "ASSISTANT")
    .map((message) => ({
      id: message.id,
      role: message.role as "USER" | "ASSISTANT",
      content: message.content,
      createdAt: message.createdAt,
      sources: message.sources.map((source) => ({
        documentId: source.documentId,
        documentTitle: source.document.title,
        pageId: source.pageId,
        pageNumber: null,
      })),
    }));

  const userMessageCount = messageViews.filter((m) => m.role === "USER").length;

  return {
    chatSessionId,
    documents: chatSession.documents.map((d) => ({
      documentId: d.documentId,
      title: titleById.get(d.documentId) ?? "Untitled Document",
    })),
    messages: messageViews,
    limits: computeLimits(userMessageCount, messageViews.length),
  };
}

/**
 * Sends a user question and returns the grounded assistant answer.
 *
 * Order of operations is deliberate:
 *   1. Enforce message limits BEFORE calling the model (fail clearly, never degrade).
 *   2. Re-assemble context from the attached documents each turn (re-validates ownership/READY and
 *      the character limit; a document deleted or un-readied mid-chat is rejected here).
 *   3. Call the model with prior history for conversational context.
 *   4. Persist the user message, the assistant message, and — only when a relevant source was
 *      found — its true source references, all in one transaction. A missing-source answer stores
 *      no citation.
 */
export async function sendChatMessage(
  owner: Owner,
  chatSessionId: string,
  userMessage: string
): Promise<SendMessageResult> {
  const trimmed = userMessage.trim();
  if (!trimmed) {
    throw new AppError("Message cannot be empty.", 400, "EMPTY_MESSAGE");
  }

  const chatSession = await requireOwnedChatSession(owner, chatSessionId);

  const existingMessages = await prisma.chatMessage.findMany({
    where: { chatSessionId },
    orderBy: { createdAt: "asc" },
  });

  const priorUserCount = existingMessages.filter((m) => m.role === "USER").length;
  const priorLimits = computeLimits(priorUserCount, existingMessages.length);
  if (priorLimits.limitReached) {
    throw new AppError(
      "This chat has reached its limit. Please start a new chat.",
      429,
      "CHAT_LIMIT_REACHED"
    );
  }

  const context = await assembleChatContext(
    owner,
    chatSession.documents.map((d) => d.documentId)
  );

  const history: ChatHistoryMessage[] = existingMessages
    .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
    .map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

  const answer = await generateChatAnswer({
    documentsBlock: context.documentsBlock,
    history,
    latestUserMessage: trimmed,
  });

  // Map the model's (documentNumber, pageNumber) citations back to real ids. Only trust citations
  // when the model reported a relevant source — a missing-source answer never carries a citation.
  const resolvedSources: { documentId: string; pageId: string | null; pageNumber: number | null }[] =
    [];
  if (answer.foundRelevantSource) {
    const docByNumber = new Map(context.documents.map((d) => [d.documentNumber, d]));
    for (const source of answer.sources) {
      const document = docByNumber.get(source.documentNumber);
      if (!document) continue;
      if (source.pageNumbers.length === 0) {
        resolvedSources.push({ documentId: document.documentId, pageId: null, pageNumber: null });
        continue;
      }
      for (const pageNumber of source.pageNumbers) {
        const page = document.pages.find((p) => p.pageNumber === pageNumber);
        resolvedSources.push({
          documentId: document.documentId,
          pageId: page ? page.pageId : null,
          pageNumber: page ? page.pageNumber : null,
        });
      }
    }
  }

  const [, assistantMessage] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: { chatSessionId, role: "USER", content: trimmed },
    }),
    prisma.chatMessage.create({
      data: {
        chatSessionId,
        role: "ASSISTANT",
        content: answer.answer,
        sources: {
          create: resolvedSources.map((source) => ({
            documentId: source.documentId,
            pageId: source.pageId,
          })),
        },
      },
      include: { sources: { include: { document: { select: { title: true } } } } },
    }),
  ]);

  const titleByDocumentId = new Map(
    context.documents.map((d) => [d.documentId, d.title])
  );
  const pageNumberByPageId = new Map(
    context.documents.flatMap((d) => d.pages.map((p) => [p.pageId, p.pageNumber] as const))
  );

  const message: ChatMessageView = {
    id: assistantMessage.id,
    role: "ASSISTANT",
    content: assistantMessage.content,
    createdAt: assistantMessage.createdAt,
    sources: assistantMessage.sources.map((source) => ({
      documentId: source.documentId,
      documentTitle: titleByDocumentId.get(source.documentId) ?? source.document.title,
      pageId: source.pageId,
      pageNumber: source.pageId ? pageNumberByPageId.get(source.pageId) ?? null : null,
    })),
  };

  return {
    message,
    limits: computeLimits(priorUserCount + 1, existingMessages.length + 2),
  };
}
