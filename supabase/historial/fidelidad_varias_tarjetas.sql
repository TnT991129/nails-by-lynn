-- Varias tarjetas de fidelidad (p. ej. «Normal»: 5.ª cita 15 %; «VIP»: 3.ª cita 20 %) y cada clienta con la suya.
-- Va encima de historial/fidelidad_elegidas.sql. Solo AÑADE una columna a las clientas (la tarjeta que tiene) y
-- redefine las dos funciones de la tarjeta. Las clientas a las que Lynn ya dio la tarjeta pasan a tener la primera.
-- No toca citas, servicios, precios ni horarios. Ejecutar una vez en Supabase → SQL Editor;
-- va entre begin/commit: si algo falla, no se aplica nada.
--
-- Configuración (Panel → Más → Tarjeta de fidelidad), en settings.site_texts → «_fidelidad»:
--   {"activa": true, "modo": "todas" | "elegidas",
--    "tarjetas": [{"id": "principal", "nombre": "Normal", "repetir": true, "niveles": [{"citas": 5, "premio": 15}]},
--                 {"id": "vip", "nombre": "VIP", "repetir": true, "niveles": [{"citas": 3, "premio": 20}]}]}
-- Sin «tarjetas» (configuración de antes) hay una sola, hecha con «niveles» y «repetir» (o «sellos» y «premio»).
--
-- Qué tarjeta tiene cada clienta (tarjeta_de_clienta):
--   apagada                → ninguna
--   «solo las que elija»   → la que Lynn le dio (clients.loyalty_card); sin ella, ninguna
--   «para todas»           → ninguna si Lynn la sacó (loyalty_excluded); si no, la que le dio o, si no, la primera
-- Los sellos son de la clienta (citas completadas + los puestos a mano): cambiar de tarjeta no los borra.

begin;

alter table public.clients add column if not exists loyalty_card text;
-- Quien ya tenía la tarjeta «solo para las que elija» se queda con la primera (la de siempre)
update public.clients set loyalty_card = 'principal' where loyalty_enrolled and loyalty_card is null;

create or replace function public.tarjeta_de_clienta(cfg jsonb, p_tarjeta text, p_excluida boolean)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare v_lista jsonb; v_t jsonb;
begin
  if cfg is null or coalesce((cfg ->> 'activa')::boolean, false) is false then return null; end if;
  if jsonb_typeof(cfg -> 'tarjetas') = 'array' and jsonb_array_length(cfg -> 'tarjetas') > 0 then
    v_lista := cfg -> 'tarjetas';
  else
    v_lista := jsonb_build_array(jsonb_build_object(
      'id', 'principal', 'nombre', 'Tarjeta de fidelidad', 'repetir', coalesce(cfg -> 'repetir', 'true'::jsonb),
      'niveles', case when jsonb_typeof(cfg -> 'niveles') = 'array' and jsonb_array_length(cfg -> 'niveles') > 0
                      then cfg -> 'niveles'
                      else jsonb_build_array(jsonb_build_object('citas', cfg -> 'sellos', 'premio', cfg -> 'premio')) end));
  end if;
  if p_tarjeta is not null then
    select x into v_t from jsonb_array_elements(v_lista) x where x ->> 'id' = p_tarjeta limit 1;
  end if;
  if cfg ->> 'modo' = 'elegidas' then return v_t; end if;
  if coalesce(p_excluida, false) then return null; end if;
  return coalesce(v_t, v_lista -> 0);
end $$;
revoke all on function public.tarjeta_de_clienta(jsonb, text, boolean) from public, anon, authenticated;

-- Lo que ve la clienta: sus sellos, su tarjeta (premios) y si tiene un premio esperando
create or replace function public.tarjeta_fidelidad(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('completadas', greatest(c.total_appointments + c.loyalty_adjustment, 0),
                            'fuera', f.t is null,
                            'tarjeta', f.t,
                            'descuento_pendiente', c.next_discount_percent)
    from appointments a
    join clients c on c.id = a.client_id
    left join lateral (select tarjeta_de_clienta((s.site_texts ->> '_fidelidad')::jsonb, c.loyalty_card, c.loyalty_excluded) as t
                         from settings s where s.business_id = a.business_id) f on true
   where a.access_token = p_token
$$;
revoke all on function public.tarjeta_fidelidad(text) from public;
grant execute on function public.tarjeta_fidelidad(text) to anon, authenticated;

-- Al completar una cita: si con ese sello llega a un premio de SU tarjeta, se le deja para la próxima cita.
-- Cualquier fallo aquí se ignora: completar una cita nunca puede fallar por la tarjeta.
create or replace function public.tg_premio_fidelidad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_t jsonb; v_niveles jsonb; v_repetir boolean; v_tamano int; v_sellos int; v_pos int; v_premio numeric;
begin
  if new.status <> 'COMPLETADA' or old.status = 'COMPLETADA' then return null; end if;
  begin
    select tarjeta_de_clienta((s.site_texts ->> '_fidelidad')::jsonb, c.loyalty_card, c.loyalty_excluded),
           greatest(c.total_appointments + c.loyalty_adjustment, 0)
      into v_t, v_sellos
      from clients c join settings s on s.business_id = new.business_id
     where c.id = new.client_id;
    if v_t is null or v_sellos < 1 then return null; end if;
    v_repetir := coalesce((v_t ->> 'repetir')::boolean, true);
    v_niveles := v_t -> 'niveles';
    if v_niveles is null or jsonb_typeof(v_niveles) <> 'array' then return null; end if;
    select max((n ->> 'citas')::int) into v_tamano from jsonb_array_elements(v_niveles) n;
    if v_tamano is null or v_tamano < 1 then return null; end if;
    if not v_repetir and v_sellos > v_tamano then return null; end if;
    v_pos := case when v_repetir then ((v_sellos - 1) % v_tamano) + 1 else v_sellos end;

    select max((n ->> 'premio')::numeric) into v_premio
      from jsonb_array_elements(v_niveles) n where (n ->> 'citas')::int = v_pos;
    if v_premio is not null and v_premio > 0 and v_premio <= 100 then
      update clients
         set next_discount_percent = greatest(coalesce(next_discount_percent, 0), v_premio),
             next_discount_note = 'Premio de la tarjeta de fidelidad', next_discount_at = now()
       where id = new.client_id;
    end if;
  exception when others then
    raise warning 'tg_premio_fidelidad: %', sqlerrm;
  end;
  return null;
end $$;
revoke all on function public.tg_premio_fidelidad() from public, anon, authenticated;
-- El trigger ya existe (fidelidad_niveles.sql) y llama a esta función: no hace falta recrearlo

commit;

-- Comprobación: columna = true, trigger = true
select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'clients'
                 and column_name = 'loyalty_card') as columna,
       exists (select 1 from pg_trigger where tgname = 'tg_premio_fidelidad') as trigger;
