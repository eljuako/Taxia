// api/paypal-confirm.js
// Vercel Edge Function — Confirma una suscripción PayPal y actualiza Supabase.
//
// Variables de entorno requeridas en Vercel:
//   PAYPAL_CLIENT_ID         — Client ID de PayPal (también está en frontend)
//   PAYPAL_SECRET            — Secret de PayPal (NUNCA en frontend)
//   PAYPAL_MODE              — 'sandbox' o 'live'
//   PAYPAL_PLAN_PRO_ID       — Plan ID Pro creado en PayPal Dashboard
//   PAYPAL_PLAN_PROMAX_ID    — Plan ID Pro Max
//   SUPABASE_URL             — URL del proyecto Supabase
//   SUPABASE_SERVICE_ROLE_KEY — Service role key (Settings → API en Supabase)

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Validar env vars
  const {
    PAYPAL_CLIENT_ID,
    PAYPAL_SECRET,
    PAYPAL_MODE = 'sandbox',
    PAYPAL_PLAN_PRO_ID,
    PAYPAL_PLAN_PROMAX_ID,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = process.env;

  const missing = [];
  if (!PAYPAL_CLIENT_ID) missing.push('PAYPAL_CLIENT_ID');
  if (!PAYPAL_SECRET) missing.push('PAYPAL_SECRET');
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length) return json({ error: 'Server misconfigured: faltan env vars: ' + missing.join(', ') }, 500);

  // Parsear body
  let body;
  try { body = await req.json(); } catch (e) {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { subscriptionID, userId, planKey, userEmail } = body || {};
  if (!subscriptionID || !userId || !planKey) {
    return json({ error: 'Missing fields: subscriptionID, userId, planKey' }, 400);
  }

  // Validar que planKey sea válido
  if (!['pro', 'pro_max'].includes(planKey)) {
    return json({ error: 'Invalid planKey' }, 400);
  }

  const PAYPAL_BASE = PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  // ─────────── 1) Obtener access token de PayPal ───────────
  let accessToken;
  try {
    const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`);
    const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      return json({ error: 'PayPal auth failed', detail: t.slice(0, 200) }, 502);
    }
    const tokenData = await tokenRes.json();
    accessToken = tokenData.access_token;
  } catch (e) {
    return json({ error: 'No se pudo conectar con PayPal' }, 502);
  }

  // ─────────── 2) Verificar la suscripción ───────────
  let subscription;
  try {
    const subRes = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionID}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!subRes.ok) {
      const t = await subRes.text();
      return json({ error: 'No se encontró la suscripción en PayPal', detail: t.slice(0, 200) }, 404);
    }
    subscription = await subRes.json();
  } catch (e) {
    return json({ error: 'Error verificando suscripción' }, 502);
  }

  // ─────────── 3) Validar estado y plan_id ───────────
  if (!['ACTIVE', 'APPROVAL_PENDING', 'APPROVED'].includes(subscription.status)) {
    return json({ error: 'Suscripción en estado no válido: ' + subscription.status }, 400);
  }

  const expectedPlanId = planKey === 'pro_max' ? PAYPAL_PLAN_PROMAX_ID : PAYPAL_PLAN_PRO_ID;
  if (expectedPlanId && subscription.plan_id !== expectedPlanId) {
    return json({
      error: 'Plan ID no coincide. Esperado: ' + expectedPlanId + ' Recibido: ' + subscription.plan_id
    }, 400);
  }

  // ─────────── 4) Actualizar perfil en Supabase (vía service role) ───────────
  const PLAN_LIMITS = { pro: 100, pro_max: 1000 };
  const newLimit = PLAN_LIMITS[planKey];

  try {
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        plan: planKey,
        subscription_id: subscriptionID,
        subscription_status: 'active',
        queries_limit: newLimit,
        queries_used: 0, // resetear contador al iniciar suscripción
      }),
    });

    if (!updateRes.ok) {
      const t = await updateRes.text();
      return json({
        error: 'Pago confirmado pero error al actualizar Supabase',
        detail: t.slice(0, 300),
        subscription_id: subscriptionID, // útil para soporte manual
      }, 500);
    }
  } catch (e) {
    return json({
      error: 'Pago confirmado pero error de conexión con Supabase',
      subscription_id: subscriptionID,
    }, 500);
  }

  // ─────────── Éxito ───────────
  return json({
    success: true,
    plan: planKey,
    subscription_id: subscriptionID,
    status: subscription.status,
    queries_limit: newLimit,
    user_email: userEmail,
  }, 200);
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
