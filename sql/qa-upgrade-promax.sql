-- ════════════════════════════════════════════════════════════════
-- NormaIA · Script de QA — upgrade a Pro Max ilimitado
-- ════════════════════════════════════════════════════════════════
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ════════════════════════════════════════════════════════════════

-- ─── PASO 1: ver el estado actual de tu perfil ───────────────────
-- Cambia el email si te registraste con otro
SELECT
  id,
  email,
  full_name,
  plan,
  queries_used,
  queries_limit,
  subscription_status,
  reset_date,
  created_at
FROM profiles
WHERE email = 'joaquinbautista6@gmail.com';

-- ─── PASO 2: upgrade del usuario a Pro Max QA ────────────────────
-- Setea plan = pro_max, límite alto (efectivamente ilimitado para QA),
-- contador en 0, fecha de reset a 1 año, marca como "qa-test-account".
UPDATE profiles
SET
  plan = 'pro_max',
  queries_used = 0,
  queries_limit = 99999,                              -- ~ilimitado para QA
  subscription_id = 'QA-TEST-PROMAX-' || extract(epoch from now())::bigint,
  subscription_status = 'active',
  reset_date = NOW() + INTERVAL '365 days'
WHERE email = 'joaquinbautista6@gmail.com'
RETURNING id, email, plan, queries_used, queries_limit, subscription_status;

-- ─── PASO 3 (opcional): revertir a Libre cuando termines QA ──────
-- Descomenta y ejecuta cuando quieras volver al plan gratis.
-- UPDATE profiles
-- SET
--   plan = 'libre',
--   queries_used = 0,
--   queries_limit = 10,
--   subscription_id = NULL,
--   subscription_status = 'inactive',
--   reset_date = NOW() + INTERVAL '30 days'
-- WHERE email = 'joaquinbautista6@gmail.com';

-- ─── PASO 4 (opcional): resetear contador para re-testear límites ─
-- Útil si quieres probar que el modal de upgrade aparece al exceder
-- el límite — pon queries_used = queries_limit - 1 y haz 2 consultas.
-- UPDATE profiles SET queries_used = 0 WHERE email = 'joaquinbautista6@gmail.com';

-- ─── PASO 5 (opcional): simular que excediste el límite ──────────
-- Para probar el modal de upgrade que aparece en el 11° mensaje.
-- UPDATE profiles
-- SET plan = 'libre', queries_used = 10, queries_limit = 10
-- WHERE email = 'joaquinbautista6@gmail.com';
