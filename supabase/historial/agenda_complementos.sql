-- Agenda: primero todos los servicios y luego los complementos, cada uno una sola vez.
-- "RUBBER BASE + PEDICURA + Retiro de producto de Nails by Lynn"
-- Ejecutar una vez en Supabase → SQL Editor.
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
    a.discount_percent, a.discount_amount, a.reschedule_count
   FROM appointments a
   JOIN clients c ON c.id = a.client_id;

-- Citas ya guardadas con el mismo complemento repetido en varios servicios:
-- se deja una sola vez (con el primer servicio) y se recalcula el total con su descuento.
drop table if exists citas_arregladas;
create temp table citas_arregladas as
  select distinct i.appointment_id as id
  from appointment_item_addons ad
  join appointment_items i on i.id = ad.appointment_item_id
  group by i.appointment_id, ad.addon_id, ad.name_snapshot
  having count(*) > 1;

delete from appointment_item_addons ad
using (
  select ad2.id,
         row_number() over (partition by i.appointment_id, ad2.name_snapshot order by i.sort_order, i.id) as n
  from appointment_item_addons ad2
  join appointment_items i on i.id = ad2.appointment_item_id
  where i.appointment_id in (select id from citas_arregladas)
) d
where ad.id = d.id and d.n > 1;

update appointments a
   set total_amount   = t.base - round(t.base * a.discount_percent / 100, 2),
       discount_amount = round(t.base * a.discount_percent / 100, 2),
       balance_due    = greatest(t.base - round(t.base * a.discount_percent / 100, 2) - a.deposit_amount, 0)
  from (
    select x.id,
           coalesce((select sum(i.price_snapshot) from appointment_items i where i.appointment_id = x.id), 0)
         + coalesce((select sum(ad.extra_price_snapshot) from appointment_item_addons ad
                       join appointment_items i on i.id = ad.appointment_item_id
                      where i.appointment_id = x.id), 0) as base
    from citas_arregladas x
  ) t
 where a.id = t.id;

drop table if exists citas_arregladas;
