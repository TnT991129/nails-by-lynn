-- Precio en rango dentro de la cita: si lleva un complemento de $1–3, la cita guarda
-- también el total máximo (p. ej. $6–8) y así lo ven la clienta, el WhatsApp y el panel.
-- Ejecutar una vez en Supabase → SQL Editor (después de mejoras.sql y agenda_complementos.sql).

-- 1) Columnas nuevas
alter table appointment_item_addons add column if not exists extra_price_max_snapshot numeric(12,2);
alter table appointments add column if not exists total_amount_max numeric(12,2);

-- 2) Total máximo de una cita (null si no tiene nada con rango), con su descuento
create or replace function public.recalcular_total_maximo(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_min numeric(12,2); v_max numeric(12,2); v_pct numeric(5,2);
begin
  select coalesce(sum(i.price_snapshot), 0) into v_min from appointment_items i where i.appointment_id = p_appointment_id;
  v_max := v_min;
  select v_min + coalesce(sum(ad.extra_price_snapshot), 0),
         v_max + coalesce(sum(greatest(coalesce(ad.extra_price_max_snapshot, ad.extra_price_snapshot), ad.extra_price_snapshot)), 0)
    into v_min, v_max
    from appointment_item_addons ad join appointment_items i on i.id = ad.appointment_item_id
   where i.appointment_id = p_appointment_id;
  select coalesce(discount_percent, 0) into v_pct from appointments where id = p_appointment_id;
  update appointments
     set total_amount_max = case when v_max > v_min then v_max - round(v_max * v_pct / 100, 2) end
   where id = p_appointment_id;
end $$;
revoke all on function public.recalcular_total_maximo(uuid) from public, anon, authenticated;

-- 3) Al guardar un complemento en una cita: copiar su precio máximo y recalcular el total máximo
create or replace function public.tg_addon_maximo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_when = 'BEFORE' then
    if new.extra_price_max_snapshot is null and new.addon_id is not null then
      select extra_price_max into new.extra_price_max_snapshot from service_addons where id = new.addon_id;
    end if;
    return new;
  end if;
  perform recalcular_total_maximo((select appointment_id from appointment_items
                                   where id = coalesce(new.appointment_item_id, old.appointment_item_id)));
  return null;
end $$;

drop trigger if exists tg_addon_maximo_antes on appointment_item_addons;
create trigger tg_addon_maximo_antes before insert on appointment_item_addons
  for each row execute function tg_addon_maximo();
drop trigger if exists tg_addon_maximo_despues on appointment_item_addons;
create trigger tg_addon_maximo_despues after insert or update or delete on appointment_item_addons
  for each row execute function tg_addon_maximo();

-- Si cambia el descuento de la cita, el máximo también
create or replace function public.tg_cita_descuento_maximo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform recalcular_total_maximo(new.id);
  return null;
end $$;
drop trigger if exists tg_cita_descuento_maximo on appointments;
create trigger tg_cita_descuento_maximo after update of discount_percent on appointments
  for each row execute function tg_cita_descuento_maximo();

-- 4) Citas que ya existen: copiar los máximos y recalcular
update appointment_item_addons ad set extra_price_max_snapshot = sa.extra_price_max
  from service_addons sa where sa.id = ad.addon_id and ad.extra_price_max_snapshot is null;
select recalcular_total_maximo(id) from appointments;

-- 5) Agenda del panel con el total máximo (columna nueva al final)
create or replace view public.v_agenda with (security_invoker=true) as
 SELECT a.id, a.business_id, a.code, a.starts_at, a.ends_at, a.blocked_until, a.status, a.source,
    a.total_amount, a.currency, a.deposit_amount, a.balance_due, a.total_duration_minutes,
    a.client_note, a.internal_note,
    c.full_name AS cliente_nombre, c.phone AS cliente_telefono, c.id AS client_id,
    ( SELECT string_agg(i.service_name_snapshot, ' + '::text ORDER BY i.sort_order)
        FROM appointment_items i WHERE i.appointment_id = a.id)
    || coalesce(' + ' || ( SELECT string_agg(DISTINCT ad.name_snapshot, ' + '::text ORDER BY ad.name_snapshot)
        FROM appointment_item_addons ad JOIN appointment_items i ON i.id = ad.appointment_item_id
        WHERE i.appointment_id = a.id), '') AS servicios,
    a.discount_percent, a.discount_amount, a.reschedule_count, a.total_amount_max
   FROM appointments a
   JOIN clients c ON c.id = a.client_id;

-- 6) Página de la cita de la clienta con el total máximo y el rango de cada complemento
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
    'total', a.total_amount, 'total_maximo', a.total_amount_max, 'moneda', a.currency, 'anticipo', a.deposit_amount,
    'saldo', a.balance_due, 'nota', a.client_note,
    'descuento_porcentaje', a.discount_percent, 'descuento_monto', a.discount_amount,
    'cliente', jsonb_build_object('nombre', c.full_name, 'telefono', c.phone),
    'negocio', jsonb_build_object('nombre', b.name, 'ubicacion', b.location_label,
                                  'whatsapp', b.phone_whatsapp, 'zona', b.timezone),
    'servicios', (select jsonb_agg(jsonb_build_object('nombre', i.service_name_snapshot,
                    'precio', i.price_snapshot,
                    'complementos', coalesce((select jsonb_agg(jsonb_build_object('nombre', ad.name_snapshot,
                                        'precio', ad.extra_price_snapshot, 'precio_max', ad.extra_price_max_snapshot)
                                        order by ad.name_snapshot)
                                      from appointment_item_addons ad where ad.appointment_item_id = i.id), '[]'::jsonb))
                    order by i.sort_order)
                  from appointment_items i where i.appointment_id = a.id),
    'reprogramaciones', a.reschedule_count,
    'max_reprogramaciones', s.max_reschedules,
    'horas_minimas_reprogramar', s.reschedule_min_hours,
    'cambio_mes_disponible', cambios_clienta_mes(a.client_id) < s.max_reschedules_per_month,
    'resena', (select jsonb_build_object('estrellas', r.rating, 'comentario', r.comment)
               from reviews r where r.appointment_id = a.id))
  into v
  from appointments a
  join clients c on c.id = a.client_id
  join businesses b on b.id = a.business_id
  join settings s on s.business_id = a.business_id
  where a.access_token = p_token;
  if v is null then raise exception 'CITA_NO_ENCONTRADA'; end if;
  return v;
end $function$;
