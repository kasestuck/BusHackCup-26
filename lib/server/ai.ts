import "server-only";

import { toJSONSchema, type ZodType } from "zod";
import { ECONOMY } from "./economy.ts";

export type AiMessage = { role: "system" | "user" | "assistant"; content: string };
export type AiErrorKind = "invalid_response" | "timeout" | "unavailable" | "configuration";
type AiConfiguration = { key: string; baseUrl: string; model: string };

const ERROR_MESSAGES: Record<AiErrorKind, string> = {
  invalid_response: "The AI response failed JSON or schema validation.",
  timeout: "The AI request timed out.",
  unavailable: "The AI service is unavailable.",
  configuration: "The AI service is not configured correctly.",
};

export class AiError extends Error {
  readonly kind: AiErrorKind;

  constructor(kind: AiErrorKind) {
    super(ERROR_MESSAGES[kind]);
    this.name = "AiError";
    this.kind = kind;
  }
}

/**
 * Provider assumption: POST /chat/completions with Bearer authentication, strict
 * JSON Schema, string message.content, image_url data URLs and reasoning_effort low.
 * Keep provider-specific request/response shapes together for later verification.
 */
function openAiCompatibleFormat<T>(schema: ZodType<T>, configuration: AiConfiguration, messages: readonly AiMessage[], images: readonly string[]) {
  const url = new URL(configuration.baseUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/chat/completions`;
  const content = messages.map((message) => ({ ...message })) as Array<{
    role: AiMessage["role"];
    content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
  }>;
  if (images.length) {
    if (images.some((image) => !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(image))) {
      throw new AiError("configuration");
    }
    content.push({ role: "user", content: images.map((url) => ({ type: "image_url", image_url: { url } })) });
  }
  const jsonSchema = toJSONSchema(schema, { target: "draft-7" });
  delete jsonSchema.$schema;
  return {
    url: url.href,
    method: "POST" as const,
    headers: { Authorization: `Bearer ${configuration.key}`, "Content-Type": "application/json" },
    body: {
      model: configuration.model,
      messages: content,
      reasoning_effort: "low" as const,
      response_format: { type: "json_schema", json_schema: { name: "response", strict: true, schema: jsonSchema } },
    },
    decode(envelope: unknown): unknown {
      const message = (envelope as { choices?: { message?: { content?: unknown; refusal?: unknown } }[] } | null)?.choices?.[0]?.message;
      if (!message || message.refusal || typeof message.content !== "string") throw new AiError("invalid_response");
      try { return JSON.parse(message.content); } catch { throw new AiError("invalid_response"); }
    },
  };
}

function configuration(): AiConfiguration {
  const key = process.env.AI_API_KEY?.trim();
  const base = process.env.AI_BASE_URL?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (!key || !base || !model) throw new AiError("configuration");
  try {
    const url = new URL(base);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new AiError("configuration");
    }
    return { key, baseUrl: url.href, model };
  } catch { throw new AiError("configuration"); }
}

/** Validate readiness without exposing configuration values to callers or logs. */
export function assertAiConfigured(): void {
  configuration();
}

async function readEnvelope(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new AiError("invalid_response");
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 1024 * 1024) throw new AiError("invalid_response");
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    try { return JSON.parse(text); } catch { throw new AiError("invalid_response"); }
  } finally {
    void reader.cancel().catch(() => {});
  }
}

function containsSecret(value: unknown, secret: string): boolean {
  if (typeof value === "string") return value.includes(secret);
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, entry]) => key.includes(secret) || containsSecret(entry, secret));
  }
  return false;
}

export type JsonGenerator = <T>(schema: ZodType<T>, messages: readonly AiMessage[], images?: readonly string[]) => Promise<T>;

/** Injection is for local tests; production configuration is limited to the three AI environment variables. */
export function createJsonGenerator(options: { timeoutMs?: number; fetch?: typeof fetch; signal?: AbortSignal } = {}): JsonGenerator {
  return async <T>(schema: ZodType<T>, messages: readonly AiMessage[], images: readonly string[] = []): Promise<T> => {
    const config = configuration();
    let adapter: ReturnType<typeof openAiCompatibleFormat<T>>;
    try { adapter = openAiCompatibleFormat(schema, config, messages, images); }
    catch (error) { throw error instanceof AiError ? error : new AiError("configuration"); }
    const timeoutMs = options.timeoutMs ?? ECONOMY.ai.timeoutMs;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new AiError("configuration");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abortFromParent: (() => void) | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      abortFromParent = () => {
        controller.abort();
        reject(new AiError("timeout"));
      };
      options.signal?.addEventListener("abort", abortFromParent, { once: true });
      if (options.signal?.aborted) abortFromParent();
      timer = setTimeout(() => {
        controller.abort();
        reject(new AiError("timeout"));
      }, timeoutMs);
    });
    try {
      return await Promise.race([deadline, (async () => {
        const response = await (options.fetch ?? fetch)(adapter.url, {
          method: adapter.method,
          headers: adapter.headers,
          body: JSON.stringify(adapter.body),
          signal: controller.signal,
          redirect: "error",
          cache: "no-store",
        });
        if (!response.ok) {
          void response.body?.cancel().catch(() => {});
          throw new AiError("unavailable");
        }
        const raw = adapter.decode(await readEnvelope(response));
        const result = schema.safeParse(raw);
        if (!result.success || containsSecret(result.data, config.key)) throw new AiError("invalid_response");
        return result.data;
      })()]);
    } catch (error) {
      if (controller.signal.aborted) throw new AiError("timeout");
      throw error instanceof AiError ? error : new AiError("unavailable");
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (abortFromParent) options.signal?.removeEventListener("abort", abortFromParent);
    }
  };
}

export const generateJson: JsonGenerator = createJsonGenerator();
