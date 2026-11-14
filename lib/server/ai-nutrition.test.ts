import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { performance } from "node:perf_hooks";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

if (!process.execArgv.includes("--conditions=react-server")) {
  test("AI and nutrition pass against local fake HTTP services", () => {
    const environment = { ...process.env };
    // An inherited test context makes Node skip a recursively invoked runner.
    delete environment.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [
      "--conditions=react-server", "--test", "--test-reporter=tap", fileURLToPath(import.meta.url),
    ], { env: environment, encoding: "utf8", timeout: 40_000, windowsHide: true });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /# tests 9\r?\n/);
    assert.match(result.stdout, /# pass 9\r?\n/);
    assert.match(result.stdout, /# fail 0\r?\n/);
    assert.doesNotMatch(result.stderr, /recursively|skipping running files/);
  });
} else {
  const { z } = await import("zod");
  const { AiError, generateJson, createJsonGenerator } = await import("./ai.ts");
  const { POST: analyze } = await import("../../app/api/nutrition/analyze/route.ts");
  const { ECONOMY } = await import("./economy.ts");
  const apiKey = "private-fake-ai-key-for-local-tests";
  const token = "fake.test.user-token";
  let userCounter = 0;
  const validResult = {
    items: [{ name: "Test meal", grams_estimate: 100, kcal: 140, protein_g: 8, carbs_g: 18, fat_g: 4 }],
    totals: { kcal: 140, protein_g: 8, carbs_g: 18, fat_g: 4 },
    confidence: "low", disclaimer: "This is an approximate image-based estimate.",
  };
  type RequestRecord = { headers: IncomingMessage["headers"]; body: Record<string, unknown> };
  type FakeOptions = {
    pro?: boolean;
    ai?: (response: ServerResponse, request: RequestRecord) => void;
  };

  async function fakeServices(options: FakeOptions, run: (state: {
    aiRequests: RequestRecord[]; foodWrites: Record<string, unknown>[]; userId: string;
  }) => Promise<void>): Promise<void> {
    const userId = `10000000-0000-4000-8000-${String(++userCounter).padStart(12, "0")}`;
    const aiRequests: RequestRecord[] = [];
    const foodWrites: Record<string, unknown>[] = [];
    const server = createServer((request, response) => {
      void (async () => {
        const buffers: Buffer[] = [];
        for await (const chunk of request) buffers.push(Buffer.from(chunk));
        const text = Buffer.concat(buffers).toString("utf8");
        const body = text ? JSON.parse(text) as Record<string, unknown> : {};
        const url = new URL(request.url ?? "/", "http://localhost");
        response.setHeader("Content-Type", "application/json");
        if (url.pathname === "/v1/chat/completions") {
          const record = { headers: request.headers, body };
          aiRequests.push(record);
          if (options.ai) options.ai(response, record);
          else response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validResult) } }] }));
        } else if (url.pathname === "/auth/v1/user") {
          assert.equal(request.headers.authorization, `Bearer ${token}`);
          response.end(JSON.stringify({ id: userId }));
        } else if (url.pathname === "/rest/v1/subscriptions") {
          assert.equal(url.searchParams.get("user_id"), `eq.${userId}`);
          response.end(JSON.stringify(options.pro === false ? [] : [{ current_period_end: "2099-01-01T00:00:00Z" }]));
        } else if (url.pathname === "/rest/v1/food_logs" && request.method === "POST") {
          assert.equal(request.headers.apikey, "fake-service-role-key");
          foodWrites.push(body);
          response.end("[]");
        } else {
          response.statusCode = 404;
          response.end(JSON.stringify({ error: "Unexpected test request." }));
        }
      })().catch((error: unknown) => {
        response.statusCode = 500;
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Fake server failure." }));
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const origin = `http://127.0.0.1:${address.port}`;
    const environment: Record<string, string> = {
      AI_API_KEY: apiKey, AI_BASE_URL: `${origin}/v1/`, AI_MODEL: "fake-model",
      SUPABASE_URL: origin, SUPABASE_ANON_KEY: "fake-anon-key", SUPABASE_SERVICE_ROLE_KEY: "fake-service-role-key",
    };
    const saved = Object.fromEntries(Object.keys(environment).map((name) => [name, process.env[name]]));
    Object.assign(process.env, environment);
    try { await run({ aiRequests, foodWrites, userId }); }
    finally {
      for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[name]; else process.env[name] = value;
      }
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }

  function upload(bytes: Uint8Array = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), type = "image/png"): Request {
    const form = new FormData();
    const copy = new Uint8Array(bytes);
    form.set("image", new File([copy], "input-image", { type }));
    return new Request("http://app.test/api/nutrition/analyze", {
      method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
    });
  }

  test("generateJson uses strict structured output, low reasoning and validated data", async () => {
    await fakeServices({ ai(response) {
      response.end(JSON.stringify({ choices: [{ message: { content: '{"count":3}' } }] }));
    } }, async ({ aiRequests }) => {
      const result = await generateJson(z.object({ count: z.number().int() }).strict(), [{ role: "user", content: '{"task":"count"}' }]);
      assert.deepEqual(result, { count: 3 });
      assert.equal(aiRequests.length, 1);
      assert.equal(aiRequests[0].headers.authorization, `Bearer ${apiKey}`);
      assert.equal(aiRequests[0].body.reasoning_effort, "low");
      assert.equal(aiRequests[0].body.model, "fake-model");
      const format = aiRequests[0].body.response_format as { type: string; json_schema: { strict: boolean; schema: { additionalProperties: boolean } } };
      assert.equal(format.type, "json_schema");
      assert.equal(format.json_schema.strict, true);
      assert.equal(format.json_schema.schema.additionalProperties, false);
      assert.doesNotMatch(JSON.stringify(result), new RegExp(apiKey));
      assert.equal(JSON.stringify(aiRequests[0].body).includes(apiKey), false);
    });
  });

  test("invalid JSON, invalid schemas and reflected API credentials are rejected without raw details", async () => {
    for (const content of ["not-json", '{"count":"wrong"}', JSON.stringify({ count: apiKey })]) {
      await fakeServices({ ai(response) {
        response.end(JSON.stringify({ choices: [{ message: { content } }] }));
      } }, async () => {
        const schema = content.includes(apiKey) ? z.object({ count: z.string() }).strict() : z.object({ count: z.number() }).strict();
        await assert.rejects(generateJson<unknown>(schema, []), (error: unknown) => {
          assert.ok(error instanceof AiError);
          assert.equal(error.kind, "invalid_response");
          assert.equal(error.message.includes(apiKey), false);
          return true;
        });
      });
    }
  });

  test("request deadlines cover both missing headers and stalled response bodies", async () => {
    for (const flushHeaders of [false, true]) {
      await fakeServices({ ai(response) {
        if (flushHeaders) { response.writeHead(200); response.write('{"choices":['); }
      } }, async ({ aiRequests }) => {
        const start = performance.now();
        const generate = createJsonGenerator({ timeoutMs: 80 });
        await assert.rejects(generate(z.object({ count: z.number() }), []), (error: unknown) => error instanceof AiError && error.kind === "timeout");
        assert.ok(performance.now() - start < 1500, "The request must finish without waiting for the stalled provider.");
        assert.equal(aiRequests.length, 1);
      });
    }
  });

  test("missing AI configuration does not fall back to a public key", async () => {
    await fakeServices({}, async ({ aiRequests }) => {
      const previous = process.env.NEXT_PUBLIC_AI_API_KEY;
      process.env.NEXT_PUBLIC_AI_API_KEY = apiKey;
      delete process.env.AI_API_KEY;
      try {
        await assert.rejects(generateJson(z.object({ count: z.number() }), []), (error: unknown) => error instanceof AiError && error.kind === "configuration");
        assert.equal(aiRequests.length, 0);
      } finally {
        if (previous === undefined) delete process.env.NEXT_PUBLIC_AI_API_KEY; else process.env.NEXT_PUBLIC_AI_API_KEY = previous;
      }
    });
  });

  test("nutrition rejects non-Pro before uploading or sending any request to the fake AI server", async () => {
    await fakeServices({ pro: false }, async ({ aiRequests, foodWrites }) => {
      const response = await analyze(upload());
      assert.equal(response.status, 402);
      assert.equal((await response.json()).error.code, "pro_required");
      assert.equal(aiRequests.length, 0);
      assert.equal(foodWrites.length, 0);
    });
  });

  test("nutrition rejects non-images despite a permitted declared MIME type", async () => {
    await fakeServices({}, async ({ aiRequests, foodWrites }) => {
      const response = await analyze(upload(new TextEncoder().encode("This is not an image."), "image/jpeg"));
      assert.equal(response.status, 422);
      assert.equal(aiRequests.length, 0);
      assert.equal(foodWrites.length, 0);
    });
  });

  test("nutrition rejects files larger than five MiB before the AI call", async () => {
    await fakeServices({}, async ({ aiRequests, foodWrites }) => {
      const bytes = new Uint8Array(ECONOMY.ai.imageMaxBytes + 1);
      bytes.set([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
      const response = await analyze(upload(bytes));
      assert.equal(response.status, 422);
      assert.equal(aiRequests.length, 0);
      assert.equal(foodWrites.length, 0);
    });
  });

  test("nutrition broken model output returns 503 without made-up numbers or saved logs", async () => {
    await fakeServices({ ai(response) {
      response.end(JSON.stringify({ choices: [{ message: { content: apiKey } }] }));
    } }, async ({ aiRequests, foodWrites }) => {
      const response = await analyze(upload());
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.error.code, "ai_unavailable");
      assert.equal(JSON.stringify(body).includes(apiKey), false);
      assert.equal(aiRequests.length, 1);
      assert.equal(foodWrites.length, 0);
    });
  });

  test("nutrition sniffs MIME, sends a data URL, repairs totals and stores only results", async () => {
    await fakeServices({ ai(response) {
      response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ...validResult, totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } }) } }] }));
    } }, async ({ aiRequests, foodWrites, userId }) => {
      const response = await analyze(upload(undefined, "text/plain"));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), validResult);
      assert.equal(aiRequests.length, 1);
      assert.equal(aiRequests[0].body.reasoning_effort, "low");
      const messages = aiRequests[0].body.messages as { content: unknown }[];
      const parts = messages.at(-1)?.content as { type: string; image_url: { url: string } }[];
      assert.equal(parts[0].type, "image_url");
      assert.match(parts[0].image_url.url, /^data:image\/png;base64,/);
      assert.equal(foodWrites.length, 1);
      assert.deepEqual(foodWrites[0], { user_id: userId, result_json: validResult });
      assert.equal(JSON.stringify(foodWrites).includes("base64"), false);
      assert.equal(JSON.stringify(foodWrites).includes(apiKey), false);
    });
  });
}
