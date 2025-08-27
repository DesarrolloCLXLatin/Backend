-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.banks (
  code text NOT NULL,
  name text NOT NULL,
  short_name text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT banks_pkey PRIMARY KEY (code)
);
CREATE TABLE public.concert_tickets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  ticket_number text NOT NULL UNIQUE,
  qr_code text NOT NULL UNIQUE,
  barcode text NOT NULL UNIQUE,
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  buyer_phone text NOT NULL,
  buyer_identification text NOT NULL,
  ticket_price numeric NOT NULL DEFAULT 15.00,
  payment_status text NOT NULL DEFAULT 'pendiente'::text CHECK (payment_status = ANY (ARRAY['pendiente'::text, 'confirmado'::text, 'rechazado'::text])),
  payment_method text NOT NULL CHECK (payment_method = ANY (ARRAY['tienda'::text, 'zelle'::text, 'transferencia'::text, 'tarjeta'::text, 'pago_movil'::text])),
  payment_reference text,
  ticket_status text NOT NULL DEFAULT 'vendido'::text CHECK (ticket_status = ANY (ARRAY['vendido'::text, 'canjeado'::text, 'cancelado'::text])),
  sold_by uuid,
  confirmed_by uuid,
  confirmed_at timestamp with time zone,
  redeemed_at timestamp with time zone,
  redeemed_by uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT concert_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT concert_tickets_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.users(id),
  CONSTRAINT concert_tickets_sold_by_fkey FOREIGN KEY (sold_by) REFERENCES public.users(id),
  CONSTRAINT concert_tickets_redeemed_by_fkey FOREIGN KEY (redeemed_by) REFERENCES public.users(id)
);
CREATE TABLE public.exchange_rates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  rate numeric NOT NULL,
  source text NOT NULL DEFAULT 'BCV'::text,
  date date NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exchange_rates_pkey PRIMARY KEY (id)
);
CREATE TABLE public.gateway_config (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  config_key text NOT NULL UNIQUE,
  config_value text NOT NULL,
  description text,
  is_encrypted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gateway_config_pkey PRIMARY KEY (id)
);
CREATE TABLE public.iframe_token_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL,
  action character varying NOT NULL,
  ip_address inet,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT iframe_token_usage_pkey PRIMARY KEY (id),
  CONSTRAINT iframe_token_usage_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.iframe_tokens(id)
);
CREATE TABLE public.iframe_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  token character varying NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  origin character varying,
  expires_at timestamp with time zone NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  token_type character varying DEFAULT 'seller_token'::character varying,
  max_transactions integer,
  transactions_count integer DEFAULT 0,
  allowed_domains ARRAY,
  commission_rate numeric DEFAULT 0,
  CONSTRAINT iframe_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT iframe_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.inventory (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  shirt_size text NOT NULL CHECK (shirt_size = ANY (ARRAY['XS'::text, 'S'::text, 'M'::text, 'L'::text, 'XL'::text, 'XXL'::text])),
  gender text NOT NULL CHECK (gender = ANY (ARRAY['M'::text, 'F'::text])),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inventory_pkey PRIMARY KEY (id)
);
CREATE TABLE public.inventory_reservations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  shirt_size text NOT NULL,
  gender text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  reserved_until timestamp with time zone NOT NULL DEFAULT (now() + '72:00:00'::interval),
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'confirmed'::text, 'released'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  runner_id uuid,
  CONSTRAINT inventory_reservations_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_reservations_shirt_size_gender_fkey FOREIGN KEY (gender) REFERENCES public.inventory(gender),
  CONSTRAINT inventory_reservations_runner_id_fkey FOREIGN KEY (runner_id) REFERENCES public.runners(id),
  CONSTRAINT inventory_reservations_shirt_size_gender_fkey FOREIGN KEY (shirt_size) REFERENCES public.inventory(gender),
  CONSTRAINT inventory_reservations_shirt_size_gender_fkey FOREIGN KEY (gender) REFERENCES public.inventory(shirt_size),
  CONSTRAINT inventory_reservations_shirt_size_gender_fkey FOREIGN KEY (shirt_size) REFERENCES public.inventory(shirt_size),
  CONSTRAINT inventory_reservations_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.registration_groups(id)
);
CREATE TABLE public.payment_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payment_method text NOT NULL UNIQUE,
  commerce_phone text,
  commerce_bank_code text,
  commerce_bank_name text,
  commerce_rif text,
  config jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_config_pkey PRIMARY KEY (id)
);
CREATE TABLE public.payment_errors (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid,
  transaction_id uuid,
  error_code text,
  error_message text,
  error_details jsonb,
  gateway_response text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_errors_pkey PRIMARY KEY (id),
  CONSTRAINT payment_errors_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.payment_transactions(id),
  CONSTRAINT payment_errors_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.registration_groups(id)
);
CREATE TABLE public.payment_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid,
  transaction_id uuid,
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_events_pkey PRIMARY KEY (id),
  CONSTRAINT payment_events_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.payment_transactions(id),
  CONSTRAINT payment_events_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.registration_groups(id)
);
CREATE TABLE public.payment_transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid,
  control text UNIQUE,
  invoice text UNIQUE,
  amount_usd numeric NOT NULL,
  amount_bs numeric,
  exchange_rate numeric,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'failed'::text, 'cancelled'::text])),
  gateway_response jsonb,
  auth_id text,
  reference text,
  voucher jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone,
  payment_method text,
  client_phone text,
  client_bank_code text,
  commerce_phone text,
  commerce_bank_code text,
  terminal text,
  lote text,
  seqnum text,
  metadata jsonb,
  client_identification character varying,
  is_pre_registration boolean DEFAULT false,
  CONSTRAINT payment_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT payment_transactions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.registration_groups(id)
);
CREATE TABLE public.registration_groups (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_code text NOT NULL DEFAULT ('GRP-'::text || lpad((nextval('group_sequence'::regclass))::text, 8, '0'::text)) UNIQUE,
  registrant_email text NOT NULL,
  registrant_phone text NOT NULL,
  total_runners integer NOT NULL CHECK (total_runners >= 1 AND total_runners <= 5),
  payment_status text NOT NULL DEFAULT 'pendiente'::text CHECK (payment_status = ANY (ARRAY['pendiente'::text, 'confirmado'::text, 'rechazado'::text, 'procesando'::text])),
  payment_method text NOT NULL CHECK (payment_method = ANY (ARRAY['tienda'::text, 'zelle'::text, 'transferencia_nacional'::text, 'transferencia_internacional'::text, 'paypal'::text, 'pago_movil_p2c'::text])),
  payment_reference text,
  payment_proof_url text,
  payment_confirmed_at timestamp with time zone,
  payment_confirmed_by uuid,
  reserved_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  payment_date timestamp with time zone,
  payment_transaction_id uuid,
  rejection_reason text,
  last_payment_attempt timestamp with time zone,
  CONSTRAINT registration_groups_pkey PRIMARY KEY (id),
  CONSTRAINT registration_groups_payment_transaction_id_fkey FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id),
  CONSTRAINT registration_groups_payment_confirmed_by_fkey FOREIGN KEY (payment_confirmed_by) REFERENCES public.users(id)
);
CREATE TABLE public.runner_numbers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  current_number integer NOT NULL DEFAULT 10,
  max_number integer NOT NULL DEFAULT 2000,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT runner_numbers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.runners (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  full_name text NOT NULL,
  identification_type text NOT NULL CHECK (identification_type = ANY (ARRAY['V'::text, 'E'::text, 'J'::text, 'P'::text])),
  identification text NOT NULL,
  birth_date date NOT NULL,
  gender text NOT NULL CHECK (gender = ANY (ARRAY['M'::text, 'F'::text])),
  email text NOT NULL,
  phone text NOT NULL,
  shirt_size text NOT NULL,
  profile_photo_url text,
  runner_number text UNIQUE,
  payment_status text NOT NULL,
  payment_method text,
  payment_confirmed_at timestamp with time zone,
  registered_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT runners_pkey PRIMARY KEY (id),
  CONSTRAINT runners_shirt_size_gender_fkey FOREIGN KEY (gender) REFERENCES public.inventory(gender),
  CONSTRAINT runners_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.registration_groups(id),
  CONSTRAINT runners_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES public.users(id),
  CONSTRAINT runners_shirt_size_gender_fkey FOREIGN KEY (gender) REFERENCES public.inventory(shirt_size),
  CONSTRAINT runners_shirt_size_gender_fkey FOREIGN KEY (shirt_size) REFERENCES public.inventory(shirt_size),
  CONSTRAINT runners_shirt_size_gender_fkey FOREIGN KEY (shirt_size) REFERENCES public.inventory(gender)
);
CREATE TABLE public.ticket_inventory (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  total_tickets integer NOT NULL DEFAULT 5000,
  sold_tickets integer NOT NULL DEFAULT 0 CHECK (sold_tickets >= 0),
  reserved_tickets integer NOT NULL DEFAULT 0 CHECK (reserved_tickets >= 0),
  available_tickets integer DEFAULT ((total_tickets - sold_tickets) - reserved_tickets),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ticket_inventory_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ticket_payment_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ticket_ids ARRAY NOT NULL,
  control_number text NOT NULL,
  invoice_number text UNIQUE,
  amount_usd numeric NOT NULL,
  amount_bs numeric NOT NULL,
  exchange_rate numeric NOT NULL,
  client_phone text NOT NULL,
  client_bank_code text NOT NULL,
  commerce_phone text,
  commerce_bank_code text,
  reference text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'failed'::text, 'expired'::text])),
  gateway_response jsonb,
  voucher jsonb,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT ticket_payment_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT ticket_payment_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.ticket_payments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  ticket_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 15.00,
  payment_method text NOT NULL CHECK (payment_method = ANY (ARRAY['tienda'::text, 'zelle'::text, 'transferencia'::text, 'tarjeta'::text, 'pago_movil'::text])),
  payment_reference text,
  status text NOT NULL DEFAULT 'pendiente'::text CHECK (status = ANY (ARRAY['pendiente'::text, 'confirmado'::text, 'rechazado'::text])),
  confirmed_by uuid,
  confirmed_at timestamp with time zone,
  notes text,
  receipt_sent boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  amount_bs numeric,
  amount_usd numeric,
  exchange_rate numeric,
  gateway_response jsonb,
  payment_phone text,
  payment_bank_code text,
  CONSTRAINT ticket_payments_pkey PRIMARY KEY (id),
  CONSTRAINT ticket_payments_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.users(id),
  CONSTRAINT ticket_payments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.concert_tickets(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'usuario'::text CHECK (role = ANY (ARRAY['admin'::text, 'tienda'::text, 'usuario'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.webhook_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  endpoint text,
  method text,
  headers jsonb,
  payload jsonb,
  response jsonb,
  status_code integer,
  ip_address inet,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT webhook_logs_pkey PRIMARY KEY (id)
);