// Configuración y variables de entorno

const CONFIG = {
  // Supabase
  SUPABASE_URL: 'https://qxxjyndyegknrhgmmkkw.supabase.co',
  SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4eGp5bmR5ZWdrbnJoZ21ta2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MDczNzEsImV4cCI6MjA5MTE4MzM3MX0.PnxJJhfORxDbd7JO2Q5XvNBdSkGb7SwNg7zoJsNAkjc',
  
  // Dify
  DIFY_API_KEY: 'app-aSUCW2Lvn1EW87z2jxLXVAwj',
  DIFY_API_URL: 'https://api.dify.ai/v1',
  
  // PayPal
  PAYPAL_PLAN_PRO: 'P-XXXXXXXXXXXXXXXXXXXXXXXX',
  PAYPAL_PLAN_PROMAX: 'P-YYYYYYYYYYYYYYYYYYYYYYYY',
  
  // Planes Limites
  PLAN_LIMITS: { libre: 10, pro: 100, pro_max: 1000 },
  PLAN_LABELS: { libre: 'Plan Libre', pro: 'Plan Pro', pro_max: 'Plan Pro Max' }
};

window.CONFIG = CONFIG;
