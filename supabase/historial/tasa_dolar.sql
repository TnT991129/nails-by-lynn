-- Precios en USD + precio del dólar del día. Ejecutar una vez en Supabase → SQL Editor.
-- Los precios que Lynn escribe son en dólares; la web muestra debajo el equivalente en CUP
-- usando el último precio del dólar que ella guarda en el panel (tabla exchange_rates).

-- 1) Servicios, negocio y citas pasan a USD (las cifras ya eran dólares; solo cambia la etiqueta)
update businesses set default_currency = 'USD' where id = '1a115b41-0000-4000-8000-000000000001';
update services   set currency = 'USD'         where business_id = '1a115b41-0000-4000-8000-000000000001';
update appointments set currency = 'USD'       where business_id = '1a115b41-0000-4000-8000-000000000001';
update appointment_items set currency_snapshot = 'USD'
  where appointment_id in (select id from appointments where business_id = '1a115b41-0000-4000-8000-000000000001');

-- 2) Lectura pública del último precio del dólar (la tabla sigue cerrada; solo sale la cifra y la fecha)
create or replace function public.obtener_tasa(p_business_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('tasa', cup_per_usd, 'fecha', effective_date)
  from exchange_rates
  where business_id = p_business_id
  order by effective_date desc
  limit 1
$$;

revoke all on function public.obtener_tasa(uuid) from public;
grant execute on function public.obtener_tasa(uuid) to anon, authenticated;
