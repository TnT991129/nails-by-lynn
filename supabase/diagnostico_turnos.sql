-- Por qué cada turno de los próximos 21 días se ofrece (o no) a las clientas en la web.
-- Solo lee: no cambia nada. Supabase → SQL Editor → ejecutar.
-- Usa las mismas reglas que obtener_disponibilidad, con una cita de 90 min + 15 de margen
-- (Soft Gel o Builder Gel sin extras); con servicios más largos el choque puede ser mayor.

with
neg as (select b.id, b.timezone, s.min_advance_hours, s.max_advance_days, s.fixed_slot_times
        from businesses b join settings s on s.business_id = b.id
        where b.id = '1a115b41-0000-4000-8000-000000000001'),
turnos as (
  select (now() at time zone n.timezone)::date + i as fecha, t.turno,
         ((now() at time zone n.timezone)::date + i + t.turno) at time zone n.timezone as inicio
  from neg n, generate_series(0, 20) i, unnest(n.fixed_slot_times) t(turno)
)
select to_char(t.fecha, 'Dy DD/MM') as dia, to_char(t.turno, 'HH24:MI') as turno,
  case
    when not exists (select 1 from intervalos_trabajo(n.id, t.fecha) h where t.inicio >= h.ini and t.inicio < h.fin)
      then 'Cerrado o fuera de horario'
    when t.fecha > (now() + make_interval(days => n.max_advance_days))::date
      then 'Más allá de los ' || n.max_advance_days || ' días que se pueden reservar'
    when t.inicio < now() + make_interval(hours => n.min_advance_hours)
      then 'Demasiado pronto: la web pide ' || n.min_advance_hours || ' h de antelación'
    else coalesce(
      (select 'Ocupado por la cita ' || a.code || ' (' || a.status || ', '
              || to_char(a.starts_at at time zone n.timezone, 'HH24:MI') || '–'
              || to_char(a.blocked_until at time zone n.timezone, 'HH24:MI') || ' con margen)'
         from appointments a
        where a.business_id = n.id and a.status in ('PENDIENTE', 'CONFIRMADA', 'EN_CURSO')
          and tstzrange(a.starts_at, a.blocked_until) && tstzrange(t.inicio, t.inicio + interval '105 minutes')
        order by a.starts_at limit 1),
      (select 'Bloqueado por Lynn' || coalesce(' («' || bl.reason || '»)', '') || ' '
              || to_char(bl.starts_at at time zone n.timezone, 'DD/MM HH24:MI') || '–'
              || to_char(bl.ends_at at time zone n.timezone, 'DD/MM HH24:MI')
         from blocks bl
        where bl.business_id = n.id and tstzrange(bl.starts_at, bl.ends_at) && tstzrange(t.inicio, t.inicio + interval '105 minutes')
        order by bl.starts_at limit 1),
      (select 'Retenido unos minutos por alguien que está reservando (hasta '
              || to_char(h.expires_at at time zone n.timezone, 'HH24:MI') || ')'
         from holds h
        where h.business_id = n.id and h.expires_at > now()
          and tstzrange(h.starts_at, h.ends_at) && tstzrange(t.inicio, t.inicio + interval '105 minutes')
        limit 1),
      'LIBRE: las clientas lo ven')
  end as estado
from turnos t cross join neg n
order by t.fecha, t.turno;
