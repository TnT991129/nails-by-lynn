-- Cierra dos puertas que quedaban abiertas. No toca citas, clientas, servicios, precios, pagos ni horarios.
-- Ejecutar una vez en Supabase → SQL Editor (todo el archivo de una vez), después de fotos_diagnostico.sql.
-- Va entre begin/commit: si algo falla, no se aplica nada.
--
-- 1. diagnostico_fotos(): ya nadie la puede llamar desde la web (la web no la usa).
-- 2. Avisos al móvil de Lynn: la base de datos llama a la función «enviar-push» con una clave secreta
--    guardada en Supabase Vault. La función solo exige la clave cuando se le pone el secreto
--    AVISOS_SECRETO (ver LEEME), así que este archivo por sí solo no cambia nada de los avisos.

begin;

-- =====================================================================
-- 1. Diagnóstico de fotos: sin acceso desde la web (en el SQL Editor se sigue pudiendo usar)
-- =====================================================================
revoke all on function public.diagnostico_fotos() from public, anon, authenticated;

-- =====================================================================
-- 2. Clave de los avisos (se crea una sola vez; si ya existe, se deja como está)
-- =====================================================================
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'avisos_push_secreto') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),   -- 64 caracteres aleatorios
      'avisos_push_secreto',
      'Clave con la que la base de datos llama a la Edge Function enviar-push (super-handler)');
  end if;
end $$;

-- Igual que en avisos_direccion.sql, más la cabecera con la clave.
-- Se ejecuta dentro de cada reserva (trigger): cualquier fallo aquí se ignora para que la reserva
-- siempre se guarde. El aviso no se pierde: queda en push_cola y el cron lo reintenta cada 15 min.
create or replace function public.despertar_envio_push()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_secreto text;
begin
  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'avisos_push_secreto';
  perform net.http_post(
    url := 'https://wxkywplcbfrldnoajirn.supabase.co/functions/v1/super-handler',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-avisos-secreto', coalesce(v_secreto, '')),
    timeout_milliseconds := 20000);
exception when others then
  raise warning 'despertar_envio_push: %', sqlerrm;
end $$;
revoke all on function public.despertar_envio_push() from public, anon, authenticated;

commit;

-- =====================================================================
-- Comprobación (debe salir: diagnostico_web = false, clave_creada = true)
-- =====================================================================
select has_function_privilege('anon', 'public.diagnostico_fotos()', 'execute') as diagnostico_web,
       exists (select 1 from vault.secrets where name = 'avisos_push_secreto') as clave_creada;

-- La clave, para copiarla en Edge Functions → Secrets como AVISOS_SECRETO (ejecutar aparte cuando toque):
--   select decrypted_secret from vault.decrypted_secrets where name = 'avisos_push_secreto';

-- =====================================================================
-- Deshacer (solo si hiciera falta; ejecutar aparte)
-- =====================================================================
--   grant execute on function public.diagnostico_fotos() to anon, authenticated;
--   y volver a ejecutar avisos_direccion.sql (despertar_envio_push sin clave).
--   Si la función ya tiene AVISOS_SECRETO, quitar antes ese secreto en Edge Functions → Secrets.
