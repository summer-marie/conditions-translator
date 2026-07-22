/**
 * Temporary AI chat orchestration (`docs/06_AI_Safety_and_Persona.md`,
 * `docs/07_Launch_Readiness_Checklist.md` §5–§6, `docs/09_Coding_Risk_Register.md`
 * R-002/R-004).
 *
 * A `ChatSession` is ephemeral: it always carries an `expiresAt` and is owned by exactly
 * one owner (a temporary session for MVP; users arrive in Phase 7). It is NOT permanent
 * history — every read is scoped by owner AND expiry, and the session cascades away with
 * its owner. Messages persist only for the lifetime of the session.
 *
 * @module lib/chat/session
 */

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
import { requireChatDisclaimerAcknowledged } from "@/lib/session/chatDisclaimer";

/** A resolved citation attached to an assistant message, ready for display. */
export interface ChatSourceView {
  /** Cited document's id. */
  documentId: string;
  /** Cited document's title. */
  documentTitle: string;
  /** Cited page's id, or `null` for a document-level citation. */
  pageId: string | null;
  /** Cited page's 1-based number, or `null` when not page-specific. */
  pageNumber: number | null;
}

/** A single chat message shaped for the UI. */
export interface ChatMessageView {
  /** Message id. */
  id: string;
  /** Author of the message. */
  role: "USER" | "ASSISTANT";
  /** Message text. */
  content: string;
  /** Creation timestamp (used for ordering and display). */
  createdAt: Date;
  /** Resolved supporting citations (empty for user messages and missing-source answers). */
  sources: ChatSourceView[];
}

/** Message-budget counters and derived warning/blocking flags for a chat session. */
export interface ChatLimits {
  /** Number of user questions asked so far. */
  userMessageCount: number;
  /** Total messages (user + assistant) so far. */
  totalMessageCount: number;
  /** Hard cap on user questions. */
  maxUserMessages: number;
  /** Hard cap on total messages. */
  maxTotalMessages: number;
  /** True once either hard cap is reached; further sends are rejected. */
  limitReached: boolean;
  /** True once the soft warning threshold is crossed (UI nudges a fresh chat). */
  approachingLimit: boolean;
}

/** Full snapshot of a chat session returned to the client. */
export interface ChatSessionState {
  /** The session's id. */
  chatSessionId: string;
  /** The documents grounding this chat. */
  documents: { documentId: string; title: string }[];
  /** All messages so far, oldest first. */
  messages: ChatMessageView[];
  /** Current message-budget state. */
  limits: ChatLimits;
}

/** Result of {@link sendChatMessage}: the new assistant message plus updated limits. */
export interface SendMessageResult {
  /** The assistant's answer message with resolved sources. */
  message: ChatMessageView;
  /** Message-budget state after this turn. */
  limits: ChatLimits;
}

/**
 * Builds the owner filter for a `ChatSession` query.
 *
 * Parallel to `ownerWhere` for Document, but returns ChatSession-shaped columns.
 *
 * @param owner - The current owner.
 * @returns A Prisma `where` fragment scoping to that owner's chat sessions.
 */
function chatOwnerWhere(owner: Owner) {
  return owner.kind === "user"
    ? { userId: owner.userId }
    : { temporarySessionId: owner.temporarySessionId };
}

/**
 * Loads a chat session scoped to its owner and non-expired, with its attached documents.
 *
 * Never fetches a chat by id alone — the owner and expiry guards are mandatory so an
 * expired or unowned session is indistinguishable from "not found".
 *
 * @param owner - The current owner.
 * @param chatSessionId - The session id to load.
 * @returns The owned, live `ChatSession` including its `documents`.
 * @throws {AppError} `CHAT_SESSION_NOT_FOUND` (404) when no live owned session matches.
 */
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

/**
 * Derives the {@link ChatLimits} view from raw message counts.
 *
 * @param userMessageCount - Number of user questions asked.
 * @param totalMessageCount - Total messages (user + assistant).
 * @returns The counters plus `limitReached`/`approachingLimit` flags.
 */
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
 * The selection is fully validated first (ownership, READY status, max-count, and the
 * combined confirmed-text limit), so an invalid or oversized selection never produces a
 * session. The session is created with its `expiresAt` already set and its documents
 * attached.
 *
 * @param owner - The owner the session belongs to.
 * @param documentIds - Ids of the READY documents to ground the chat in.
 * @returns The initial {@link ChatSessionState} (no messages, zeroed limits).
 * @throws {AppError} `CHAT_DISCLAIMER_NOT_ACKNOWLEDGED` (403) when the owner hasn't
 *   acknowledged the chat disclaimer yet — enforced server-side so chat entry never relies
 *   on client state alone.
 * @throws {AppError} Propagated from `assembleChatContext` for any invalid selection.
 */
export async function createChatSession(
  owner: Owner,
  documentIds: string[]
): Promise<ChatSessionState> {
  await requireChatDisclaimerAcknowledged(owner);

  // Validates ownership/READY/limits and throws clearly on any problem (never truncates).
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
 * Returns the current state of an owned, non-expired chat session.
 *
 * Loads the session's documents and messages in parallel, resolves each message's source
 * citations to document titles, and computes the current limit counters.
 *
 * @param owner - The current owner; scopes the lookup.
 * @param chatSessionId - The session to load.
 * @returns The full {@link ChatSessionState}: documents, messages (oldest first, with
 *   resolved sources), and limits.
 * @throws {AppError} `CHAT_SESSION_NOT_FOUND` (404) when no live owned session matches.
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
 * The order of operations is deliberate and security-relevant:
 *
 * 1. Enforce message limits BEFORE calling the model (fail clearly, never degrade).
 * 2. Re-assemble context from the attached documents *every turn*. This re-validates
 *    ownership, READY status, and the character limit, so a document deleted or
 *    un-readied mid-chat is rejected here rather than silently reused.
 * 3. Call the model with prior history for conversational context.
 * 4. Persist the user message, the assistant message, and — only when a relevant source
 *    was found — its true source references, all in one transaction. A missing-source
 *    answer stores no citation.
 *
 * @param owner - The current owner; scopes the session and its documents.
 * @param chatSessionId - The session receiving the message.
 * @param userMessage - The user's raw question text.
 * @returns The persisted assistant {@link ChatMessageView} and post-turn {@link ChatLimits}.
 * @throws {AppError} `EMPTY_MESSAGE` (400) when the message is blank.
 * @throws {AppError} `CHAT_DISCLAIMER_NOT_ACKNOWLEDGED` (403) when the owner hasn't
 *   acknowledged the chat disclaimer yet — enforced server-side so chat use never relies on
 *   client state alone (defense in depth alongside the same check in {@link createChatSession}).
 * @throws {AppError} `CHAT_SESSION_NOT_FOUND` (404) when the session is unowned or expired.
 * @throws {AppError} `CHAT_LIMIT_REACHED` (429) when the session's message budget is exhausted.
 * @throws {AppError} Propagated from context assembly or the model call on failure.
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

  await requireChatDisclaimerAcknowledged(owner);

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

  // Translate the model's (documentNumber, pageNumber) citations back to real ids, and
  // only when it reported a relevant source. Unknown numbers are dropped rather than
  // trusted, so a hallucinated citation can never point at an unrelated document/page.
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
