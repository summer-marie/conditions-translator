// Server Actions for temporary AI chat.
//
// These resolve the current owner (temporary session for MVP; Phase 7 adds users) and delegate to
// the ownership-scoped orchestration in lib/chat/session.ts. All authorization happens there and
// in the context assembly — these actions never query a document or chat by id alone.

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

// Resolves the current owner (a signed-in user takes precedence over a temporary session). Because
// a saved workspace's ChatSession is transferred to the user (Phase 7), this is what lets the same
// active chat continue seamlessly after the user creates an account or signs in.
async function requireOwner(): Promise<Owner> {
  const owner = await getCurrentOwner();
  if (!owner) {
    throw new AppError("No active session found.", 401, "NO_ACTIVE_SESSION");
  }
  return owner;
}

/** Starts a temporary chat grounded in the selected READY documents. */
export async function startChat(documentIds: string[]): Promise<ChatSessionState> {
  const owner = await requireOwner();
  return createChatSession(owner, documentIds);
}

/** Loads the current state (documents, messages, limits) of an owned chat session. */
export async function loadChat(chatSessionId: string): Promise<ChatSessionState> {
  const owner = await requireOwner();
  return getChatSessionState(owner, chatSessionId);
}

/** Sends a user question and returns the grounded assistant answer. */
export async function sendMessage(
  chatSessionId: string,
  message: string
): Promise<SendMessageResult> {
  const owner = await requireOwner();
  return sendChatMessage(owner, chatSessionId, message);
}
