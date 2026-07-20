/**
 * Server Actions for temporary AI chat.
 *
 * Each action resolves the current owner (temporary session for MVP; Phase 7 adds users)
 * and delegates to the ownership-scoped orchestration in `lib/chat/session.ts`. All
 * authorization happens there and in context assembly — these actions never query a
 * document or chat by id alone.
 *
 * @module lib/actions/chat
 */

"use server";

import { AppError } from "@/lib/errors";
import { type Owner } from "@/lib/permissions/ownership";
import { getCurrentOwner } from "@/lib/auth/session";
import {
  createChatSession,
  getChatSessionState,
  sendChatMessage,
  type ChatSessionState,
  type SendMessageResult,
} from "@/lib/chat/session";

/**
 * Resolves the current owner for a chat action, or throws.
 *
 * A signed-in user takes precedence over a temporary session. Because a saved workspace's
 * ChatSession is transferred to the user (Phase 7), this precedence is what lets the same
 * active chat continue seamlessly after the user creates an account or signs in.
 *
 * @returns The current {@link Owner}.
 * @throws {AppError} `NO_ACTIVE_SESSION` (401) when there is no owner.
 */
async function requireOwner(): Promise<Owner> {
  const owner = await getCurrentOwner();
  if (!owner) {
    throw new AppError("No active session found.", 401, "NO_ACTIVE_SESSION");
  }
  return owner;
}

/**
 * Starts a temporary chat grounded in the selected READY documents.
 *
 * @param documentIds - Ids of the READY documents to ground the chat in.
 * @returns The initial {@link ChatSessionState}.
 * @throws {AppError} `NO_ACTIVE_SESSION` (401), or errors propagated from context assembly.
 */
export async function startChat(documentIds: string[]): Promise<ChatSessionState> {
  const owner = await requireOwner();
  return createChatSession(owner, documentIds);
}

/**
 * Loads the current state (documents, messages, limits) of an owned chat session.
 *
 * @param chatSessionId - The session to load.
 * @returns The full {@link ChatSessionState}.
 * @throws {AppError} `NO_ACTIVE_SESSION` (401) or `CHAT_SESSION_NOT_FOUND` (404).
 */
export async function loadChat(chatSessionId: string): Promise<ChatSessionState> {
  const owner = await requireOwner();
  return getChatSessionState(owner, chatSessionId);
}

/**
 * Sends a user question and returns the grounded assistant answer.
 *
 * @param chatSessionId - The session receiving the message.
 * @param message - The user's question text.
 * @returns The assistant message and updated limits.
 * @throws {AppError} `NO_ACTIVE_SESSION` (401), plus errors propagated from {@link sendChatMessage}.
 */
export async function sendMessage(
  chatSessionId: string,
  message: string
): Promise<SendMessageResult> {
  const owner = await requireOwner();
  return sendChatMessage(owner, chatSessionId, message);
}
