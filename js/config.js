// js/config.js
// La API key de Dify se movió al servidor (api/chat.js)
// para que no quede expuesta en el frontend.

const CONFIG = {
  // Supabase (anon key es segura en el frontend con RLS activado)
  SUPABASE_URL: 'https://qxxjyndyegknrhgmmkkw.supabase.co',
  SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4eGp5bmR5ZWdrbnJoZ21ta2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDczNzEsImV4cCI6MjA5MTE4MzM3MX0.PnxJJhfORxDbd7JO2Q5XvNBdSkGb7SwNg7zoJsNAkjc',

  // Endpoint serverless propio que proxea a Dify
  CHAT_API_URL: '/api/chat',

  // PayPal (placeholders — reemplazar al pasar a producción)
  PAYPAL_PLAN_PRO: 'P-XXXXXXXXXXXXXXXXXXXXXXXX',
  PAYPAL_PLAN_PROMAX: 'P-YYYYYYYYYYYYYYYYYYYYYYYY',

  // Límites por plan
  PLAN_LIMITS: { libre: 10, pro: 100, pro_max: 1000 },
  PLAN_LABELS: { libre: 'Plan Libre', pro: 'Plan Pro', pro_max: 'Plan Pro Max' },
};

window.CONFIG = CONFIG;
