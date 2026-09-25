-- Estructura de la base de datos de Nails by Lynn (sin datos).
-- Generado con supabase/exportar_esquema.sql. Es una copia de referencia:
-- la fuente de verdad sigue siendo Supabase. Actualízala tras cada cambio de SQL.
-- Nota: no incluye permisos (grant/revoke) de funciones.


-- ======================================================================
-- 0. Extensiones
-- ======================================================================

create extension if not exists btree_gist with schema public;

create extension if not exists pg_stat_statements with schema extensions;

create extension if not exists pgcrypto with schema extensions;

create extension if not exists supabase_vault with schema vault;

create extension if not exists "uuid-ossp" with schema extensions;


-- ======================================================================
-- 1. Tipos (enums)
-- ======================================================================

create type public.canal_notif as enum ('WHATSAPP_ASISTIDO', 'WHATSAPP_AUTO', 'EMAIL', 'PUSH', 'SMS');

create type public.categoria_gasto as enum ('MATERIAL', 'HERRAMIENTAS', 'LOCAL', 'TRANSPORTE', 'MARKETING', 'OTRO');

create type public.destinatario_notif as enum ('CLIENTA', 'PROFESIONAL');

create type public.estado_cita as enum ('PENDIENTE', 'CONFIRMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA_CLIENTA', 'CANCELADA_NEGOCIO', 'NO_SHOW');

create type public.estado_notif as enum ('PENDIENTE', 'ENVIADA', 'OMITIDA', 'FALLIDA');

create type public.estado_pago as enum ('PENDIENTE', 'ANTICIPO_PAGADO', 'PAGADO_COMPLETO', 'REEMBOLSADO', 'CANCELADO');

create type public.metodo_pago as enum ('TRANSFERMOVIL', 'ENZONA', 'TRANSFERENCIA', 'EFECTIVO', 'OTRO');

create type public.modo_anticipo as enum ('HEREDAR', 'NINGUNO', 'FIJO', 'PORCENTAJE');

create type public.moneda as enum ('CUP', 'USD');

create type public.origen_cita as enum ('WEB', 'MANUAL', 'WHATSAPP', 'INSTAGRAM');

create type public.rol_usuario as enum ('CLIENTA', 'PROFESIONAL', 'ADMIN_PLATAFORMA');

create type public.tipo_actor as enum ('CLIENTA', 'PROFESIONAL', 'SISTEMA');

create type public.tipo_excepcion as enum ('CERRADO', 'HORARIO_ESPECIAL');

create type public.tipo_favorito as enum ('SERVICIO', 'FOTO');

create type public.tipo_pago as enum ('ANTICIPO', 'SALDO', 'PAGO_TOTAL', 'REEMBOLSO');

create type public.visibilidad_ubicacion as enum ('PUBLICA', 'SOLO_CLIENTAS', 'OCULTA');


-- ======================================================================
-- 2. Tablas
-- ======================================================================

create table public.appointment_item_addons (
  id uuid default gen_random_uuid() not null,
  appointment_item_id uuid not null,
  addon_id uuid,
  name_snapshot text not null,
  extra_minutes_snapshot integer default 0 not null,
  extra_price_snapshot numeric(12,2) default 0 not null
);

create table public.appointment_items (
  id uuid default gen_random_uuid() not null,
  appointment_id uuid not null,
  service_id uuid,
  service_name_snapshot text not null,
  duration_minutes_snapshot integer not null,
  price_snapshot numeric(12,2) not null,
  currency_snapshot moneda not null,
  sort_order integer default 0 not null
);

create table public.appointments (
  id uuid default gen_random_uuid() not null,
  business_id uuid not null,
  client_id uuid not null,
  code text not null,
  access_token text not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  blocked_until timestamp with time zone not null,
  total_duration_minutes integer not null,
  status estado_cita default 'PENDIENTE'::estado_cita not null,
  source origen_cita default 'WEB'::origen_cita not null,
  total_amount numeric(12,2) default 0 not null,
  currency moneda default 'CUP'::moneda not null,
  exchange_rate_used numeric(12,4),
  exchange_rate_date date,
  deposit_amount numeric(12,2) default 0 not null,
  balance_due numeric(12,2) default 0 not null,
  client_note text,
  internal_note text,
  reschedule_count integer default 0 not null,
  cancelled_at timestamp with time zone,
  cancelled_by tipo_actor,
  cancellation_reason text,
  completed_at timestamp with time zone,
  policies_accepted_at timestamp with time zone not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.audit_log (
  id bigint default nextval('audit_log_id_seq'::regclass) not null,
  business_id uuid,
  actor_id uuid,
  actor_type tipo_actor default 'SISTEMA'::tipo_actor not null,
  action text not null,
  entity_type text,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamp with time zone default now() not null
);

create table public.blocks (
  id uuid default gen_random_uuid() not null,
  business_id uuid not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  reason text,
  created_by uuid,
  created_at timestamp with time zone default now() not null
);

create table public.businesses (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  name text not null,
  tagline text,
  description text,
  logo_url text,
  hero_image_url text,
  phone_whatsapp text,
  instagram_url text,
  location_label text,
  location_address text,
  location_visibility visibilidad_ubicacion default 'OCULTA'::visibilidad_ubicacion not null,
  location_lat numeric(10,7),
  location_lng numeric(10,7),
  timezone text default 'America/Havana'::text not null,
  default_currency moneda default 'CUP'::moneda not null,
  is_accepting_bookings boolean default true not null,
  closed_message text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.clients (
  id uuid default gen_random_uuid() not null,
  business_id uuid not null,
  profile_id uuid,
  full_name text not null,
  phone text not null,
  email text,
  instagram text,
  internal_notes text,
  photo_consent boolean default false not null,
  photo_consent_at timestamp with time zone,
  total_appointments integer default 0 not null,
  total_no_shows integer default 0 not null,
  total_cancellations integer default 0 not null,
  total_spent_cup numeric(12,2) default 0 not null,
  is_blocked boolean default false not null,
  first_seen_at timestamp with time zone default now() not null,
  last_appointment_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.exchange_rates (
  id uuid default gen_random_uuid() not null,
  business_id uuid not null,
  effective_date date not null,
  cup_per_usd numeric(12,4) not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null
);

create table public.expenses (
  id uuid default gen_random_uuid() not null,
  business_id uuid not null,
  date date not null,
  category categoria_gasto default 'MATERIAL'::categoria_gasto not null,
  description text,
  amount numeric(12,2) not null,
  currency moneda default 'CUP'::moneda not null,
  exchange_rate_used numeric(12,4),
  appointment_id uuid,
  receipt_url text,
  created_at timestamp with time zone default now() not null
);

create table public.favorites (
  id uuid default gen_random_uuid() not null,
  business_id uuid not null,
  client_id uuid not null,
  target_type tipo_favorito not null,
  target_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table public.gallery_photos (
  id uuid default gen_random_uuid() not null,
  business_id uuid not null,
  image_url text not null,
  thumbnail_url text,
  alt_text text,
  caption text,
  service_id uuid,
  client_id uuid,
  has_consent boolean default false not null,
  is_featured boolean default false not null,
  is_published boolean default true not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null
);

create table public.holds (
  id uuid default gen_random_uuid() not null,
  business_id uuid not null,
  session_token text not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now() not null
);

create table public.notifications (
  id uuid default gen_random_uuid() not null,
  business_id uuid not null,
  appointment_id uuid,
  recipient_type destinatario_notif not null,
  recipient_phone text,
  channel canal_notif default 'WHATSAPP_ASISTIDO'::canal_notif not null,
  template_key text not null,
  rendered_message text not null,
  scheduled_for timestamp with time zone not null,
  status estado_notif default 'PENDIENTE'::estado_notif not null,
  sent_at timestamp with time zone,
  sent_by uuid,
  created_at timestamp with time zone default now() not null
);

create table public.payments (
  id uuid default gen_random_uuid() not null,
  business_id uuid not null,
  appointment_id uuid not null,
  type tipo_pago not null,
  amount numeric(12,2) not null,
  currency moneda not null,
  exchange_rate_used numeric(12,4),
  method metodo_pago,
  status estado_pago default 'PENDIENTE'::estado_pago not null,
  reference text,
  proof_url text,
  verified_by uuid,
  verified_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table public.photo_tags (
  photo_id uuid not null,
  tag_id uuid not null
);

create table public.profiles (
  id uuid not null,
  business_id uuid not null,
  role rol_usuario default 'CLIENTA'::rol_usuario not null,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamp with time zone default now() not null,
  last_seen_at timestamp with time zone
);

create table public.reviews (
  id uuid default gen_random_uuid() not null,
  business_id uuid not null,
  appointment_id uuid not null,
  client_id uuid not null,
  rating smallint not null,
  comment text,
  is_published boolean default false not null,
  published_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table public.schedule_exceptions (
  id uuid default gen_random_uuid() not null,
  business_id uuid not null,
  date_from date not null,
  date_to date not null,
  type tipo_excepcion not null,
  start_time time without time zone,
  end_time time without time zone,
  reason text,
  created_at timestamp with time zone default now() not null
);

create table public.schedule_rules (
  id uuid default gen_random_uuid() not null,
  business_id uuid not null,
  weekday smallint not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  is_active boolean default true not null
);

create table public.service_addons (
  id uuid default gen_random_uuid() not null,
  business_id uuid not null,
  service_id uuid,
  name text not null,
  extra_minutes integer default 0 not null,
  extra_price numeric(12,2) default 0 not null,
  is_active boolean default true not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null
);

create table public.services (
  id uuid default gen_random_uuid() not null,
  business_id uuid not null,
  name text not null,
  slug text not null,
  short_description text,
  description text,
  duration_minutes integer not null,
  buffer_after_minutes integer default 0 not null,
  price numeric(12,2) not null,
  currency moneda default 'CUP'::moneda not null,
  deposit_mode modo_anticipo default 'HEREDAR'::modo_anticipo not null,
  deposit_value numeric(12,2),
  cover_image_url text,
  is_active boolean default true not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.settings (
  business_id uuid not null,
  min_advance_hours integer default 2 not null,
  max_advance_days integer default 60 not null,
  hold_minutes integer default 10 not null,
  slot_granularity_minutes integer default 15 not null,
  default_buffer_minutes integer default 10 not null,
  deposit_enabled boolean default false not null,
  deposit_mode modo_anticipo default 'NINGUNO'::modo_anticipo not null,
  deposit_value numeric(12,2),
  payment_instructions text,
  require_proof boolean default true not null,
  cancel_free_hours integer default 24 not null,
  cancel_blocked_hours integer default 2 not null,
  reschedule_min_hours integer default 24 not null,
  max_reschedules integer default 2 not null,
  policy_cancellation text,
  policy_reschedule text,
  policy_deposit text,
  policy_no_show text,
  policy_late text,
  policy_refund text,
  policy_waiting text,
  privacy_notice text,
  max_active_appointments_per_phone integer default 2 not null,
  max_bookings_per_device_24h integer default 3 not null,
  reminder_offsets_hours integer[] default '{24,2}'::integer[] not null,
  updated_at timestamp with time zone default now() not null,
  fixed_slot_times time without time zone[]
);

create table public.tags (
  id uuid default gen_random_uuid() not null,
  business_id uuid not null,
  name text not null,
  slug text not null,
  sort_order integer default 0 not null
);

create table public.waitlist (
  id uuid default gen_random_uuid() not null,
  business_id uuid not null,
  client_id uuid not null,
  service_id uuid,
  preferred_date_from date,
  preferred_date_to date,
  preferred_time_from time without time zone,
  preferred_time_to time without time zone,
  status text default 'ACTIVA'::text not null,
  notified_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);


-- ======================================================================
-- 3. Claves primarias, únicas, checks y EXCLUDE
-- ======================================================================

alter table public.appointment_item_addons add constraint aia_minutos CHECK ((extra_minutes_snapshot >= 0));

alter table public.appointment_item_addons add constraint aia_precio CHECK ((extra_price_snapshot >= (0)::numeric));

alter table public.appointment_item_addons add constraint appointment_item_addons_pkey PRIMARY KEY (id);

alter table public.appointment_items add constraint ai_duracion CHECK ((duration_minutes_snapshot > 0));

alter table public.appointment_items add constraint ai_precio CHECK ((price_snapshot >= (0)::numeric));

alter table public.appointment_items add constraint appointment_items_pkey PRIMARY KEY (id);

alter table public.appointments add constraint ap_anticipo CHECK (((deposit_amount >= (0)::numeric) AND (deposit_amount <= total_amount)));

alter table public.appointments add constraint ap_buffer CHECK ((blocked_until >= ends_at));

alter table public.appointments add constraint ap_cancelacion CHECK (((status <> ALL (ARRAY['CANCELADA_CLIENTA'::estado_cita, 'CANCELADA_NEGOCIO'::estado_cita])) OR ((cancelled_at IS NOT NULL) AND (cancelled_by IS NOT NULL))));

alter table public.appointments add constraint ap_completada CHECK (((status <> 'COMPLETADA'::estado_cita) OR (completed_at IS NOT NULL)));

alter table public.appointments add constraint ap_duracion CHECK ((total_duration_minutes > 0));

alter table public.appointments add constraint ap_orden CHECK ((ends_at > starts_at));

alter table public.appointments add constraint appointments_access_token_key UNIQUE (access_token);

alter table public.appointments add constraint appointments_code_key UNIQUE (code);

alter table public.appointments add constraint appointments_pkey PRIMARY KEY (id);

alter table public.appointments add constraint sin_citas_solapadas EXCLUDE USING gist (business_id WITH =, tstzrange(starts_at, blocked_until) WITH &&) WHERE ((status = ANY (ARRAY['PENDIENTE'::estado_cita, 'CONFIRMADA'::estado_cita, 'EN_CURSO'::estado_cita])));

alter table public.audit_log add constraint audit_log_pkey PRIMARY KEY (id);

alter table public.blocks add constraint blocks_orden CHECK ((ends_at > starts_at));

alter table public.blocks add constraint blocks_pkey PRIMARY KEY (id);

alter table public.businesses add constraint businesses_pkey PRIMARY KEY (id);

alter table public.businesses add constraint businesses_slug_key UNIQUE (slug);

alter table public.clients add constraint clients_consent_fecha CHECK (((photo_consent = false) OR (photo_consent_at IS NOT NULL)));

alter table public.clients add constraint clients_phone_unico UNIQUE (business_id, phone);

alter table public.clients add constraint clients_pkey PRIMARY KEY (id);

alter table public.exchange_rates add constraint er_positiva CHECK ((cup_per_usd > (0)::numeric));

alter table public.exchange_rates add constraint er_unica UNIQUE (business_id, effective_date);

alter table public.exchange_rates add constraint exchange_rates_pkey PRIMARY KEY (id);

alter table public.expenses add constraint ex_monto CHECK ((amount >= (0)::numeric));

alter table public.expenses add constraint expenses_pkey PRIMARY KEY (id);

alter table public.favorites add constraint fav_unico UNIQUE (client_id, target_type, target_id);

alter table public.favorites add constraint favorites_pkey PRIMARY KEY (id);

alter table public.gallery_photos add constraint gallery_photos_pkey PRIMARY KEY (id);

alter table public.gallery_photos add constraint gp_consentimiento CHECK (((is_published = false) OR (client_id IS NULL) OR (has_consent = true)));

alter table public.holds add constraint holds_orden CHECK ((ends_at > starts_at));

alter table public.holds add constraint holds_pkey PRIMARY KEY (id);

alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);

alter table public.payments add constraint pa_monto CHECK ((amount >= (0)::numeric));

alter table public.payments add constraint pa_verificacion CHECK (((verified_by IS NULL) = (verified_at IS NULL)));

alter table public.payments add constraint payments_pkey PRIMARY KEY (id);

alter table public.photo_tags add constraint photo_tags_pkey PRIMARY KEY (photo_id, tag_id);

alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);

alter table public.reviews add constraint reviews_pkey PRIMARY KEY (id);

alter table public.reviews add constraint rv_rating CHECK (((rating >= 1) AND (rating <= 5)));

alter table public.reviews add constraint rv_una_por_cita UNIQUE (appointment_id);

alter table public.schedule_exceptions add constraint schedule_exceptions_pkey PRIMARY KEY (id);

alter table public.schedule_exceptions add constraint se_horas CHECK ((((type = 'CERRADO'::tipo_excepcion) AND (start_time IS NULL) AND (end_time IS NULL)) OR ((type = 'HORARIO_ESPECIAL'::tipo_excepcion) AND (start_time IS NOT NULL) AND (end_time IS NOT NULL) AND (end_time > start_time))));

alter table public.schedule_exceptions add constraint se_rango CHECK ((date_to >= date_from));

alter table public.schedule_rules add constraint schedule_rules_pkey PRIMARY KEY (id);

alter table public.schedule_rules add constraint sr_orden CHECK ((end_time > start_time));

alter table public.schedule_rules add constraint sr_weekday CHECK (((weekday >= 0) AND (weekday <= 6)));

alter table public.service_addons add constraint addons_minutos_no_negativos CHECK ((extra_minutes >= 0));

alter table public.service_addons add constraint addons_precio_no_negativo CHECK ((extra_price >= (0)::numeric));

alter table public.service_addons add constraint service_addons_pkey PRIMARY KEY (id);

alter table public.services add constraint services_anticipo_coherente CHECK (((deposit_mode = ANY (ARRAY['HEREDAR'::modo_anticipo, 'NINGUNO'::modo_anticipo])) OR (deposit_value IS NOT NULL)));

alter table public.services add constraint services_buffer_no_negativo CHECK ((buffer_after_minutes >= 0));

alter table public.services add constraint services_duracion_positiva CHECK ((duration_minutes > 0));

alter table public.services add constraint services_pkey PRIMARY KEY (id);

alter table public.services add constraint services_precio_no_negativo CHECK ((price >= (0)::numeric));

alter table public.services add constraint services_slug_unico UNIQUE (business_id, slug);

alter table public.settings add constraint settings_granularidad CHECK ((slot_granularity_minutes = ANY (ARRAY[5, 10, 15, 20, 30, 60])));

alter table public.settings add constraint settings_pkey PRIMARY KEY (business_id);

alter table public.settings add constraint settings_ventanas CHECK ((cancel_blocked_hours <= cancel_free_hours));

alter table public.tags add constraint tags_pkey PRIMARY KEY (id);

alter table public.tags add constraint tags_slug_unico UNIQUE (business_id, slug);

alter table public.waitlist add constraint waitlist_pkey PRIMARY KEY (id);


-- ======================================================================
-- 4. Claves foráneas
-- ======================================================================

alter table public.appointment_item_addons add constraint appointment_item_addons_addon_id_fkey FOREIGN KEY (addon_id) REFERENCES service_addons(id) ON DELETE RESTRICT;

alter table public.appointment_item_addons add constraint appointment_item_addons_appointment_item_id_fkey FOREIGN KEY (appointment_item_id) REFERENCES appointment_items(id) ON DELETE CASCADE;

alter table public.appointment_items add constraint appointment_items_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

alter table public.appointment_items add constraint appointment_items_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT;

alter table public.appointments add constraint appointments_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.appointments add constraint appointments_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;

alter table public.audit_log add constraint audit_log_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;

alter table public.blocks add constraint blocks_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.blocks add constraint blocks_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public.clients add constraint clients_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.clients add constraint clients_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public.exchange_rates add constraint exchange_rates_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.exchange_rates add constraint exchange_rates_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public.expenses add constraint expenses_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;

alter table public.expenses add constraint expenses_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.favorites add constraint favorites_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.favorites add constraint favorites_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table public.gallery_photos add constraint gallery_photos_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.gallery_photos add constraint gallery_photos_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

alter table public.gallery_photos add constraint gallery_photos_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;

alter table public.holds add constraint holds_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.notifications add constraint notifications_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

alter table public.notifications add constraint notifications_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.notifications add constraint notifications_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public.payments add constraint payments_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

alter table public.payments add constraint payments_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.payments add constraint payments_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES profiles(id) ON DELETE SET NULL;

alter table public.photo_tags add constraint photo_tags_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES gallery_photos(id) ON DELETE CASCADE;

alter table public.photo_tags add constraint photo_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;

alter table public.profiles add constraint profiles_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.reviews add constraint reviews_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

alter table public.reviews add constraint reviews_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.reviews add constraint reviews_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table public.schedule_exceptions add constraint schedule_exceptions_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.schedule_rules add constraint schedule_rules_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.service_addons add constraint service_addons_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.service_addons add constraint service_addons_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;

alter table public.services add constraint services_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.settings add constraint settings_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.tags add constraint tags_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.waitlist add constraint waitlist_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

alter table public.waitlist add constraint waitlist_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table public.waitlist add constraint waitlist_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;


-- ======================================================================
-- 5. Índices
-- ======================================================================

CREATE INDEX appointment_item_addons_appointment_item_id_idx ON public.appointment_item_addons USING btree (appointment_item_id);

CREATE INDEX appointment_items_appointment_id_idx ON public.appointment_items USING btree (appointment_id);

CREATE INDEX appointments_business_id_starts_at_idx ON public.appointments USING btree (business_id, starts_at);

CREATE INDEX appointments_business_id_status_starts_at_idx ON public.appointments USING btree (business_id, status, starts_at);

CREATE INDEX appointments_client_id_starts_at_idx ON public.appointments USING btree (client_id, starts_at DESC);

CREATE INDEX audit_log_business_id_created_at_idx ON public.audit_log USING btree (business_id, created_at DESC);

CREATE INDEX audit_log_entity_type_entity_id_idx ON public.audit_log USING btree (entity_type, entity_id);

CREATE INDEX blocks_business_id_starts_at_ends_at_idx ON public.blocks USING btree (business_id, starts_at, ends_at);

CREATE INDEX clients_business_id_full_name_idx ON public.clients USING btree (business_id, full_name);

CREATE INDEX clients_business_id_last_appointment_at_idx ON public.clients USING btree (business_id, last_appointment_at DESC);

CREATE INDEX exchange_rates_business_id_effective_date_idx ON public.exchange_rates USING btree (business_id, effective_date DESC);

CREATE INDEX expenses_business_id_date_idx ON public.expenses USING btree (business_id, date DESC);

CREATE INDEX gallery_photos_business_id_is_published_sort_order_idx ON public.gallery_photos USING btree (business_id, is_published, sort_order);

CREATE INDEX gallery_photos_business_id_service_id_idx ON public.gallery_photos USING btree (business_id, service_id);

CREATE INDEX holds_business_id_expires_at_idx ON public.holds USING btree (business_id, expires_at);

CREATE INDEX holds_business_id_starts_at_ends_at_idx ON public.holds USING btree (business_id, starts_at, ends_at);

CREATE INDEX holds_session_token_idx ON public.holds USING btree (session_token);

CREATE INDEX notifications_appointment_id_idx ON public.notifications USING btree (appointment_id);

CREATE INDEX notifications_business_id_status_scheduled_for_idx ON public.notifications USING btree (business_id, status, scheduled_for);

CREATE INDEX payments_appointment_id_idx ON public.payments USING btree (appointment_id);

CREATE INDEX payments_business_id_status_idx ON public.payments USING btree (business_id, status);

CREATE INDEX photo_tags_tag_id_idx ON public.photo_tags USING btree (tag_id);

CREATE INDEX profiles_business_id_role_idx ON public.profiles USING btree (business_id, role);

CREATE INDEX schedule_exceptions_business_id_date_from_date_to_idx ON public.schedule_exceptions USING btree (business_id, date_from, date_to);

CREATE INDEX schedule_rules_business_id_weekday_is_active_idx ON public.schedule_rules USING btree (business_id, weekday, is_active);

CREATE INDEX service_addons_business_id_service_id_is_active_idx ON public.service_addons USING btree (business_id, service_id, is_active);

CREATE INDEX services_business_id_is_active_sort_order_idx ON public.services USING btree (business_id, is_active, sort_order);

CREATE INDEX waitlist_business_id_status_idx ON public.waitlist USING btree (business_id, status);


-- ======================================================================
-- 6. Funciones
-- ======================================================================

CREATE OR REPLACE FUNCTION public.cancelar_cita(p_token text, p_motivo text DEFAULT NULL::text, p_por tipo_actor DEFAULT 'CLIENTA'::tipo_actor)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a appointments%rowtype; s settings%rowtype; b businesses%rowtype; v_horas numeric;
begin
  select * into a from appointments where access_token = p_token;
  if not found then raise exception 'CITA_NO_ENCONTRADA'; end if;
  if a.status not in ('PENDIENTE','CONFIRMADA') then raise exception 'CITA_NO_CANCELABLE'; end if;
  select * into s from settings where business_id = a.business_id;
  select * into b from businesses where id = a.business_id;

  v_horas := extract(epoch from (a.starts_at - now())) / 3600.0;
  if p_por = 'CLIENTA' and v_horas < s.cancel_blocked_hours then
    raise exception 'FUERA_DE_PLAZO';
  end if;

  update appointments set
    status = case when p_por = 'CLIENTA' then 'CANCELADA_CLIENTA'::estado_cita
                  else 'CANCELADA_NEGOCIO'::estado_cita end,
    cancelled_at = now(), cancelled_by = p_por, cancellation_reason = p_motivo, updated_at = now()
  where id = a.id;

  update notifications set status = 'OMITIDA'
   where appointment_id = a.id and status = 'PENDIENTE' and template_key like 'recordatorio%';

  insert into notifications (business_id, appointment_id, recipient_type, recipient_phone,
    template_key, rendered_message, scheduled_for)
  select a.business_id, a.id, 'PROFESIONAL', b.phone_whatsapp, 'hueco_liberado',
    format('Se libero el %s a las %s', to_char(a.starts_at at time zone b.timezone,'DD/MM'),
           to_char(a.starts_at at time zone b.timezone,'HH12:MI AM')), now();

  insert into audit_log (business_id, actor_type, action, entity_type, entity_id, before, after)
  values (a.business_id, p_por, 'cita.cancelada', 'appointment', a.id,
          jsonb_build_object('estado', a.status), jsonb_build_object('motivo', p_motivo));

  return jsonb_build_object('ok', true, 'horas_de_antelacion', round(v_horas,1),
    'anticipo_reembolsable', v_horas >= s.cancel_free_hours);
end $function$
;

CREATE OR REPLACE FUNCTION public.crear_cita(p_business_id uuid, p_session_token text, p_inicio timestamp with time zone, p_items jsonb, p_nombre text, p_telefono text, p_email text DEFAULT NULL::text, p_instagram text DEFAULT NULL::text, p_nota text DEFAULT NULL::text, p_origen origen_cita DEFAULT 'WEB'::origen_cita, p_device_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  s settings%rowtype; b businesses%rowtype;
  v_tel text; v_client clients%rowtype; v_hold holds%rowtype;
  v_dur int := 0; v_buffer int := 0; v_total numeric(12,2) := 0;
  v_item jsonb; v_srv services%rowtype; v_addon service_addons%rowtype; v_addon_id uuid;
  v_ap_id uuid; v_item_id uuid; v_code text; v_token text;
  v_fin timestamptz; v_bloq timestamptz;
  v_tasa numeric(12,4); v_tasa_fecha date; v_anticipo numeric(12,2) := 0;
  v_activas int; v_recientes int; v_intentos int := 0; v_ok boolean := false;
  v_off int; v_moneda moneda;
begin
  select * into b from businesses where id = p_business_id;
  if not found then raise exception 'NEGOCIO_NO_EXISTE'; end if;
  if not b.is_accepting_bookings then raise exception 'RESERVAS_CERRADAS'; end if;
  select * into s from settings where business_id = p_business_id;

  -- E5: hold vivo de esta sesion
  select * into v_hold from holds
   where business_id = p_business_id and session_token = p_session_token and expires_at > now();
  if not found and p_origen = 'WEB' then raise exception 'RETENCION_VENCIDA'; end if;

  -- Sumar duracion y precio desde los servicios reales (nunca desde el cliente)
  if jsonb_array_length(p_items) = 0 then raise exception 'SIN_SERVICIOS'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_srv from services
     where id = (v_item->>'service_id')::uuid and business_id = p_business_id and is_active;
    if not found then raise exception 'SERVICIO_NO_DISPONIBLE'; end if;
    v_dur := v_dur + v_srv.duration_minutes;
    v_total := v_total + v_srv.price;
    v_buffer := greatest(v_buffer, v_srv.buffer_after_minutes);
    v_moneda := v_srv.currency;
    if v_item ? 'addons' then
      for v_addon_id in select (jsonb_array_elements_text(v_item->'addons'))::uuid loop
        select * into v_addon from service_addons
         where id = v_addon_id and business_id = p_business_id and is_active;
        if not found then raise exception 'ADDON_NO_DISPONIBLE'; end if;
        v_dur := v_dur + v_addon.extra_minutes;
        v_total := v_total + v_addon.extra_price;
      end loop;
    end if;
  end loop;
  if v_buffer = 0 then v_buffer := s.default_buffer_minutes; end if;

  v_fin  := p_inicio + make_interval(mins => v_dur);
  v_bloq := v_fin + make_interval(mins => v_buffer);

  -- E1/E2: ventanas de antelacion
  if p_origen = 'WEB' then
    if p_inicio < now() + make_interval(hours => s.min_advance_hours) then
      raise exception 'DEMASIADO_PRONTO'; end if;
    if p_inicio::date > (now() + make_interval(days => s.max_advance_days))::date then
      raise exception 'DEMASIADO_LEJOS'; end if;
  end if;

  -- Clienta: crear o reutilizar por telefono normalizado
  v_tel := normalizar_telefono(p_telefono);
  if v_tel is null then raise exception 'TELEFONO_INVALIDO'; end if;
  select * into v_client from clients where business_id = p_business_id and phone = v_tel;
  if not found then
    insert into clients (business_id, full_name, phone, email, instagram)
    values (p_business_id, p_nombre, v_tel, p_email, p_instagram)
    returning * into v_client;
  else
    if v_client.is_blocked then raise exception 'CLIENTA_BLOQUEADA'; end if;
  end if;

  -- E6/E7: limites antifraude
  if p_origen = 'WEB' then
    select count(*) into v_activas from appointments
     where client_id = v_client.id and status in ('PENDIENTE','CONFIRMADA') and starts_at > now();
    if v_activas >= s.max_active_appointments_per_phone then raise exception 'LIMITE_CITAS_ACTIVAS'; end if;
    if p_device_id is not null then
      select count(*) into v_recientes from audit_log
       where business_id = p_business_id and action = 'cita.creada'
         and after->>'device_id' = p_device_id and created_at > now() - interval '24 hours';
      if v_recientes >= s.max_bookings_per_device_24h then raise exception 'LIMITE_DISPOSITIVO'; end if;
    end if;
  end if;

  -- Tasa del dia congelada
  select cup_per_usd, effective_date into v_tasa, v_tasa_fecha from exchange_rates
   where business_id = p_business_id and effective_date <= (now() at time zone b.timezone)::date
   order by effective_date desc limit 1;

  -- Anticipo
  if s.deposit_enabled then
    if s.deposit_mode = 'FIJO' then v_anticipo := least(coalesce(s.deposit_value,0), v_total);
    elsif s.deposit_mode = 'PORCENTAJE' then v_anticipo := round(v_total * coalesce(s.deposit_value,0)/100, 2);
    end if;
  end if;

  -- Insertar cita (la restriccion EXCLUDE decide) con reintento de codigo unico
  while v_intentos < 8 and not v_ok loop
    v_intentos := v_intentos + 1;
    v_code := generar_codigo_cita();
    v_token := encode(gen_random_bytes(24), 'hex');
    begin
      insert into appointments (business_id, client_id, code, access_token, starts_at, ends_at,
        blocked_until, total_duration_minutes, status, source, total_amount, currency,
        exchange_rate_used, exchange_rate_date, deposit_amount, balance_due, client_note,
        policies_accepted_at)
      values (p_business_id, v_client.id, v_code, v_token, p_inicio, v_fin, v_bloq, v_dur,
        case when s.deposit_enabled and v_anticipo > 0 then 'PENDIENTE'::estado_cita
             else 'CONFIRMADA'::estado_cita end,
        p_origen, v_total, coalesce(v_moneda, b.default_currency), v_tasa, v_tasa_fecha,
        v_anticipo, v_total - v_anticipo, p_nota, now())
      returning id into v_ap_id;
      v_ok := true;
    exception
      when unique_violation then null;  -- codigo repetido: reintentar
      when exclusion_violation then raise exception 'HORARIO_YA_TOMADO';
    end;
  end loop;
  if not v_ok then raise exception 'NO_SE_PUDO_GENERAR_CODIGO'; end if;

  -- Lineas de servicio con precios congelados
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_srv from services where id = (v_item->>'service_id')::uuid;
    insert into appointment_items (appointment_id, service_id, service_name_snapshot,
      duration_minutes_snapshot, price_snapshot, currency_snapshot)
    values (v_ap_id, v_srv.id, v_srv.name, v_srv.duration_minutes, v_srv.price, v_srv.currency)
    returning id into v_item_id;
    if v_item ? 'addons' then
      for v_addon_id in select (jsonb_array_elements_text(v_item->'addons'))::uuid loop
        select * into v_addon from service_addons where id = v_addon_id;
        insert into appointment_item_addons (appointment_item_id, addon_id, name_snapshot,
          extra_minutes_snapshot, extra_price_snapshot)
        values (v_item_id, v_addon.id, v_addon.name, v_addon.extra_minutes, v_addon.extra_price);
      end loop;
    end if;
  end loop;

  -- Pago
  insert into payments (business_id, appointment_id, type, amount, currency, exchange_rate_used, status)
  values (p_business_id, v_ap_id,
          case when v_anticipo > 0 then 'ANTICIPO'::tipo_pago else 'PAGO_TOTAL'::tipo_pago end,
          case when v_anticipo > 0 then v_anticipo else v_total end,
          coalesce(v_moneda, b.default_currency), v_tasa, 'PENDIENTE');

  -- Liberar hold
  delete from holds where session_token = p_session_token;

  -- Notificaciones
  insert into notifications (business_id, appointment_id, recipient_type, recipient_phone,
    template_key, rendered_message, scheduled_for)
  values (p_business_id, v_ap_id, 'CLIENTA', v_tel, 'confirmacion',
    format('Tu cita con %s esta confirmada. %s a las %s. Ver tu cita: /cita/%s',
      b.name, to_char(p_inicio at time zone b.timezone, 'DD/MM'),
      to_char(p_inicio at time zone b.timezone, 'HH12:MI AM'), v_token), now()),
   (p_business_id, v_ap_id, 'PROFESIONAL', b.phone_whatsapp, 'aviso_nueva',
    format('Nueva reserva: %s - %s %s', p_nombre,
      to_char(p_inicio at time zone b.timezone, 'DD/MM'),
      to_char(p_inicio at time zone b.timezone, 'HH12:MI AM')), now());

  foreach v_off in array s.reminder_offsets_hours loop
    if p_inicio - make_interval(hours => v_off) > now() then
      insert into notifications (business_id, appointment_id, recipient_type, recipient_phone,
        template_key, rendered_message, scheduled_for)
      values (p_business_id, v_ap_id, 'CLIENTA', v_tel, 'recordatorio_' || v_off || 'h',
        format('Recordatorio: tu cita con %s es el %s a las %s', b.name,
          to_char(p_inicio at time zone b.timezone, 'DD/MM'),
          to_char(p_inicio at time zone b.timezone, 'HH12:MI AM')),
        p_inicio - make_interval(hours => v_off));
    end if;
  end loop;

  insert into audit_log (business_id, actor_type, action, entity_type, entity_id, after)
  values (p_business_id, 'CLIENTA', 'cita.creada', 'appointment', v_ap_id,
          jsonb_build_object('code', v_code, 'inicio', p_inicio, 'device_id', p_device_id));

  return jsonb_build_object('id', v_ap_id, 'code', v_code, 'access_token', v_token,
    'inicio', p_inicio, 'fin', v_fin, 'duracion_minutos', v_dur,
    'total', v_total, 'anticipo', v_anticipo, 'saldo', v_total - v_anticipo);
end $function$
;

CREATE OR REPLACE FUNCTION public.crear_hold(p_business_id uuid, p_inicio timestamp with time zone, p_duracion_minutos integer, p_session_token text, p_buffer_minutos integer DEFAULT NULL::integer)
 RETURNS TABLE(hold_id uuid, expira_en timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare s settings%rowtype; v_buffer int; v_fin timestamptz; v_exp timestamptz; v_id uuid;
begin
  delete from holds where business_id = p_business_id and expires_at < now();
  delete from holds where session_token = p_session_token;

  select * into s from settings where business_id = p_business_id;
  v_buffer := coalesce(p_buffer_minutos, s.default_buffer_minutes);
  v_fin := p_inicio + make_interval(mins => p_duracion_minutos + v_buffer);
  v_exp := now() + make_interval(mins => s.hold_minutes);

  if exists (select 1 from appointments a
      where a.business_id = p_business_id and a.status in ('PENDIENTE','CONFIRMADA','EN_CURSO')
        and tstzrange(a.starts_at, a.blocked_until) && tstzrange(p_inicio, v_fin))
     or exists (select 1 from blocks b where b.business_id = p_business_id
        and tstzrange(b.starts_at, b.ends_at) && tstzrange(p_inicio, v_fin))
     or exists (select 1 from holds h where h.business_id = p_business_id and h.expires_at > now()
        and tstzrange(h.starts_at, h.ends_at) && tstzrange(p_inicio, v_fin)) then
    raise exception 'HORARIO_NO_DISPONIBLE';
  end if;

  insert into holds (business_id, session_token, starts_at, ends_at, expires_at)
  values (p_business_id, p_session_token, p_inicio, v_fin, v_exp)
  returning id into v_id;

  return query select v_id, v_exp;
end $function$
;

CREATE OR REPLACE FUNCTION public.eliminar_clienta_con_historial(p_client_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_negocio uuid; v_citas uuid[];
begin
  select business_id into v_negocio from clients where id = p_client_id;
  if not found then raise exception 'CLIENTA_NO_ENCONTRADA'; end if;
  if not es_profesional(v_negocio) then raise exception 'NO_AUTORIZADA'; end if;

  -- No borrar a quien tiene citas por venir
  if exists (select 1 from appointments
             where client_id = p_client_id
               and status in ('PENDIENTE','CONFIRMADA','EN_CURSO')
               and blocked_until > now()) then
    raise exception 'CLIENTA_CON_CITAS_ACTIVAS';
  end if;

  select coalesce(array_agg(id), '{}') into v_citas from appointments where client_id = p_client_id;

  delete from appointment_item_addons
   where appointment_item_id in (select id from appointment_items where appointment_id = any(v_citas));
  delete from appointment_items where appointment_id = any(v_citas);
  delete from payments          where appointment_id = any(v_citas);
  delete from notifications     where appointment_id = any(v_citas);
  delete from appointments      where id = any(v_citas);
  delete from clients           where id = p_client_id;

  return jsonb_build_object('citas_borradas', coalesce(array_length(v_citas, 1), 0));
end $function$
;

CREATE OR REPLACE FUNCTION public.es_profesional(p_business_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (select 1 from profiles
    where id = auth.uid() and business_id = p_business_id
      and role in ('PROFESIONAL','ADMIN_PLATAFORMA'));
$function$
;

CREATE OR REPLACE FUNCTION public.es_turno_valido(p_business_id uuid, p_inicio timestamp with time zone)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select coalesce((
    select s.fixed_slot_times is null
        or (p_inicio at time zone b.timezone)::time = any (s.fixed_slot_times)
      from settings s join businesses b on b.id = s.business_id
     where s.business_id = p_business_id
  ), true)
$function$
;

CREATE OR REPLACE FUNCTION public.exportar_respaldo(p_business_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return jsonb_build_object(
    'generado', now(), 'business_id', p_business_id,
    'businesses',   (select jsonb_agg(to_jsonb(t)) from businesses t where id = p_business_id),
    'settings',     (select jsonb_agg(to_jsonb(t)) from settings t where business_id = p_business_id),
    'services',     (select jsonb_agg(to_jsonb(t)) from services t where business_id = p_business_id),
    'addons',       (select jsonb_agg(to_jsonb(t)) from service_addons t where business_id = p_business_id),
    'clients',      (select jsonb_agg(to_jsonb(t)) from clients t where business_id = p_business_id),
    'appointments', (select jsonb_agg(to_jsonb(t)) from appointments t where business_id = p_business_id),
    'items',        (select jsonb_agg(to_jsonb(t)) from appointment_items t),
    'payments',     (select jsonb_agg(to_jsonb(t)) from payments t where business_id = p_business_id),
    'expenses',     (select jsonb_agg(to_jsonb(t)) from expenses t where business_id = p_business_id),
    'rates',        (select jsonb_agg(to_jsonb(t)) from exchange_rates t where business_id = p_business_id),
    'schedule',     (select jsonb_agg(to_jsonb(t)) from schedule_rules t where business_id = p_business_id),
    'photos',       (select jsonb_agg(to_jsonb(t)) from gallery_photos t where business_id = p_business_id));
end $function$
;

CREATE OR REPLACE FUNCTION public.generar_codigo_cita(p_prefijo text DEFAULT 'NBL'::text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; s text := ''; i int;
begin
  for i in 1..4 loop
    s := s || substr(alfabeto, 1 + floor(random()*length(alfabeto))::int, 1);
  end loop;
  return p_prefijo || '-' || s;
end $function$
;

CREATE OR REPLACE FUNCTION public.intervalos_trabajo(p_business_id uuid, p_fecha date)
 RETURNS TABLE(ini timestamp with time zone, fin timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_tz text; v_cerrado boolean;
begin
  select timezone into v_tz from businesses where id = p_business_id;
  if v_tz is null then return; end if;

  select exists(select 1 from schedule_exceptions
    where business_id = p_business_id and type = 'CERRADO'
      and p_fecha between date_from and date_to) into v_cerrado;
  if v_cerrado then return; end if;

  if exists(select 1 from schedule_exceptions
      where business_id = p_business_id and type = 'HORARIO_ESPECIAL'
        and p_fecha between date_from and date_to) then
    return query
      select (p_fecha + e.start_time) at time zone v_tz,
             (p_fecha + e.end_time)   at time zone v_tz
      from schedule_exceptions e
      where e.business_id = p_business_id and e.type = 'HORARIO_ESPECIAL'
        and p_fecha between e.date_from and e.date_to;
    return;
  end if;

  return query
    select (p_fecha + r.start_time) at time zone v_tz,
           (p_fecha + r.end_time)   at time zone v_tz
    from schedule_rules r
    where r.business_id = p_business_id and r.is_active
      and r.weekday = extract(dow from p_fecha)::smallint
    order by r.start_time;
end $function$
;

CREATE OR REPLACE FUNCTION public.mi_client_id(p_business_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select id from clients where business_id = p_business_id and profile_id = auth.uid() limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.normalizar_telefono(p text, p_pais text DEFAULT '53'::text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare d text;
begin
  d := regexp_replace(coalesce(p,''), '[^0-9+]', '', 'g');
  if d like '+%' then return d; end if;
  d := regexp_replace(d, '[^0-9]', '', 'g');
  if d = '' then return null; end if;
  if left(d, length(p_pais)) = p_pais and length(d) > 8 then return '+' || d; end if;
  return '+' || p_pais || d;
end $function$
;

CREATE OR REPLACE FUNCTION public.obtener_cita_por_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb;
begin
  select jsonb_build_object('code', a.code, 'inicio', a.starts_at, 'fin', a.ends_at,
    'estado', a.status, 'duracion_minutos', a.total_duration_minutes,
    'total', a.total_amount, 'moneda', a.currency, 'anticipo', a.deposit_amount,
    'saldo', a.balance_due, 'nota', a.client_note,
    'cliente', jsonb_build_object('nombre', c.full_name, 'telefono', c.phone),
    'negocio', jsonb_build_object('nombre', b.name, 'ubicacion', b.location_label,
                                  'whatsapp', b.phone_whatsapp, 'zona', b.timezone),
    'servicios', (select jsonb_agg(jsonb_build_object('nombre', i.service_name_snapshot,
                    'precio', i.price_snapshot) order by i.sort_order)
                  from appointment_items i where i.appointment_id = a.id),
    'reprogramaciones', a.reschedule_count)
  into v
  from appointments a join clients c on c.id = a.client_id join businesses b on b.id = a.business_id
  where a.access_token = p_token;
  if v is null then raise exception 'CITA_NO_ENCONTRADA'; end if;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.obtener_disponibilidad(p_business_id uuid, p_fecha date, p_duracion_minutos integer, p_buffer_minutos integer DEFAULT NULL::integer)
 RETURNS TABLE(hora timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare s settings%rowtype; v_buffer int; v_acepta boolean; v_tz text; v_min timestamptz; v_max date;
begin
  delete from holds where business_id = p_business_id and expires_at < now();

  select * into s from settings where business_id = p_business_id;
  if not found then return; end if;
  select is_accepting_bookings, timezone into v_acepta, v_tz from businesses where id = p_business_id;
  if not v_acepta then return; end if;

  v_buffer := coalesce(p_buffer_minutos, s.default_buffer_minutes);
  v_min := now() + make_interval(hours => s.min_advance_hours);
  v_max := (now() + make_interval(days => s.max_advance_days))::date;
  if p_fecha > v_max then return; end if;

  return query
  with candidatos as (
    -- Modo libre: un hueco cada N minutos y la cita debe caber antes del cierre
    select generate_series(t.ini, t.fin - make_interval(mins => p_duracion_minutos),
                           make_interval(mins => s.slot_granularity_minutes)) as h,
           t.fin
    from intervalos_trabajo(p_business_id, p_fecha) t
    where s.fixed_slot_times is null
    union all
    -- Turnos fijos: se ofrece el turno si su hora de inicio cae dentro del horario del día
    select (p_fecha + x.turno) at time zone v_tz as h, null::timestamptz as fin
    from intervalos_trabajo(p_business_id, p_fecha) t,
         unnest(s.fixed_slot_times) as x(turno)
    where s.fixed_slot_times is not null
      and (p_fecha + x.turno) at time zone v_tz >= t.ini
      and (p_fecha + x.turno) at time zone v_tz <  t.fin
  )
  select c.h from candidatos c
  where c.h >= v_min
    and (c.fin is null or c.h + make_interval(mins => p_duracion_minutos) <= c.fin)
    and not exists (
      select 1 from appointments a
      where a.business_id = p_business_id
        and a.status in ('PENDIENTE','CONFIRMADA','EN_CURSO')
        and tstzrange(a.starts_at, a.blocked_until)
            && tstzrange(c.h, c.h + make_interval(mins => p_duracion_minutos + v_buffer)))
    and not exists (
      select 1 from blocks b
      where b.business_id = p_business_id
        and tstzrange(b.starts_at, b.ends_at)
            && tstzrange(c.h, c.h + make_interval(mins => p_duracion_minutos + v_buffer)))
    and not exists (
      select 1 from holds hl
      where hl.business_id = p_business_id and hl.expires_at > now()
        and tstzrange(hl.starts_at, hl.ends_at)
            && tstzrange(c.h, c.h + make_interval(mins => p_duracion_minutos + v_buffer)))
  order by c.h;
end $function$
;

CREATE OR REPLACE FUNCTION public.reprogramar_cita(p_token text, p_nuevo_inicio timestamp with time zone, p_session_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a appointments%rowtype; s settings%rowtype; b businesses%rowtype;
        v_horas numeric; v_fin timestamptz; v_bloq timestamptz; v_buffer int;
begin
  select * into a from appointments where access_token = p_token;
  if not found then raise exception 'CITA_NO_ENCONTRADA'; end if;
  if a.status not in ('PENDIENTE','CONFIRMADA') then raise exception 'CITA_NO_REPROGRAMABLE'; end if;
  select * into s from settings where business_id = a.business_id;
  select * into b from businesses where id = a.business_id;

  v_horas := extract(epoch from (a.starts_at - now())) / 3600.0;
  if v_horas < s.reschedule_min_hours then raise exception 'FUERA_DE_PLAZO'; end if;
  if a.reschedule_count >= s.max_reschedules then raise exception 'LIMITE_REPROGRAMACIONES'; end if;

  v_buffer := extract(epoch from (a.blocked_until - a.ends_at))/60;
  v_fin  := p_nuevo_inicio + make_interval(mins => a.total_duration_minutes);
  v_bloq := v_fin + make_interval(mins => v_buffer::int);

  begin
    update appointments set starts_at = p_nuevo_inicio, ends_at = v_fin, blocked_until = v_bloq,
      reschedule_count = a.reschedule_count + 1, updated_at = now()
    where id = a.id;
  exception when exclusion_violation then raise exception 'HORARIO_YA_TOMADO';
  end;

  if p_session_token is not null then delete from holds where session_token = p_session_token; end if;

  update notifications set status = 'OMITIDA'
   where appointment_id = a.id and status = 'PENDIENTE' and template_key like 'recordatorio%';

  insert into audit_log (business_id, actor_type, action, entity_type, entity_id, before, after)
  values (a.business_id, 'CLIENTA', 'cita.reprogramada', 'appointment', a.id,
          jsonb_build_object('inicio', a.starts_at), jsonb_build_object('inicio', p_nuevo_inicio));

  return jsonb_build_object('ok', true, 'inicio_anterior', a.starts_at, 'inicio_nuevo', p_nuevo_inicio,
    'reprogramaciones_usadas', a.reschedule_count + 1, 'maximo', s.max_reschedules);
end $function$
;

CREATE OR REPLACE FUNCTION public.tg_contadores_clienta()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if TG_OP = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'COMPLETADA' then
      update clients set total_appointments = total_appointments + 1,
        total_spent_cup = total_spent_cup + case when new.currency = 'CUP' then new.total_amount
          else new.total_amount * coalesce(new.exchange_rate_used, 1) end,
        last_appointment_at = new.starts_at
      where id = new.client_id;
    elsif new.status in ('CANCELADA_CLIENTA') then
      update clients set total_cancellations = total_cancellations + 1 where id = new.client_id;
    elsif new.status = 'NO_SHOW' then
      update clients set total_no_shows = total_no_shows + 1 where id = new.client_id;
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.tg_touch_updated()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin new.updated_at := now(); return new; end $function$
;

CREATE OR REPLACE FUNCTION public.validar_turno()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if tg_op = 'UPDATE' and new.starts_at = old.starts_at then return new; end if;
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'anon')
       <> 'authenticated'
     and not es_turno_valido(new.business_id, new.starts_at) then
    raise exception 'HORARIO_NO_DISPONIBLE';
  end if;
  return new;
end $function$
;


-- ======================================================================
-- 7. Vistas
-- ======================================================================

create or replace view public.v_agenda with (security_invoker=true) as
 SELECT a.id,
    a.business_id,
    a.code,
    a.starts_at,
    a.ends_at,
    a.blocked_until,
    a.status,
    a.source,
    a.total_amount,
    a.currency,
    a.deposit_amount,
    a.balance_due,
    a.total_duration_minutes,
    a.client_note,
    a.internal_note,
    c.full_name AS cliente_nombre,
    c.phone AS cliente_telefono,
    c.id AS client_id,
    ( SELECT string_agg(i.service_name_snapshot, ' + '::text ORDER BY i.sort_order) AS string_agg
           FROM appointment_items i
          WHERE i.appointment_id = a.id) AS servicios
   FROM appointments a
     JOIN clients c ON c.id = a.client_id;

create or replace view public.v_clientas_publica with (security_invoker=true) as
 SELECT id,
    business_id,
    profile_id,
    full_name,
    phone,
    email,
    instagram,
    photo_consent,
    total_appointments,
    total_no_shows,
    total_cancellations,
    total_spent_cup,
    is_blocked,
    first_seen_at,
    last_appointment_at
   FROM clients;

create or replace view public.v_estadisticas_mes with (security_invoker=true) as
 SELECT b.id AS business_id,
    date_trunc('month'::text, (a.starts_at AT TIME ZONE b.timezone))::date AS mes,
    count(*) FILTER (WHERE a.status = 'COMPLETADA'::estado_cita) AS citas_completadas,
    count(*) FILTER (WHERE a.status = ANY (ARRAY['CANCELADA_CLIENTA'::estado_cita, 'CANCELADA_NEGOCIO'::estado_cita])) AS cancelaciones,
    count(*) FILTER (WHERE a.status = 'NO_SHOW'::estado_cita) AS no_shows,
    COALESCE(sum(a.total_amount) FILTER (WHERE a.status = 'COMPLETADA'::estado_cita), 0::numeric) AS ingreso_bruto
   FROM businesses b
     JOIN appointments a ON a.business_id = b.id
  GROUP BY b.id, (date_trunc('month'::text, (a.starts_at AT TIME ZONE b.timezone))::date);


-- ======================================================================
-- 8. Triggers
-- ======================================================================

CREATE TRIGGER t_ap_upd BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION tg_touch_updated();

CREATE TRIGGER t_bus_upd BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION tg_touch_updated();

CREATE TRIGGER t_cli_upd BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION tg_touch_updated();

CREATE TRIGGER t_contadores AFTER UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION tg_contadores_clienta();

CREATE TRIGGER t_srv_upd BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION tg_touch_updated();

CREATE TRIGGER tg_appointments_turno BEFORE INSERT OR UPDATE OF starts_at ON public.appointments FOR EACH ROW EXECUTE FUNCTION validar_turno();

CREATE TRIGGER tg_holds_turno BEFORE INSERT ON public.holds FOR EACH ROW EXECUTE FUNCTION validar_turno();


-- ======================================================================
-- 9. Row Level Security
-- ======================================================================

alter table public.appointment_item_addons enable row level security;

alter table public.appointment_items enable row level security;

alter table public.appointments enable row level security;

alter table public.audit_log enable row level security;

alter table public.blocks enable row level security;

alter table public.businesses enable row level security;

alter table public.clients enable row level security;

alter table public.exchange_rates enable row level security;

alter table public.expenses enable row level security;

alter table public.favorites enable row level security;

alter table public.gallery_photos enable row level security;

alter table public.holds enable row level security;

alter table public.notifications enable row level security;

alter table public.payments enable row level security;

alter table public.photo_tags enable row level security;

alter table public.profiles enable row level security;

alter table public.reviews enable row level security;

alter table public.schedule_exceptions enable row level security;

alter table public.schedule_rules enable row level security;

alter table public.service_addons enable row level security;

alter table public.services enable row level security;

alter table public.settings enable row level security;

alter table public.tags enable row level security;

alter table public.waitlist enable row level security;


-- ======================================================================
-- 10. Políticas RLS (incluye storage.objects del bucket galeria)
-- ======================================================================

create policy prof_item_addons on public.appointment_item_addons as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM (appointment_items i
     JOIN appointments a ON ((a.id = i.appointment_id)))
  WHERE ((i.id = appointment_item_addons.appointment_item_id) AND es_profesional(a.business_id)))));

create policy cli_sus_items on public.appointment_items as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM appointments a
  WHERE ((a.id = appointment_items.appointment_id) AND (a.client_id = mi_client_id(a.business_id))))));

create policy prof_items on public.appointment_items as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM appointments a
  WHERE ((a.id = appointment_items.appointment_id) AND es_profesional(a.business_id)))));

create policy cli_sus_citas on public.appointments as PERMISSIVE for SELECT to public using ((client_id = mi_client_id(business_id)));

create policy prof_citas on public.appointments as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy prof_audit on public.audit_log as PERMISSIVE for SELECT to public using (es_profesional(business_id));

create policy prof_bloqueos on public.blocks as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy prof_negocio on public.businesses as PERMISSIVE for ALL to public using (es_profesional(id));

create policy pub_negocio on public.businesses as PERMISSIVE for SELECT to public using (true);

create policy cli_su_ficha on public.clients as PERMISSIVE for SELECT to public using ((profile_id = auth.uid()));

create policy prof_clientas on public.clients as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy prof_tasas on public.exchange_rates as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy prof_gastos on public.expenses as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy cli_sus_favoritos on public.favorites as PERMISSIVE for ALL to public using ((client_id = mi_client_id(business_id)));

create policy prof_fotos on public.gallery_photos as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy pub_fotos on public.gallery_photos as PERMISSIVE for SELECT to public using (is_published);

create policy prof_holds on public.holds as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy prof_notif on public.notifications as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy prof_pagos on public.payments as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy pub_photo_tags on public.photo_tags as PERMISSIVE for SELECT to public using (true);

create policy prof_perfiles on public.profiles as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy prof_resenas on public.reviews as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy prof_excep on public.schedule_exceptions as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy pub_excepciones on public.schedule_exceptions as PERMISSIVE for SELECT to public using (true);

create policy prof_reglas on public.schedule_rules as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy pub_horarios on public.schedule_rules as PERMISSIVE for SELECT to public using (is_active);

create policy prof_addons on public.service_addons as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy profesional_actualiza_complementos on public.service_addons as PERMISSIVE for UPDATE to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'PROFESIONAL'::rol_usuario) AND (p.business_id = service_addons.business_id)))));

create policy profesional_crea_complementos on public.service_addons as PERMISSIVE for INSERT to public with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'PROFESIONAL'::rol_usuario) AND (p.business_id = service_addons.business_id)))));

create policy pub_addons on public.service_addons as PERMISSIVE for SELECT to public using (is_active);

create policy prof_servicios on public.services as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy pub_servicios on public.services as PERMISSIVE for SELECT to public using (is_active);

create policy prof_settings on public.settings as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy prof_tags on public.tags as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy pub_tags on public.tags as PERMISSIVE for SELECT to public using (true);

create policy prof_espera on public.waitlist as PERMISSIVE for ALL to public using (es_profesional(business_id));

create policy "Lectura publica galeria" on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'galeria'::text));

create policy "PROFESIONAL borra fotos" on storage.objects as PERMISSIVE for DELETE to public using (((bucket_id = 'galeria'::text) AND (auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'PROFESIONAL'::rol_usuario))))));

create policy "PROFESIONAL sube fotos" on storage.objects as PERMISSIVE for INSERT to public with check (((bucket_id = 'galeria'::text) AND (auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'PROFESIONAL'::rol_usuario))))));
