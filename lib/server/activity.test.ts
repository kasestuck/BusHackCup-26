import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

// These are handler integration tests with mocked Supabase HTTP responses.
// Native PostgreSQL tests separately prove transaction and concurrency behavior.
if (!process.execArgv.includes("--conditions=react-server")) {
  test("activity handlers pass with mocked Supabase HTTP responses", () => {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [
      "--use-system-ca", "--conditions=react-server", "--test", "--test-reporter=tap", fileURLToPath(import.meta.url),
    ], { env, encoding: "utf8", timeout: 30_000, windowsHide: true });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /# tests 10\b/);
    assert.match(result.stdout, /# pass 10\b/);
    assert.match(result.stdout, /# fail 0\b/);
    assert.doesNotMatch(result.stderr, /recursively|skipping running files/);
  });
} else {
  const { GET: getQr } = await import("../../app/api/gyms/[id]/qr-token/route.ts");
  const { POST: checkin } = await import("../../app/api/checkin/route.ts");
  const { POST: sessions } = await import("../../app/api/sessions/route.ts");
  const { createGymQrToken } = await import("./qr.ts");
  const now = Date.parse("2026-11-14T19:59:20.000Z");
  const userId = "01000000-0000-4000-8000-000000000001";
  const gymId = "02000000-0000-4000-8000-000000000001";
  const planId = "03000000-0000-4000-8000-000000000001";
  const accessToken = "fake.test.jwt";
  const qrSecret = "fictional-gym-secret-for-handler-tests";
  const gymKey = "fictional-gym-admin-key-for-handler-tests";
  const profile = {
    id: userId, display_name: "Handler test", height_cm: 175, weight_kg: 70,
    goal: "general_fitness", workout_types: ["gym_strength"], session_minutes: 45,
    weekdays: [6], injuries: [], home_gym_id: gymId, is_pro: false,
    equipment: ["full_gym"], age: 30, timezone: "America/New_York",
  };
  const sessionBody = {
    plan_id: planId, day_index: 0,
    exercises: [{ slug: "bodyweight-squat", sets: [{ reps: 10, weight_kg: 0 }] }],
  };
  type CapturedRequest = { request: Request; url: URL; body: unknown };
  type Scenario = { missingGym?: boolean; foreignPlan?: boolean; duplicateCheckin?: boolean };

  async function withMockSupabase(
    context: TestContext, scenario: Scenario, run: (requests: CapturedRequest[]) => Promise<void>,
  ): Promise<void> {
    const environment = {
      SUPABASE_URL: "https://supabase.handler-test.invalid",
      SUPABASE_ANON_KEY: "fake-handler-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "fake-handler-service-key",
      GYM_ADMIN_KEY: gymKey,
    };
    const saved = Object.fromEntries(Object.keys(environment).map((key) => [key, process.env[key]]));
    for (const [key, value] of Object.entries(environment)) process.env[key] = value;
    const previousFetch = globalThis.fetch;
    const requests: CapturedRequest[] = [];
    context.mock.timers.enable({ apis: ["Date"], now });
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      const body = request.method === "GET" ? undefined : await request.clone().json();
      requests.push({ request, url, body });
      assert.equal(url.origin, environment.SUPABASE_URL, "The mock must intercept every outbound request.");
      assert.equal(request.cache, "no-store");
      if (url.pathname === "/auth/v1/user") {
        assert.equal(request.headers.get("apikey"), environment.SUPABASE_ANON_KEY);
        assert.equal(request.headers.get("Authorization"), `Bearer ${accessToken}`);
        return Response.json({ id: userId });
      }
      if (url.pathname === "/rest/v1/gyms") {
        assert.equal(url.searchParams.get("select"), "qr_secret");
        assert.equal(url.searchParams.get("id"), `eq.${gymId}`);
        assert.equal(request.headers.get("apikey"), environment.SUPABASE_SERVICE_ROLE_KEY);
        return Response.json(scenario.missingGym ? [] : [{ qr_secret: qrSecret }]);
      }
      if (url.pathname === "/rest/v1/profiles") {
        assert.equal(request.headers.get("Authorization"), `Bearer ${accessToken}`);
        assert.equal(url.searchParams.get("id"), `eq.${userId}`);
        return Response.json([profile]);
      }
      if (url.pathname === "/rest/v1/gym_checkins") {
        assert.equal(request.headers.get("Authorization"), `Bearer ${accessToken}`);
        assert.equal(url.searchParams.get("user_id"), `eq.${userId}`);
        return Response.json(url.searchParams.get("offset") === "0" ? [{ checked_in_at: new Date(now).toISOString() }] : []);
      }
      if (url.pathname === "/rest/v1/workout_plans") {
        assert.equal(request.headers.get("Authorization"), `Bearer ${accessToken}`);
        assert.equal(url.searchParams.get("id"), `eq.${planId}`);
        assert.equal(url.searchParams.get("user_id"), `eq.${userId}`);
        return Response.json(scenario.foreignPlan ? [] : [{ plan_json: {
          days: [{ weekday: 6, exercises: [{ slug: "bodyweight-squat" }] }],
        } }]);
      }
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        assert.equal(request.headers.get("apikey"), environment.SUPABASE_SERVICE_ROLE_KEY);
        if (url.pathname.endsWith("/record_gym_checkin")) {
          if (scenario.duplicateCheckin) return Response.json({
            code: "P0001", message: "already_checked_in", details: null, hint: null,
          }, { status: 400 });
          return Response.json({ coins_earned: 40, balance: 140, private_field: qrSecret });
        }
        if (url.pathname.endsWith("/record_workout_session")) {
          return Response.json({ xp_earned: 5, coins_earned: 10, balance: 110 });
        }
      }
      throw new Error(`Unexpected mocked request: ${request.method} ${url.pathname}`);
    };
    try {
      await run(requests);
    } finally {
      globalThis.fetch = previousFetch;
      context.mock.timers.reset();
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  }

  function qrRequest(key?: string): Request {
    return new Request(`https://app.test/api/gyms/${gymId}/qr-token`, {
      headers: key === undefined ? {} : { "x-gym-key": key },
    });
  }
  function postRequest(path: string, body: unknown): Request {
    return new Request(`https://app.test/api/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });
  }
  function rpcRequests(requests: CapturedRequest[]): CapturedRequest[] {
    return requests.filter(({ url }) => url.pathname.startsWith("/rest/v1/rpc/"));
  }

  test("public QR rejects missing and wrong keys with 401 before any Supabase request", async (context) => {
    await withMockSupabase(context, {}, async (requests) => {
      for (const key of [undefined, "short-wrong-key", `${gymKey}-wrong`]) {
        const response = await getQr(qrRequest(key), { params: Promise.resolve({ id: gymId }) });
        assert.equal(response.status, 401);
        assert.equal((await response.json()).error.code, "invalid_gym_key");
      }
      assert.equal(requests.length, 0);
    });
  });

  test("public QR returns 404 for an unknown gym after verifying the key", async (context) => {
    await withMockSupabase(context, { missingGym: true }, async (requests) => {
      const response = await getQr(qrRequest(gymKey), { params: Promise.resolve({ id: gymId }) });
      assert.equal(response.status, 404);
      assert.equal((await response.json()).error.code, "gym_not_found");
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url.pathname, "/rest/v1/gyms");
    });
  });

  test("public QR rejects a malformed UUID with 422 before accessing Supabase", async (context) => {
    await withMockSupabase(context, {}, async (requests) => {
      const response = await getQr(qrRequest(gymKey), { params: Promise.resolve({ id: "abc" }) });
      assert.equal(response.status, 422);
      assert.equal((await response.json()).error.code, "validation_error");
      assert.equal(requests.length, 0);
    });
  });

  test("malformed JSON and extra POST fields return 422 before activity RPCs", async (context) => {
    await withMockSupabase(context, {}, async (requests) => {
      for (const [path, handler, body] of [
        ["checkin", checkin, { gym_id: gymId, token: "invalid-token", extra: true }],
        ["sessions", sessions, { ...sessionBody, extra: true }],
      ] as const) {
        const malformed = new Request(`https://app.test/api/${path}`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: "{invalid",
        });
        for (const request of [malformed, postRequest(path, body)]) {
          const response = await handler(request);
          assert.equal(response.status, 422);
          assert.equal((await response.json()).error.code, "validation_error");
        }
      }
      assert.equal(rpcRequests(requests).length, 0);
    });
  });

  test("public QR returns the HMAC and remaining seconds without exposing the gym secret", async (context) => {
    await withMockSupabase(context, {}, async (requests) => {
      const response = await getQr(qrRequest(gymKey), { params: Promise.resolve({ id: gymId }) });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(body, createGymQrToken(qrSecret, new Date(now)));
      assert.equal(body.expires_in, 40);
      assert.doesNotMatch(JSON.stringify(body), /fictional-gym-secret|qr_secret/);
      assert.equal(requests.some(({ url }) => url.pathname.includes("/auth/")), false);
    });
  });

  test("check-in rejects a three-minute-old token with 422 before the transaction RPC", async (context) => {
    await withMockSupabase(context, {}, async (requests) => {
      const token = createGymQrToken(qrSecret, new Date(now - 180_000)).token;
      const response = await checkin(postRequest("checkin", { gym_id: gymId, token }));
      assert.equal(response.status, 422);
      assert.equal((await response.json()).error.code, "invalid_qr_token");
      assert.equal(rpcRequests(requests).length, 0);
    });
  });

  test("check-in accepts the previous window and returns the safe DTO with a calculated streak", async (context) => {
    await withMockSupabase(context, {}, async (requests) => {
      const token = createGymQrToken(qrSecret, new Date(now - 60_000)).token;
      const response = await checkin(postRequest("checkin", { gym_id: gymId, token }));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { coins_earned: 40, streak: 1, balance: 140 });
      const calls = rpcRequests(requests);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url.pathname, "/rest/v1/rpc/record_gym_checkin");
      assert.deepEqual(calls[0].body, {
        p_user_id: userId, p_gym_id: gymId, p_checked_in_at: new Date(now).toISOString(),
      });
    });
  });

  test("check-in maps the transactional duplicate error to HTTP 409 already_checked_in", async (context) => {
    await withMockSupabase(context, { duplicateCheckin: true }, async (requests) => {
      const token = createGymQrToken(qrSecret, new Date(now)).token;
      const response = await checkin(postRequest("checkin", { gym_id: gymId, token }));
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), { error: {
        code: "already_checked_in", message: "You have already checked in today.",
      } });
      assert.equal(rpcRequests(requests).length, 1);
    });
  });

  test("sessions reject a plan hidden by ownership filtering without calling the transaction RPC", async (context) => {
    await withMockSupabase(context, { foreignPlan: true }, async (requests) => {
      const response = await sessions(postRequest("sessions", sessionBody));
      assert.equal(response.status, 422);
      assert.equal((await response.json()).error.code, "validation_error");
      assert.equal(rpcRequests(requests).length, 0);
    });
  });

  test("sessions pass verified user identity and validated log to one service-role RPC", async (context) => {
    await withMockSupabase(context, {}, async (requests) => {
      const response = await sessions(postRequest("sessions", sessionBody));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { xp_earned: 5, coins_earned: 10, balance: 110 });
      const calls = rpcRequests(requests);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url.pathname, "/rest/v1/rpc/record_workout_session");
      assert.deepEqual(calls[0].body, {
        p_user_id: userId, p_plan_id: planId, p_day_index: 0, p_exercises: sessionBody.exercises,
      });
    });
  });
}
