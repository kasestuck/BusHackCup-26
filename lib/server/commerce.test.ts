import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

if (!process.execArgv.includes("--conditions=react-server")) {
  test("commerce handlers pass against a local fake Supabase HTTP server", () => {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [
      "--use-system-ca", "--conditions=react-server", "--test", "--test-reporter=tap", fileURLToPath(import.meta.url),
    ], { env, encoding: "utf8", timeout: 30_000, windowsHide: true });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /# tests 11\b/);
    assert.match(result.stdout, /# pass 11\b/);
    assert.match(result.stdout, /# fail 0\b/);
    assert.doesNotMatch(result.stderr, /recursively|skipping running files/);
  });
} else {
  const { POST: redeem } = await import("../../app/api/rewards/redeem/route.ts");
  const { POST: subscribe } = await import("../../app/api/billing/subscribe/route.ts");
  const { POST: purchase } = await import("../../app/api/partner/simulate-purchase/route.ts");
  const { GET: stats } = await import("../../app/api/partner/stats/route.ts");
  const { generatePromoCode } = await import("./commerce.ts");
  const { calculateCommissionCents, ECONOMY } = await import("./economy.ts");
  const userId = "61000000-0000-4000-8000-000000000001";
  const rewardId = "62000000-0000-4000-8000-000000000001";
  const redemptionId = "63000000-0000-4000-8000-000000000001";
  const partnerId = "64000000-0000-4000-8000-000000000001";
  const saleId = "65000000-0000-4000-8000-000000000001";
  const token = "fictional-commerce-user-token";
  const anon = "fictional-commerce-anon-key";
  const service = "fictional-commerce-service-key";
  const proUntil = "2027-01-01T12:00:00.000Z";
  type RpcError = { code: string; message: string; details?: string | null };
  type Scenario = { balance?: number; error?: RpcError; stats?: {sales_count:number;revenue_cents:number;commission_cents:number}; invalidOutput?: boolean; proReward?: boolean };
  type State = { rpcCalls: {name:string;body:Record<string,unknown>}[]; balance:number; sales:number; authCalls:number };

  async function withServer(scenario: Scenario, run: (state: State) => Promise<void>) {
    const state: State = { rpcCalls: [], balance: scenario.balance ?? 500, sales: 0, authCalls: 0 };
    const server = createServer(async (request, response) => {
      const reply = (value: unknown, status = 200) => {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(value));
      };
      try {
        const path = new URL(request.url!, "http://localhost").pathname;
        if (path === "/auth/v1/user") {
          assert.ok(request.headers.apikey === anon, "Auth must use the anonymous API key.");
          assert.ok(request.headers.authorization === `Bearer ${token}`, "Auth must verify the supplied user token.");
          state.authCalls += 1;
          reply({id:userId});
          return;
        }
        assert.ok(request.headers.apikey === service, "Commerce RPCs must use the server client.");
        let raw = "";
        for await (const chunk of request) raw += chunk;
        const body = JSON.parse(raw) as Record<string,unknown>;
        const name = path.replace("/rest/v1/rpc/", "");
        state.rpcCalls.push({name,body});
        if (name !== "partner_stats") assert.equal(body.p_user_id, userId);
        if (scenario.error) { reply(scenario.error, 400); return; }
        if (scenario.invalidOutput) { reply({ private_provider_detail: "Suppressed database detail." }); return; }
        if (name === "redeem_reward") {
          assert.equal(body.p_reward_id, rewardId);
          assert.ok(Array.isArray(body.p_promo_codes));
          assert.equal(body.p_promo_codes.length, ECONOMY.promoCollisionAttempts);
          assert.ok(body.p_promo_codes.every(value => typeof value === "string" && /^SHOWUP-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(value)));
          if (state.balance < 500) {
            reply({code:"P0001",message:"not_enough_coins",details:String(500-state.balance)},400);
          } else {
            state.balance -= 500;
            reply(scenario.proReward ? {balance:state.balance,pro_until:proUntil} : {balance:state.balance,promo_code:body.p_promo_codes[0]});
          }
        } else if (name === "mock_subscribe") {
          reply({is_pro:true,pro_until:proUntil});
        } else if (name === "simulate_partner_purchase") {
          assert.equal(body.p_redemption_id,redemptionId);
          assert.equal(body.p_amount_cents,4000);
          if (state.sales++) reply({code:"P0001",message:"already_purchased"},400);
          else reply({sale_id:saleId,amount_cents:4000,commission_cents:600});
        } else if (name === "partner_stats") {
          assert.equal(body.p_partner_id,partnerId);
          reply(scenario.stats ?? {sales_count:0,revenue_cents:0,commission_cents:0});
        } else throw new Error("Unexpected fake RPC.");
      } catch {
        reply({code:"FAKE_FAILURE",message:"The local test request failed validation."},500);
      }
    });
    await new Promise<void>(resolve => server.listen(0,"127.0.0.1",resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const values = {SUPABASE_URL:`http://127.0.0.1:${address.port}`,SUPABASE_ANON_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:service};
    const previous = Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));
    for (const [key,value] of Object.entries(values)) process.env[key]=value;
    try { await run(state); }
    finally {
      for (const [key,value] of Object.entries(previous)) {
        if (value===undefined) delete process.env[key]; else process.env[key]=value;
      }
      server.closeAllConnections();
      await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    }
  }
  function post(path:string,body:unknown):Request {
    return new Request(`http://app.test/api/${path}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
  }
  function statsRequest(query = `partner_id=${partnerId}`):Request {
    return new Request(`http://app.test/api/partner/stats?${query}`,{headers:{Authorization:`Bearer ${token}`}});
  }

  test("one thousand cryptographic promo codes have valid unambiguous suffixes and no collisions", () => {
    const codes = Array.from({length:1000},generatePromoCode);
    assert.ok(codes.every(code=>/^SHOWUP-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code)));
    assert.equal(new Set(codes).size,1000);
  });
  test("commission uses exact decimal percentages and rounds fractional cents down", () => {
    for (const [amount,pct,expected] of [[1,15,0],[6,15,0],[7,15,1],[99,15,14],[4000,15,600],[100,0.29,0],[10000,0.29,29],[101,12.34,12],[5,100,5]]) {
      assert.equal(calculateCommissionCents(amount,pct),expected);
    }
    for (const [amount,pct] of [[-1,15],[1.2,15],[1,100.01],[1,1.001],[1,Number.NaN]]) assert.throws(()=>calculateCommissionCents(amount,pct),RangeError);
  });
  test("all four commerce handlers require authentication", async () => {
    for (const handler of [redeem,subscribe,purchase,stats]) {
      const response=await handler(new Request("http://app.test/api/commerce"));
      assert.equal(response.status,401);
      assert.equal((await response.json()).error.code,"unauthorized");
    }
  });
  test("two concurrent redeem handlers map one transaction success and one shortage without route ledger writes", async () => {
    await withServer({},async state=>{
      const responses=await Promise.all([redeem(post("rewards/redeem",{reward_id:rewardId})),redeem(post("rewards/redeem",{reward_id:rewardId}))]);
      assert.deepEqual(responses.map(r=>r.status).sort(),[200,402]);
      const success=await responses.find(r=>r.status===200)!.json();
      assert.equal(success.balance,0);
      assert.equal(state.balance,0);
      assert.equal(state.rpcCalls.length,2);
      assert.ok(state.rpcCalls.every(call=>call.name==="redeem_reward"));
    });
  });
  test("a one-coin shortage has the exact dynamic message and unsafe RPC details never escape", async () => {
    await withServer({balance:499},async()=>{
      const response=await redeem(post("rewards/redeem",{reward_id:rewardId}));
      assert.equal(response.status,402);
      assert.deepEqual(await response.json(),{error:{code:"not_enough_coins",message:"You need 1 more coins."}});
    });
    await withServer({error:{code:"P0001",message:"not_enough_coins",details:"Private provider failure."}},async()=>{
      const response=await redeem(post("rewards/redeem",{reward_id:rewardId}));
      assert.equal(response.status,500);
      assert.deepEqual(await response.json(),{error:{code:"internal_error",message:"An unexpected error occurred."}});
    });
  });
  test("redeem maps missing and inactive rewards and returns the Pro expiration supplied by its transaction", async () => {
    for (const [message,status] of [["reward_not_found",404],["reward_inactive",409]] as const) {
      await withServer({error:{code:"P0001",message}},async()=>{
        const response=await redeem(post("rewards/redeem",{reward_id:rewardId}));
        assert.equal(response.status,status);
        assert.equal((await response.json()).error.code,message);
      });
    }
    await withServer({proReward:true},async()=>{
      const response=await redeem(post("rewards/redeem",{reward_id:rewardId}));
      assert.equal(response.status,200);
      assert.deepEqual(await response.json(),{balance:0,pro_until:proUntil});
    });
  });
  test("subscribe forwards the verified identity and preserves the active expiration on repeat", async () => {
    await withServer({},async state=>{
      for (let i=0;i<2;i++) {
        const response=await subscribe(post("billing/subscribe",{plan:"pro_monthly"}));
        assert.equal(response.status,200);
        assert.deepEqual(await response.json(),{is_pro:true,pro_until:proUntil});
      }
      assert.ok(state.rpcCalls.every(call=>call.name==="mock_subscribe"));
    });
  });
  test("simulated purchases use the server basket and reject repeats, foreign redemptions and ineligible rewards", async () => {
    await withServer({},async()=>{
      const first=await purchase(post("partner/simulate-purchase",{redemption_id:redemptionId}));
      assert.equal(first.status,200);
      assert.deepEqual(await first.json(),{sale_id:saleId,amount_cents:4000,commission_cents:600});
      const second=await purchase(post("partner/simulate-purchase",{redemption_id:redemptionId}));
      assert.equal(second.status,409);
      assert.equal((await second.json()).error.code,"already_purchased");
    });
    for (const [message,status] of [["redemption_not_found",404],["validation_error",422]] as const) {
      await withServer({error:{code:"P0001",message}},async()=>{
        const response=await purchase(post("partner/simulate-purchase",{redemption_id:redemptionId}));
        assert.equal(response.status,status);
        assert.equal((await response.json()).error.code,message);
      });
    }
  });
  test("partner stats handle zero and multiple sales, unknown partners and invalid or duplicate query fields", async () => {
    for (const expected of [{sales_count:0,revenue_cents:0,commission_cents:0},{sales_count:3,revenue_cents:12000,commission_cents:1800}]) {
      await withServer({stats:expected},async()=>{
        const response=await stats(statsRequest());
        assert.equal(response.status,200);
        assert.deepEqual(await response.json(),expected);
      });
    }
    await withServer({error:{code:"P0001",message:"partner_not_found"}},async()=>{
      const response=await stats(statsRequest());
      assert.equal(response.status,404);
      assert.equal((await response.json()).error.code,"partner_not_found");
    });
    await withServer({},async state=>{
      for (const query of ["partner_id=abc",`partner_id=${partnerId}&partner_id=${partnerId}`,`partner_id=${partnerId}&extra=true`,""]) assert.equal((await stats(statsRequest(query))).status,422);
      assert.equal(state.rpcCalls.length,0);
    });
  });
  test("malformed JSON and unexpected fields return 422 before all commerce writes", async () => {
    await withServer({},async state=>{
      for (const [handler,path,body] of [[redeem,"rewards/redeem",{reward_id:rewardId}],[subscribe,"billing/subscribe",{plan:"pro_monthly"}],[purchase,"partner/simulate-purchase",{redemption_id:redemptionId}]] as const) {
        const extra=await handler(post(path,{...body,unexpected:true}));
        assert.equal(extra.status,422);
        const malformed=await handler(new Request(`http://app.test/api/${path}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:"{invalid"}));
        assert.equal(malformed.status,422);
      }
      assert.equal(state.rpcCalls.length,0);
    });
  });
  test("invalid server output returns a sanitized internal error", async () => {
    await withServer({invalidOutput:true},async()=>{
      const response=await subscribe(post("billing/subscribe",{plan:"pro_monthly"}));
      assert.equal(response.status,500);
      assert.deepEqual(await response.json(),{error:{code:"internal_error",message:"An unexpected error occurred."}});
    });
  });
}
