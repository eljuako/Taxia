// js/config.js
// Configuración pública (visible en el navegador). Las claves secretas viven
// como variables de entorno en Vercel y NUNCA aquí.

const CONFIG = {
  // Supabase (anon key es segura en el frontend con RLS activado)
  SUPABASE_URL: 'https://qxxjyndyegknrhgmmkkw.supabase.co',
  SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4eGp5bmR5ZWdrbnJoZ21ta2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDczNzEsImV4cCI6MjA5MTE4MzM3MX0.PnxJJhfORxDbd7JO2Q5XvNBdSkGb7SwNg7zoJsNAkjc',

  // Endpoint serverless propio que proxea a Dify
  CHAT_API_URL: '/api/chat',

  // ─────────── PAYPAL (Sandbox / Live según PAYPAL_MODE en Vercel) ───────────
  // Client ID: público, va en el frontend (PayPal SDK lo pide)
  PAYPAL_CLIENT_ID: 'ATV8oudRbZ1kNznEq-EPtPSFGfMRKbOc9vUwKW1JtrhI4lLG803vqLIuLpLWk54dlSF3rzkXRcP1oHhr',

  // Plan IDs creados en PayPal Developer Dashboard
  PAYPAL_PLAN_PRO: 'P-8N785453RL330054DNH7HXAQ',
  PAYPAL_PLAN_PROMAX: 'P-55E08430JG064473XNH7H27Y',

  // Precios visibles en RD$ (cobro real en USD según configuración del Plan en PayPal)
  PRICE_PRO_RD: 1500,
  PRICE_PROMAX_RD: 5000,

  // Modo: 'sandbox' o 'live'. Cambiar a 'live' en producción.
  // El backend usa PAYPAL_MODE de Vercel (env var) para validar contra el endpoint correcto.
  PAYPAL_MODE: 'sandbox',

  // ─────────── Planes y límites ───────────
  PLAN_LIMITS: { libre: 10, pro: 100, pro_max: 1000 },
  PLAN_LABELS: { libre: 'Plan Libre', pro: 'Plan Pro', pro_max: 'Plan Pro Max' },

  // ─────────── Features Toggle ───────────
  // Cambiar a true cuando tengas Chatflow en Dify con nodo de extracción de archivos
  FILE_UPLOAD_ENABLED: false,
};

// Helper: detectar si los Plan IDs están configurados (no son placeholders)
CONFIG.PAYPAL_CONFIGURED = !CONFIG.PAYPAL_PLAN_PRO.startsWith('P-XXXX') && !CONFIG.PAYPAL_PLAN_PROMAX.startsWith('P-YYYY');

window.CONFIG = CONFIG;
