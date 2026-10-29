-- Mejoras: reseñas de clientas, alergias y cumpleaños.
-- Ejecutar una vez en Supabase → SQL Editor.

-- 1) Ficha de clienta: alergias (se ven en rojo al abrir su cita) y cumpleaños
alter table clients add column if not exists allergies text;
alter table clients add column if not exists birthday date;

-- 2) La página de la cita devuelve también la reseña que dejó la clienta
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

-- 3) La clienta valora su cita (solo si ya está completada). Puede cambiarla mientras Lynn no la publique.
create or replace function public.dejar_resena(p_token text, p_estrellas int, p_comentario text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare a appointments%rowtype; v_publicada boolean;
begin
  select * into a from appointments where access_token = p_token;
  if not found then raise exception 'CITA_NO_ENCONTRADA'; end if;
  if a.status <> 'COMPLETADA' then raise exception 'RESENA_NO_DISPONIBLE'; end if;
  if p_estrellas is null or p_estrellas < 1 or p_estrellas > 5 then raise exception 'RESENA_INVALIDA'; end if;

  select is_published into v_publicada from reviews where appointment_id = a.id;
  if coalesce(v_publicada, false) then raise exception 'RESENA_YA_PUBLICADA'; end if;

  insert into reviews (business_id, appointment_id, client_id, rating, comment)
  values (a.business_id, a.id, a.client_id, p_estrellas, nullif(left(trim(coalesce(p_comentario, '')), 600), ''))
  on conflict (appointment_id) do update set rating = excluded.rating, comment = excluded.comment;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.dejar_resena(text, int, text) from public;
grant execute on function public.dejar_resena(text, int, text) to anon, authenticated;

-- 4) Reseñas que Lynn publicó: solo nombre de pila, estrellas, comentario y fecha
create or replace function public.obtener_resenas(p_business_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'media',  (select round(avg(rating)::numeric, 1) from reviews where business_id = p_business_id and is_published),
    'total',  (select count(*) from reviews where business_id = p_business_id and is_published),
    'lista',  coalesce((select jsonb_agg(x order by x->>'fecha' desc) from (
                select jsonb_build_object('estrellas', r.rating, 'comentario', r.comment,
                         'nombre', split_part(trim(c.full_name), ' ', 1), 'fecha', r.published_at) as x
                from reviews r join clients c on c.id = r.client_id
                where r.business_id = p_business_id and r.is_published
                order by r.published_at desc limit 12) t), '[]'::jsonb))
$$;

revoke all on function public.obtener_resenas(uuid) from public;
grant execute on function public.obtener_resenas(uuid) to anon, authenticated;
