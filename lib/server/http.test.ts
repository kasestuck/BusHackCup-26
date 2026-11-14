import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// Server-only modules require the React server export condition. Keep the ordinary
// node --test entry point while exercising the actual helpers in a child process.
if (!process.execArgv.includes("--conditions=react-server")) {
  test("HTTP authentication and bearer isolation pass under the server export condition", () => {
    const result = spawnSync(process.execPath, [
      "--conditions=react-server", "--test", fileURLToPath(import.meta.url),
    ], { encoding: "utf8", timeout: 30_000, windowsHide: true });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  });
} else {
  const { withAuth } = await import("./http.ts");
  const { createBearerClient, MissingSessionError, ServerConfigurationError } = await import("./supabase.ts");
  const user = { id: "00000000-0000-4000-8000-000000000001" } as User;
  const otherUser = { id: "00000000-0000-4000-8000-000000000002" } as User;
  const unauthorized = { error: { code: "unauthorized", message: "Sign in to continue." } };
  const internal = { error: { code: "internal_error", message: "An unexpected error occurred." } };

  function client(getUser: (token?: string) => Promise<unknown>): SupabaseClient {
    return { auth: { getUser } } as unknown as SupabaseClient;
  }
  const missingCookie = async (): Promise<SupabaseClient> => { throw new MissingSessionError(); };

  test("missing and malformed Authorization credentials return 401 without executing the handler", async () => {
    for (const authorization of [undefined, "Basic test", "Bearer", "Bearer a,b", "Bearer a b"]) {
      const handler = withAuth(() => { throw new Error("The handler must not execute."); }, {
        createClient: missingCookie,
        createBearerClient: () => { throw new Error("Malformed headers must not create a bearer client."); },
      });
      const response = await handler(new Request("https://example.test/api/me", {
        headers: authorization ? { Authorization: authorization } : {},
      }));
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), unauthorized);
    }
  });

  test("invalid, expired, foreign and malformed cookie sessions return 401", async () => {
    for (const behavior of [
      async () => ({ data: { user: null }, error: { status: 401, code: "bad_jwt" } }),
      async () => ({ data: { user: null }, error: { status: 403, code: "session_expired" } }),
      async () => ({ data: { user: null }, error: { status: 401, code: "user_not_found" } }),
      async () => { throw new SyntaxError("Private malformed cookie value."); },
    ]) {
      const response = await withAuth(() => Response.json({ unexpected: true }), {
        createClient: async () => client(behavior),
      })(new Request("https://example.test/api/me"));
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), unauthorized);
    }
  });

  test("a valid cookie is primary even when another bearer identity is present", async () => {
    const cookieClient = client(async (token) => {
      assert.equal(token, undefined);
      return { data: { user }, error: null };
    });
    const response = await withAuth((_request, context) => {
      assert.equal(context.supabase, cookieClient);
      return Response.json({ id: context.user.id });
    }, {
      createClient: async () => cookieClient,
      createBearerClient: () => { throw new Error("A valid cookie must take precedence."); },
    })(new Request("https://example.test/api/me", { headers: { Authorization: "Bearer other.jwt.token" } }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: user.id });
    assert.match(response.headers.get("Cache-Control") ?? "", /no-store/);
    assert.match(response.headers.get("Vary") ?? "", /Cookie/);
    assert.match(response.headers.get("Vary") ?? "", /Authorization/);
  });

  test("a valid bearer is verified explicitly and replaces an invalid cookie identity", async () => {
    const token = "verified.jwt.token";
    const bearerClient = client(async (passed) => {
      assert.equal(passed, token);
      return { data: { user: otherUser }, error: null };
    });
    const response = await withAuth((_request, context) => {
      assert.equal(context.supabase, bearerClient);
      return Response.json({ id: context.user.id });
    }, {
      createClient: async () => client(async () => ({ data: { user: null }, error: { status: 401 } })),
      createBearerClient: (passed) => { assert.equal(passed, token); return bearerClient; },
    })(new Request("https://example.test/api/me", { headers: { Authorization: `Bearer ${token}` } }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: otherUser.id });
  });

  test("rejected bearer verification fails closed with 401", async () => {
    for (const behavior of [
      async () => ({ data: { user: null }, error: { status: 401, code: "bad_jwt" } }),
      async () => { throw new Error("Private verification failure."); },
    ]) {
      const response = await withAuth(() => Response.json({ unexpected: true }), {
        createClient: missingCookie,
        createBearerClient: () => client(behavior),
      })(new Request("https://example.test/api/me", { headers: { Authorization: "Bearer expired.jwt.token" } }));
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), unauthorized);
    }
  });

  test("configuration failures log precise variable names only and return the fixed 500", async () => {
    const calls: unknown[][] = [];
    const previous = console.error;
    console.error = (...args: unknown[]) => { calls.push(args); };
    try {
      const response = await withAuth(() => Response.json({ unexpected: true }), {
        createClient: missingCookie,
        createBearerClient: () => { throw new ServerConfigurationError(["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]); },
      })(new Request("https://example.test/api/me", { headers: { Authorization: "Bearer private.jwt.token" } }));
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), internal);
      assert.match(JSON.stringify(calls), /SERVER CONFIGURATION ERROR/);
      assert.match(JSON.stringify(calls), /SUPABASE_ANON_KEY/);
      assert.doesNotMatch(JSON.stringify(calls), /private\.jwt\.token/);
    } finally {
      console.error = previous;
    }
  });

  test("handler failures remain internal errors instead of masquerading as invalid sessions", async () => {
    const previous = console.error;
    console.error = () => {};
    try {
      const response = await withAuth(() => { throw new Error("Private database detail."); }, {
        createClient: async () => client(async () => ({ data: { user }, error: null })),
      })(new Request("https://example.test/api/me"));
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), internal);
    } finally {
      console.error = previous;
    }
  });

  test("the real bearer client sends the verified token to both Auth and REST, without service credentials", async () => {
    const previousFetch = globalThis.fetch;
    const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY, service: process.env.SUPABASE_SERVICE_ROLE_KEY };
    process.env.SUPABASE_URL = "https://supabase.example.test";
    process.env.SUPABASE_ANON_KEY = "public-test-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "private-test-service-key";
    const requests: { url: string; token: string | null; key: string | null }[] = [];
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      requests.push({ url: request.url, token: request.headers.get("Authorization"), key: request.headers.get("apikey") });
      assert.equal(request.cache, "no-store");
      return Response.json(request.url.includes("/auth/") ? user : []);
    };
    try {
      const token = "same.jwt.token";
      const supabase = createBearerClient(token);
      const result = await supabase.auth.getUser(token);
      assert.equal(result.error, null);
      assert.equal(result.data.user?.id, user.id);
      const rows = await supabase.from("profiles").select("id");
      assert.equal(rows.error, null);
      assert.equal(requests.length, 2);
      for (const request of requests) {
        assert.equal(request.token, `Bearer ${token}`);
        assert.equal(request.key, "public-test-key");
      }
      assert.doesNotMatch(JSON.stringify(requests), /private-test-service-key/);
    } finally {
      globalThis.fetch = previousFetch;
      for (const [key, value] of Object.entries({ SUPABASE_URL: saved.url, SUPABASE_ANON_KEY: saved.key, SUPABASE_SERVICE_ROLE_KEY: saved.service })) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });
}
