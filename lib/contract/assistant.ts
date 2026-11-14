import { z } from "zod";

/** Match the frontend's existing AI Coach proposal without changing its wire format. */
export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

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

const assistantError = <S extends number, C extends string>(status: S, code: C) => z.object({
  status: z.literal(status),
  body: z.object({ error: z.object({ code: z.literal(code), message: z.string().min(1) }) }),
});
export const AssistantErrorResponseSchema = z.discriminatedUnion("status", [
  assistantError(401, "unauthorized"),
  assistantError(422, "validation_error"),
  assistantError(429, "rate_limited"),
  assistantError(500, "internal_error"),
  assistantError(503, "ai_unavailable"),
]);
export type AssistantErrorResponse = z.infer<typeof AssistantErrorResponseSchema>;
