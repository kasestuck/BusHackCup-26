/**
 * PROPOSAL — AI Coach chat endpoint. NOT part of lib/contract yet.
 *
 * SPEC §6 lists 13 endpoints and §3 puts "chat with a coach" out of scope; the product owner
 * asked for an AI Coach chat, so this file proposes a 14th endpoint. Per SPEC §4 the shared
 * contract changes only by agreement of both developers: once the backend approves, move these
 * schemas into lib/contract/index.ts (and API_ROUTES) unchanged and delete this file.
 *
 * Until then the frontend uses it with mocks only (NEXT_PUBLIC_USE_MOCKS=true).
 */
import { z } from "zod";

export const ASSISTANT_ROUTE = "/api/assistant";

/** Max characters per message the UI sends. */
export const CHAT_MESSAGE_MAX = 1000;
/** Most recent messages sent as context (the server adds profile, plan, coins and streak). */
export const CHAT_HISTORY_MAX = 20;

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/**
 * POST /api/assistant
 * Request: recent conversation, oldest first; the last item is the user's new message.
 * Response: one assistant reply. Errors: 401 no session, 422 invalid, 429 rate limited.
 * Server notes: call the model via lib/server/ai.ts with the user's profile, active plan,
 * coins and streak as context; never give medical advice; suggest a doctor for pain or injury.
 */
export const AssistantRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(30),
});
export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;

export const AssistantResponseSchema = z.object({
  reply: z.object({
    role: z.literal("assistant"),
    content: z.string(),
  }),
});
export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;
