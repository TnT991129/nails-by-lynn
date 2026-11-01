-- Recomendaciones (una clienta trae a una amiga) y bonos regalo.
-- Solo AÑADE: dos columnas a las clientas, una a los cobros, una tabla de bonos, dos funciones y dos triggers.
-- No toca citas, servicios, precios ni horarios. Redefine exportar_respaldo igual que estaba, más los bonos.
-- Ejecutar una vez en Supabase → SQL Editor; va entre begin/commit: si algo falla, no se aplica nada.
--
-- Recomendaciones (Panel → Más → Recomendaciones), en settings.site_texts → «_recomendaciones»:
--   {"activa": true, "premio": 10, "amiga": 10}
--   premio = % de descuento para quien recomendó; amiga = % para la amiga en su segunda cita.
-- Se dan solos cuando la amiga completa su PRIMERA cita (Lynn la marca como completada).

begin;

-- ===================== RECOMENDACIONES =====================
alter table public.clients add column if not exists referred_by uuid references public.clients(id) on delete set null;
alter table public.clients add column if not exists referral_rewarded_at timestamptz;
create index if not exists clients_referred_by_idx on public.clients (referred_by);

-- Justo después de reservar, la clienta nueva dice quién la recomendó (con el enlace privado de su cita).
-- No devuelve nada: así no sirve para averiguar qué teléfonos son clientas.
create or replace function public.anotar_recomendacion(p_token text, p_telefono text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_cli clients%rowtype; v_tel text; v_amiga uuid;
begin
  select c.* into v_cli from appointments a join clients c on c.id = a.client_id where a.access_token = p_token;
  -- Solo clientas nuevas (ninguna cita completada) y una sola vez
  if not found or v_cli.referred_by is not null or v_cli.total_appointments > 0 then return; end if;
  v_tel := normalizar_telefono(p_telefono);
  if v_tel is null then return; end if;
  select id into v_amiga from clients
   where business_id = v_cli.business_id and phone = v_tel and id <> v_cli.id and not is_blocked;
  if v_amiga is null then return; end if;
  update clients set referred_by = v_amiga where id = v_cli.id;
end $$;
revoke all on function public.anotar_recomendacion(text, text) from public;
grant execute on function public.anotar_recomendacion(text, text) to anon, authenticated;

-- Al completar la primera cita de una clienta recomendada: descuento para quien la trajo y para ella.
-- Cualquier fallo aquí se ignora: completar una cita nunca puede fallar por esto.
create or replace function public.tg_premio_recomendacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare cfg jsonb; v_cli clients%rowtype; v_premio numeric; v_amiga numeric;
begin
  if new.status <> 'COMPLETADA' or old.status = 'COMPLETADA' then return null; end if;
  begin
    select (site_texts ->> '_recomendaciones')::jsonb into cfg from settings where business_id = new.business_id;
    if cfg is null or coalesce((cfg ->> 'activa')::boolean, false) is false then return null; end if;
    select * into v_cli from clients where id = new.client_id;
    if v_cli.referred_by is null or v_cli.referral_rewarded_at is not null then return null; end if;

    v_premio := least(greatest(coalesce((cfg ->> 'premio')::numeric, 0), 0), 100);
    v_amiga  := least(greatest(coalesce((cfg ->> 'amiga')::numeric, 0), 0), 100);
    if v_premio > 0 then
      update clients
         set next_discount_percent = greatest(coalesce(next_discount_percent, 0), v_premio),
             next_discount_note = 'Por recomendar a ' || split_part(trim(v_cli.full_name), ' ', 1),
             next_discount_at = now()
       where id = v_cli.referred_by and not is_blocked;
    end if;
    if v_amiga > 0 then
      update clients
         set next_discount_percent = greatest(coalesce(next_discount_percent, 0), v_amiga),
             next_discount_note = 'Regalo por venir recomendada', next_discount_at = now()
       where id = v_cli.id;
    end if;
    update clients set referral_rewarded_at = now() where id = v_cli.id;
  exception when others then
    raise warning 'tg_premio_recomendacion: %', sqlerrm;
  end;
  return null;
end $$;
revoke all on function public.tg_premio_recomendacion() from public, anon, authenticated;
-- El nombre va después de t_contadores y tg_premio_fidelidad en el orden alfabético
drop trigger if exists tg_premio_recomendacion on public.appointments;
create trigger tg_premio_recomendacion after update of status on public.appointments
  for each row execute function public.tg_premio_recomendacion();

-- ===================== BONOS REGALO =====================
-- Lynn los vende (en dólares) y se canjean en «Cobrar»: cada canje es un cobro con gift_card_id.
create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null,
  amount numeric(12,2) not null check (amount > 0),
  buyer_name text,
  recipient_name text,
  note text,
  expires_on date,
  is_cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (business_id, code)
);
alter table public.gift_cards enable row level security;
drop policy if exists prof_bonos on public.gift_cards;
create policy prof_bonos on public.gift_cards for all to authenticated
  using (es_profesional(business_id)) with check (es_profesional(business_id));
revoke all on table public.gift_cards from anon;

-- Un bono con canjes no se puede borrar (se anula): restrict
alter table public.payments add column if not exists gift_card_id uuid references public.gift_cards(id) on delete restrict;
create index if not exists payments_gift_card_id_idx on public.payments (gift_card_id);

-- Nadie puede gastar más de lo que queda en un bono, ni usar uno anulado, caducado o de otro negocio
create or replace function public.tg_canje_bono()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare b gift_cards%rowtype; v_usado numeric;
begin
  if new.gift_card_id is null then return new; end if;
  select * into b from gift_cards where id = new.gift_card_id for update;
  if not found or b.business_id <> new.business_id then raise exception 'BONO_NO_EXISTE'; end if;
  if b.is_cancelled then raise exception 'BONO_ANULADO'; end if;
  if b.expires_on is not null and b.expires_on < (now() at time zone 'America/Havana')::date then
    raise exception 'BONO_CADUCADO'; end if;
  if new.currency <> 'USD' then raise exception 'BONO_EN_DOLARES'; end if;
  select coalesce(sum(amount), 0) into v_usado from payments
   where gift_card_id = b.id and status = 'PAGADO_COMPLETO' and id is distinct from new.id;
  if v_usado + new.amount > b.amount + 0.001 then raise exception 'BONO_SIN_SALDO'; end if;
  return new;
end $$;
revoke all on function public.tg_canje_bono() from public, anon, authenticated;
drop trigger if exists tg_canje_bono on public.payments;
create trigger tg_canje_bono before insert or update of amount, gift_card_id, currency on public.payments
  for each row execute function public.tg_canje_bono();

-- Respaldo: igual que antes, más los bonos
create or replace function public.exportar_respaldo(p_business_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not es_profesional(p_business_id) then raise exception 'NO_AUTORIZADA'; end if;
  return jsonb_build_object(
    'generado', now(), 'business_id', p_business_id,
    'businesses',   (select jsonb_agg(to_jsonb(t)) from businesses t where id = p_business_id),
    'settings',     (select jsonb_agg(to_jsonb(t)) from settings t where business_id = p_business_id),
    'services',     (select jsonb_agg(to_jsonb(t)) from services t where business_id = p_business_id),
    'addons',       (select jsonb_agg(to_jsonb(t)) from service_addons t where business_id = p_business_id),
    'clients',      (select jsonb_agg(to_jsonb(t)) from clients t where business_id = p_business_id),
    'appointments', (select jsonb_agg(to_jsonb(t)) from appointments t where business_id = p_business_id),
    'items',        (select jsonb_agg(to_jsonb(t)) from appointment_items t
                      join appointments a on a.id = t.appointment_id where a.business_id = p_business_id),
    'payments',     (select jsonb_agg(to_jsonb(t)) from payments t where business_id = p_business_id),
    'expenses',     (select jsonb_agg(to_jsonb(t)) from expenses t where business_id = p_business_id),
    'rates',        (select jsonb_agg(to_jsonb(t)) from exchange_rates t where business_id = p_business_id),
    'schedule',     (select jsonb_agg(to_jsonb(t)) from schedule_rules t where business_id = p_business_id),
    'photos',       (select jsonb_agg(to_jsonb(t)) from gallery_photos t where business_id = p_business_id),
    'gift_cards',   (select jsonb_agg(to_jsonb(t)) from gift_cards t where business_id = p_business_id));
end $function$;

commit;

-- Comprobación: columnas = 3, bonos = true, triggers = 2
select (select count(*) from information_schema.columns where table_schema = 'public'
          and ((table_name = 'clients' and column_name in ('referred_by', 'referral_rewarded_at'))
            or (table_name = 'payments' and column_name = 'gift_card_id'))) as columnas,
       to_regclass('public.gift_cards') is not null as bonos,
       (select count(*) from pg_trigger where tgname in ('tg_premio_recomendacion', 'tg_canje_bono')) as triggers;
