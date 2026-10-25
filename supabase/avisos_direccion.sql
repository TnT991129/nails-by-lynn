-- La Edge Function de los avisos quedó creada en Supabase con la dirección «super-handler»
-- (el nombre que se ve es «enviar-push», pero la dirección la puso Supabase sola).
-- Esto hace que la base de datos llame a esa dirección. Ejecutar una vez en el SQL Editor,
-- después de avisos_lynn.sql.

create or replace function public.despertar_envio_push()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://wxkywplcbfrldnoajirn.supabase.co/functions/v1/super-handler',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 20000);
end $$;
revoke all on function public.despertar_envio_push() from public, anon, authenticated;

-- Envía ya lo que esté esperando en la cola (las reservas de prueba de antes)
select public.despertar_envio_push();
