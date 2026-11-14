import assert from 'node:assert/strict';

export function verifyContract(c) {
  const id = '11111111-1111-4111-8111-111111111111';
  const timestamp = '2026-11-14T12:00:00Z';
  const questionnaire = {
    height_cm: 180, weight_kg: 80, injuries: [], goal: 'general_fitness',
    workout_types: ['gym_strength'], session_minutes: 45,
    weekdays: [1], equipment: ['full_gym'], age: 30,
  };
  const profile = {
    ...questionnaire, id, display_name: '', home_gym_id: null, is_pro: false, timezone: 'America/New_York',
  };
  const plan = {
    id, title: 'Strength Foundations', summary: 'One training day',
    days: [{ weekday: 1, focus: 'Lower body', duration_min: 45,
      exercises: [{ slug: 'goblet-squat', name: 'Goblet Squat', sets: 3,
        reps: '8-10', rest_sec: 90, note: 'Keep your chest up.',
        video: { youtube_id: 'abcdefghijk', title: 'Verification video' } }],
    }], safety_note: 'This plan is general fitness guidance, not medical advice.',
  };
  const macros = { kcal: 100, protein_g: 10, carbs_g: 10, fat_g: 2 };
  const samples = {
    me: [undefined, { profile, coins_balance: 0, streak: 0, is_pro: false, has_plan: true }],
    onboarding: [questionnaire, { profile }],
    generatePlan: [{}, { plan }],
    activePlan: [undefined, { plan }],
    sessions: [{ plan_id: id, day_index: 0, exercises: [{ slug: 'goblet-squat', sets: [{ reps: 8, weight_kg: 0 }] }] },
      { xp_earned: 1, coins_earned: 10, balance: 10 }],
    gyms: [undefined, { gyms: [{ id, name: 'Gym', city: 'City', address: 'Address' }] }],
    gymQrToken: [{ params: { id }, headers: { 'x-gym-key': 'verification-only' } }, { token: 'token', expires_in: 60 }],
    checkin: [{ gym_id: id, token: 'token' }, { coins_earned: 40, streak: 1, balance: 40 }],
    rewards: [undefined, { rewards: [{ id, kind: 'pro_month', title: 'Pro', partner_id: null, cost_coins: 1200, discount_pct: null, active: true }] }],
    redeem: [{ reward_id: id }, { pro_until: timestamp, balance: 0 }],
    subscribe: [{ plan: 'pro_monthly' }, { is_pro: true, pro_until: timestamp }],
    nutrition: [{ image: new File(['test-only'], 'sample.jpg', { type: 'image/jpeg' }) },
      { items: [{ name: 'Food', grams_estimate: 100, ...macros }], totals: macros, confidence: 'low', disclaimer: 'Approximate estimate.' }],
    partnerStats: [{ query: { partner_id: id } }, { sales_count: 1, revenue_cents: 1000, commission_cents: 150 }],
    simulatePurchase: [{ redemption_id: id }, { sale_id: id, amount_cents: 4000, commission_cents: 600 }],
  };
  assert.equal(Object.keys(c.EndpointContracts).length, 14);
  assert.equal(new Set(Object.values(c.EndpointContracts).map(e => `${e.method} ${e.path}`)).size, 14);
  for (const [name, endpoint] of Object.entries(c.EndpointContracts)) {
    const sample = samples[name];
    assert.ok(sample, `Missing samples for ${name}`);
    endpoint.request.parse(sample[0]);
    endpoint.success.parse(sample[1]);
    endpoint.error.parse({ status: 401, body: { error: { code: 'unauthorized', message: 'Sign in to continue.' } } });
    endpoint.error.parse({ status: 500, body: { error: { code: 'internal_error', message: 'An unexpected error occurred.' } } });
    assert.equal(endpoint.success.safeParse({ ...sample[1], unexpected: true }).success, false);
    console.log(`PASS: ${endpoint.method} ${endpoint.path} request, success and error examples`);
  }
  const errorExamples = [
    [401, 'unauthorized'], [402, 'not_enough_coins'], [402, 'pro_required'],
    [404, 'plan_not_found'], [409, 'already_checked_in'],
    [422, 'validation_error'], [429, 'rate_limited'], [500, 'internal_error'], [404, 'gym_not_found'],
    [422, 'invalid_qr_token'], [404, 'reward_not_found'], [409, 'reward_inactive'],
    [404, 'redemption_not_found'], [409, 'already_purchased'], [404, 'partner_not_found'],
  ];
  for (const [status, code] of errorExamples) {
    c.ApiErrorResponseSchema.parse({ status, body: { error: { code, message: c.ErrorMessageExamples[code] } } });
    assert.equal(c.ApiErrorResponseSchema.safeParse({ status: 200, body: { error: { code, message: 'Error.' } } }).success, false);
  }
  assert.equal(c.OnboardingRequestSchema.safeParse({ ...questionnaire, is_pro: true }).success, false);
  assert.equal(c.OnboardingRequestSchema.safeParse({ ...questionnaire, weekdays: [1, 1] }).success, false);
  assert.equal(c.OnboardingRequestSchema.safeParse({ ...questionnaire, equipment: ['none', 'bands'] }).success, false);
  assert.equal(c.OnboardingRequestSchema.safeParse({ ...questionnaire, age: 17 }).success, false);
  assert.equal(c.SessionsRequestSchema.safeParse({ ...samples.sessions[0], day_index: 7 }).success, false);
  assert.equal(c.GymQrTokenRequestSchema.safeParse({ params: { id }, headers: { 'xgym-key': 'key' } }).success, false);
  c.RedeemSuccessSchema.parse({ promo_code: 'TEST', balance: 0 });
  assert.equal(c.RedeemSuccessSchema.safeParse({ promo_code: 'TEST', pro_until: timestamp, balance: 0 }).success, false);
  assert.equal(c.RedeemSuccessSchema.safeParse({ balance: 0 }).success, false);
  c.planSchemaFor(questionnaire, new Set(['goblet-squat'])).parse(plan);
  assert.equal(c.planSchemaFor(questionnaire, new Set()).safeParse(plan).success, false);
  assert.equal(c.planSchemaFor({ ...questionnaire, weekdays: [2] }, new Set(['goblet-squat'])).safeParse(plan).success, false);
  const { confidence, disclaimer, ...incompleteNutrition } = samples.nutrition[1];
  assert.equal(c.NutritionSuccessSchema.safeParse(incompleteNutrition).success, false);
  c.GymQrTokenErrorResponseSchema.parse({ status: 404, body: { error: { code: 'gym_not_found', message: c.ErrorMessageExamples.gym_not_found } } });
  c.GymQrTokenErrorResponseSchema.parse({ status: 429, body: { error: { code: 'rate_limited', message: c.ErrorMessageExamples.rate_limited } } });
  console.log('PASS: status mapping, privilege fields, invalid inputs, plan links, required nutrition fields and QR errors');
}
