-- ════════════════════════════════════════════════════════════════
-- NormaIA · Script de QA — upgrade a Max ilimitado
-- ════════════════════════════════════════════════════════════════
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Cambia el email si te registraste con uno distinto
-- ════════════════════════════════════════════════════════════════

-- ════ PASO 0 (recomendado): añadir columnas opcionales si faltan ════
-- Si tu tabla profiles fue creada con el schema mínimo, le faltan
-- full_name y provincia. Esto es seguro ejecutar — si las columnas
-- ya existen, no pasa nada.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS provincia TEXT;

-- ════ PASO 1: ver el estado actual de tu perfil ════
-- SELECT * trae todas las columnas que sí existan, sin error.
SELECT *
FROM profiles
WHERE email = 'joaquinbautista6@gmail.com';

-- ════ PASO 2: upgrade del usuario a Max QA ════
-- Setea plan = pro_max, límite alto (efectivamente ilimitado para QA),
-- contador en 0, fecha de reset a 1 año, marca como qa-test-account.
UPDATE profiles
SET
  plan = 'pro_max',
  queries_used = 0,
  queries_limit = 99999,
  subscription_id = 'QA-TEST-MAX-' || extract(epoch from now())::bigint,
  subscription_status = 'active',
  reset_date = NOW() + INTERVAL '365 days'
WHERE email = 'joaquinbautista6@gmail.com'
RETURNING id, email, plan, queries_used, queries_limit, subscription_status;

-- ════ PASO 3 (opcional): revertir a Libre cuando termines QA ════
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

-- ════ PASO 4 (opcional): resetear contador para re-testear límites ════
-- UPDATE profiles SET queries_used = 0 WHERE email = 'joaquinbautista6@gmail.com';

-- ════ PASO 5 (opcional): simular que excediste el límite ════
-- Para probar que el modal de upgrade aparece al hacer la 11ª consulta.
-- UPDATE profiles
-- SET plan = 'libre', queries_used = 10, queries_limit = 10
-- WHERE email = 'joaquinbautista6@gmail.com';

-- ════ PASO 6 (opcional): probar Plan Pro ════
-- Para probar que IR-1 e IR-2 se desbloquean pero IR-17 sigue locked en "Max".
-- UPDATE profiles
-- SET plan = 'pro', queries_used = 0, queries_limit = 100,
--     subscription_status = 'active'
-- WHERE email = 'joaquinbautista6@gmail.com';
