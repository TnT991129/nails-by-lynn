-- Complementos visibles en las citas + descuento a una cita ya reservada.
-- Ejecutar una vez en Supabase → SQL Editor.

-- 1) Agenda del panel: cada servicio con sus complementos → "Polygel (+ Decoración, Retirada)"
create or replace view public.v_agenda with (security_invoker=true) as
 SELECT a.id, a.business_id, a.code, a.starts_at, a.ends_at, a.blocked_until, a.status, a.source,
    a.total_amount, a.currency, a.deposit_amount, a.balance_due, a.total_duration_minutes,
    a.client_note, a.internal_note,
    c.full_name AS cliente_nombre, c.phone AS cliente_telefono, c.id AS client_id,
    ( SELECT string_agg(i.service_name_snapshot || coalesce(' (+ ' || (
               SELECT string_agg(ad.name_snapshot, ', ' ORDER BY ad.name_snapshot)
               FROM appointment_item_addons ad WHERE ad.appointment_item_id = i.id) || ')', ''),
             ' + '::text ORDER BY i.sort_order)
        FROM appointment_items i WHERE i.appointment_id = a.id) AS servicios,
    a.discount_percent, a.discount_amount, a.reschedule_count
   FROM appointments a
   JOIN clients c ON c.id = a.client_id;

-- 2) Página de la cita de la clienta: cada servicio trae sus complementos
create or replace function public.obtener_cita_por_token(p_token text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare v jsonb;
begin
  select jsonb_build_object('code', a.code, 'inicio', a.starts_at, 'fin', a.ends_at,
    'estado', a.status, 'duracion_minutos', a.total_duration_minutes,
    'margen_minutos', round(extract(epoch from (a.blocked_until - a.ends_at)) / 60)::int,
    'total', a.total_amount, 'moneda', a.currency, 'anticipo', a.deposit_amount,
    'saldo', a.balance_due, 'nota', a.client_note,
    'descuento_porcentaje', a.discount_percent, 'descuento_monto', a.discount_amount,
    'cliente', jsonb_build_object('nombre', c.full_name, 'telefono', c.phone),
    'negocio', jsonb_build_object('nombre', b.name, 'ubicacion', b.location_label,
                                  'whatsapp', b.phone_whatsapp, 'zona', b.timezone),
    'servicios', (select jsonb_agg(jsonb_build_object('nombre', i.service_name_snapshot,
                    'precio', i.price_snapshot,
                    'complementos', coalesce((select jsonb_agg(jsonb_build_object('nombre', ad.name_snapshot,
                                        'precio', ad.extra_price_snapshot) order by ad.name_snapshot)
                                      from appointment_item_addons ad where ad.appointment_item_id = i.id), '[]'::jsonb))
                    order by i.sort_order)
                  from appointment_items i where i.appointment_id = a.id),
    'reprogramaciones', a.reschedule_count,
    'max_reprogramaciones', s.max_reschedules,
    'horas_minimas_reprogramar', s.reschedule_min_hours,
    'cambio_mes_disponible', cambios_clienta_mes(a.client_id) < s.max_reschedules_per_month)
  into v
  from appointments a
  join clients c on c.id = a.client_id
  join businesses b on b.id = a.business_id
  join settings s on s.business_id = a.business_id
  where a.access_token = p_token;
  if v is null then raise exception 'CITA_NO_ENCONTRADA'; end if;
  return v;
end $function$;

-- 3) Lynn aplica (o quita, con 0) un descuento a una cita ya reservada.
--    Se recalcula sobre el precio original: servicios + complementos.
create or replace function public.aplicar_descuento_cita(p_appointment_id uuid, p_porcentaje numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a appointments%rowtype;
  v_base numeric(12,2); v_desc numeric(12,2); v_total numeric(12,2);
begin
  select * into a from appointments where id = p_appointment_id;
  if not found then raise exception 'CITA_NO_ENCONTRADA'; end if;
  if not es_profesional(a.business_id) then raise exception 'NO_AUTORIZADA'; end if;
  if p_porcentaje is null or p_porcentaje < 0 or p_porcentaje > 100 then raise exception 'DESCUENTO_INVALIDO'; end if;

  v_base := coalesce((select sum(i.price_snapshot) from appointment_items i where i.appointment_id = a.id), 0)
          + coalesce((select sum(ad.extra_price_snapshot) from appointment_item_addons ad
                        join appointment_items i on i.id = ad.appointment_item_id
                       where i.appointment_id = a.id), 0);
  v_desc  := round(v_base * p_porcentaje / 100, 2);
  v_total := v_base - v_desc;

  update appointments
     set discount_percent = p_porcentaje, discount_amount = v_desc, total_amount = v_total,
         balance_due = greatest(v_total - deposit_amount, 0)
   where id = a.id;

  return jsonb_build_object('total', v_total, 'descuento', v_desc);
end $$;

revoke all on function public.aplicar_descuento_cita(uuid, numeric) from public, anon;
grant execute on function public.aplicar_descuento_cita(uuid, numeric) to authenticated;
