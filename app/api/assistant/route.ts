import { AiError } from "../../../lib/server/ai.ts";
import { createAssistantReply } from "../../../lib/server/assistant.ts";
import { AssistantRequestSchema, AssistantResponseSchema } from "../../../lib/server/contract.ts";
import { ECONOMY } from "../../../lib/server/economy.ts";
import { HttpError, jsonResponse, parseBody, withAuth } from "../../../lib/server/http.ts";
import { hashRateLimitKey, rateLimiter } from "../../../lib/server/rate-limit.ts";

// Next.js requires a literal; the type keeps it aligned with the central limit.
export const maxDuration: typeof ECONOMY.ai.assistantRouteMaxDurationSeconds = 60;

export const POST = withAuth(async (request, { user, supabase }) => {
  const input = await parseBody(request, AssistantRequestSchema);
  const limits = ECONOMY.rateLimits;
  if (!rateLimiter.consume(hashRateLimitKey("assistant-user", user.id), limits.assistantPerUser, limits.windowSeconds)) {
    throw new HttpError(429, "rate_limited");
  }
  try {
    const result = await createAssistantReply(supabase, user.id, input.messages);
    return jsonResponse(AssistantResponseSchema, result);
  } catch (error) {
    if (error instanceof AiError) throw new HttpError(503, "ai_unavailable");
    throw error;
  }
});
