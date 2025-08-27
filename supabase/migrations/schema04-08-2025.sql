-- =============================================
-- MIGRACIÓN COMPLETA DE BASE DE DATOS
-- Sistema de Carreras/Maratón y Tickets
-- =============================================

-- 1. CREAR ESQUEMAS
-- =============================================
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS realtime;
CREATE SCHEMA IF NOT EXISTS vault;

-- 2. CREAR EXTENSIONES
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 3. CREAR TIPOS PERSONALIZADOS
-- =============================================
CREATE TYPE auth.aal_level AS ENUM ('aal1', 'aal2', 'aal3');
CREATE TYPE auth.code_challenge_method AS ENUM ('s256', 'plain');
CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone');
CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);

-- 4. CREAR SECUENCIAS
-- =============================================
CREATE SEQUENCE IF NOT EXISTS public.group_sequence START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.order_sequence START WITH 1 INCREMENT BY 1;

-- 5. TABLAS DEL ESQUEMA AUTH (SUPABASE)
-- =============================================
CREATE TABLE IF NOT EXISTS auth.users (
    instance_id uuid,
    id uuid NOT NULL PRIMARY KEY,
    aud varchar(255),
    role varchar(255),
    email varchar(255),
    encrypted_password varchar(255),
    email_confirmed_at timestamptz,
    invited_at timestamptz,
    confirmation_token varchar(255),
    confirmation_sent_at timestamptz,
    recovery_token varchar(255),
    recovery_sent_at timestamptz,
    email_change_token_new varchar(255),
    email_change varchar(255),
    email_change_sent_at timestamptz,
    last_sign_in_at timestamptz,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamptz,
    updated_at timestamptz,
    phone text,
    phone_confirmed_at timestamptz,
    phone_change text DEFAULT '',
    phone_change_token varchar(255) DEFAULT '',
    phone_change_sent_at timestamptz,
    confirmed_at timestamptz GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current varchar(255) DEFAULT '',
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamptz,
    reauthentication_token varchar(255) DEFAULT '',
    reauthentication_sent_at timestamptz,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamptz,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK ((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2))
);

-- 6. TABLAS PRINCIPALES - USUARIOS Y PERMISOS
-- =============================================
CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role text DEFAULT 'usuario' NOT NULL,
    full_name text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT users_role_check CHECK (role IN ('admin', 'tienda', 'usuario', 'administracion', 'boss'))
);

CREATE TABLE IF NOT EXISTS public.roles (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    display_name text NOT NULL,
    description text,
    is_system boolean DEFAULT false,
    is_active boolean DEFAULT true,
    priority integer DEFAULT 0,
    parent_role_id uuid REFERENCES public.roles(id),
    is_assignable boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    resource text NOT NULL,
    action text NOT NULL,
    description text,
    scope text DEFAULT 'global',
    requires_approval boolean DEFAULT false,
    is_system boolean DEFAULT false,
    parent_permission_id uuid REFERENCES public.permissions(id),
    conditions jsonb,
    group_id uuid,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT permissions_scope_check CHECK (scope IN ('global', 'own', 'department', 'custom')),
    CONSTRAINT permissions_unique_resource_action UNIQUE (resource, action)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES public.roles(id),
    assigned_by uuid REFERENCES public.users(id),
    created_at timestamptz DEFAULT now(),
    CONSTRAINT user_roles_unique UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT role_permissions_unique UNIQUE (role_id, permission_id)
);

-- 7. TABLAS DE CONFIGURACIÓN Y CATÁLOGOS
-- =============================================
CREATE TABLE IF NOT EXISTS public.banks (
    code text PRIMARY KEY,
    name text NOT NULL,
    short_name text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    rate numeric(10,4) NOT NULL,
    source text DEFAULT 'BCV' NOT NULL,
    date date NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gateway_config (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    config_key text NOT NULL UNIQUE,
    config_value text NOT NULL,
    description text,
    is_encrypted boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_methods_configuration (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    role_name text NOT NULL,
    payment_method text NOT NULL,
    display_name text NOT NULL,
    requires_proof boolean DEFAULT true,
    auto_confirm boolean DEFAULT false,
    requires_reference boolean DEFAULT true,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT unique_role_method UNIQUE (role_name, payment_method)
);

-- 8. TABLAS DE INVENTARIO (CARRERAS)
-- =============================================
CREATE TABLE IF NOT EXISTS public.inventory (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    shirt_size text NOT NULL,
    gender text NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    reserved integer DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT inventory_shirt_size_gender_key UNIQUE (shirt_size, gender),
    CONSTRAINT inventory_check CHECK (reserved <= stock),
    CONSTRAINT inventory_gender_check CHECK (gender IN ('M', 'F')),
    CONSTRAINT inventory_reserved_check CHECK (reserved >= 0),
    CONSTRAINT inventory_shirt_size_check CHECK (shirt_size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
    CONSTRAINT inventory_stock_check CHECK (stock >= 0)
);

CREATE TABLE IF NOT EXISTS public.runner_numbers (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    current_number integer DEFAULT 10 NOT NULL,
    max_number integer DEFAULT 2000 NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 9. TABLAS DE REGISTRO DE CARRERAS
-- =============================================
CREATE TABLE IF NOT EXISTS public.registration_groups (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    group_code text DEFAULT ('GRP-' || lpad((nextval('public.group_sequence'::regclass))::text, 8, '0')) NOT NULL UNIQUE,
    registrant_email text NOT NULL,
    registrant_phone text NOT NULL,
    total_runners integer NOT NULL,
    payment_status text DEFAULT 'pendiente' NOT NULL,
    payment_method text NOT NULL,
    payment_reference text,
    payment_proof_url text,
    payment_confirmed_at timestamptz,
    payment_confirmed_by uuid REFERENCES public.users(id),
    reserved_until timestamptz,
    payment_date timestamptz,
    payment_transaction_id uuid,
    rejection_reason text,
    last_payment_attempt timestamptz,
    order_code text DEFAULT ('ORD-' || lpad((nextval('public.order_sequence'::regclass))::text, 8, '0')) UNIQUE,
    qr_ticket_data jsonb,
    emails_sent jsonb DEFAULT '[]'::jsonb,
    registrant_identification_type text,
    registrant_identification text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT registration_groups_payment_method_check CHECK (payment_method IN (
        'tienda', 'zelle', 'transferencia_nacional', 'transferencia_internacional',
        'paypal', 'pago_movil_p2c', 'tarjeta_debito', 'tarjeta_credito',
        'efectivo_bs', 'efectivo_usd', 'transferencia_nacional_tienda',
        'transferencia_internacional_tienda', 'zelle_tienda', 'paypal_tienda',
        'obsequio_exonerado'
    )),
    CONSTRAINT registration_groups_payment_status_check CHECK (payment_status IN ('pendiente', 'confirmado', 'rechazado', 'procesando')),
    CONSTRAINT registration_groups_total_runners_check CHECK (total_runners >= 1 AND total_runners <= 5)
);

CREATE TABLE IF NOT EXISTS public.runners (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    group_id uuid NOT NULL REFERENCES public.registration_groups(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    identification_type text NOT NULL,
    identification text NOT NULL,
    birth_date date NOT NULL,
    gender text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    shirt_size text NOT NULL,
    profile_photo_url text,
    runner_number text UNIQUE,
    payment_status text NOT NULL,
    payment_method text,
    payment_confirmed_at timestamptz,
    registered_by uuid REFERENCES public.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT runners_gender_check CHECK (gender IN ('M', 'F')),
    CONSTRAINT runners_identification_type_check CHECK (identification_type IN ('V', 'E', 'J', 'P')),
    CONSTRAINT runners_identification_type_identification_key UNIQUE (identification_type, identification)
);

CREATE TABLE IF NOT EXISTS public.inventory_reservations (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    group_id uuid NOT NULL REFERENCES public.registration_groups(id) ON DELETE CASCADE,
    shirt_size text NOT NULL,
    gender text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    reserved_until timestamptz DEFAULT (now() + '72:00:00'::interval) NOT NULL,
    status text DEFAULT 'active' NOT NULL,
    runner_id uuid REFERENCES public.runners(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT inventory_reservations_quantity_check CHECK (quantity > 0),
    CONSTRAINT inventory_reservations_status_check CHECK (status IN ('active', 'confirmed', 'released')),
    FOREIGN KEY (shirt_size, gender) REFERENCES public.inventory(shirt_size, gender)
);

-- 10. TABLAS DE TICKETS DE CONCIERTO
-- =============================================
CREATE TABLE IF NOT EXISTS public.ticket_inventory (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    total_tickets integer DEFAULT 5000 NOT NULL,
    sold_tickets integer DEFAULT 0 NOT NULL,
    reserved_tickets integer DEFAULT 0 NOT NULL,
    available_tickets integer GENERATED ALWAYS AS ((total_tickets - sold_tickets) - reserved_tickets) STORED,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT ticket_inventory_check CHECK ((sold_tickets + reserved_tickets) <= total_tickets),
    CONSTRAINT ticket_inventory_reserved_tickets_check CHECK (reserved_tickets >= 0),
    CONSTRAINT ticket_inventory_sold_tickets_check CHECK (sold_tickets >= 0)
);

CREATE TABLE IF NOT EXISTS public.concert_tickets (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    ticket_number text NOT NULL UNIQUE,
    qr_code text NOT NULL UNIQUE,
    barcode text NOT NULL UNIQUE,
    buyer_name text NOT NULL,
    buyer_email text NOT NULL,
    buyer_phone text NOT NULL,
    buyer_identification text NOT NULL,
    ticket_price numeric(10,2) DEFAULT 15.00 NOT NULL,
    payment_status text DEFAULT 'pendiente' NOT NULL,
    payment_method text NOT NULL,
    payment_reference text,
    ticket_status text DEFAULT 'vendido' NOT NULL,
    sold_by uuid REFERENCES public.users(id),
    confirmed_by uuid REFERENCES public.users(id),
    confirmed_at timestamptz,
    redeemed_at timestamptz,
    redeemed_by uuid REFERENCES public.users(id),
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT concert_tickets_payment_method_check CHECK (payment_method IN ('tienda', 'zelle', 'transferencia', 'tarjeta', 'pago_movil')),
    CONSTRAINT concert_tickets_payment_status_check CHECK (payment_status IN ('pendiente', 'confirmado', 'rechazado')),
    CONSTRAINT concert_tickets_ticket_status_check CHECK (ticket_status IN ('vendido', 'canjeado', 'cancelado'))
);

-- 11. TABLAS DE TRANSACCIONES Y PAGOS
-- =============================================
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    group_id uuid REFERENCES public.registration_groups(id) ON DELETE CASCADE,
    control text UNIQUE,
    invoice text UNIQUE,
    amount_usd numeric(10,2) NOT NULL,
    amount_bs numeric(15,2),
    exchange_rate numeric(10,4),
    status text DEFAULT 'pending' NOT NULL,
    gateway_response jsonb,
    auth_id text,
    reference text,
    voucher jsonb,
    payment_method text,
    client_phone text,
    client_bank_code text,
    commerce_phone text,
    commerce_bank_code text,
    terminal text,
    lote text,
    seqnum text,
    metadata jsonb,
    client_identification varchar(20),
    is_pre_registration boolean DEFAULT false,
    megasoft_control text,
    megasoft_authid text,
    megasoft_terminal text,
    megasoft_lote text,
    megasoft_seqnum text,
    megasoft_voucher text,
    invoice_number text,
    processed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT payment_transactions_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'failed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.ticket_payment_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    ticket_ids uuid[] NOT NULL,
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
    status text DEFAULT 'pending' NOT NULL,
    gateway_response jsonb,
    voucher jsonb,
    megasoft_control text,
    megasoft_authid text,
    megasoft_terminal text,
    megasoft_lote text,
    megasoft_seqnum text,
    megasoft_voucher text,
    completed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT ticket_payment_transactions_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'failed', 'expired'))
);

CREATE TABLE IF NOT EXISTS public.ticket_payments (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    ticket_id uuid NOT NULL REFERENCES public.concert_tickets(id) ON DELETE CASCADE,
    amount numeric(10,2) DEFAULT 15.00 NOT NULL,
    payment_method text NOT NULL,
    payment_reference text,
    status text DEFAULT 'pendiente' NOT NULL,
    confirmed_by uuid REFERENCES public.users(id),
    confirmed_at timestamptz,
    notes text,
    receipt_sent boolean DEFAULT false,
    amount_bs numeric,
    amount_usd numeric,
    exchange_rate numeric,
    gateway_response jsonb,
    payment_phone text,
    payment_bank_code text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT ticket_payments_payment_method_check CHECK (payment_method IN ('tienda', 'zelle', 'transferencia', 'tarjeta', 'pago_movil')),
    CONSTRAINT ticket_payments_status_check CHECK (status IN ('pendiente', 'confirmado', 'rechazado'))
);

CREATE TABLE IF NOT EXISTS public.payment_errors (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    group_id uuid REFERENCES public.registration_groups(id),
    transaction_id uuid REFERENCES public.payment_transactions(id),
    error_code text,
    error_message text,
    error_details jsonb,
    gateway_response text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id uuid REFERENCES public.registration_groups(id),
    transaction_id uuid REFERENCES public.payment_transactions(id),
    event_type text NOT NULL,
    event_data jsonb,
    created_at timestamptz DEFAULT now()
);

-- 12. TABLAS DE IFRAME Y TOKENS
-- =============================================
CREATE TABLE IF NOT EXISTS public.iframe_tokens (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    token varchar(255) NOT NULL UNIQUE,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    origin varchar(255),
    expires_at timestamptz NOT NULL,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    token_type varchar(20) DEFAULT 'seller_token',
    max_transactions integer,
    transactions_count integer DEFAULT 0,
    allowed_domains text[],
    commission_rate numeric(5,2) DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.iframe_token_usage (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    token_id uuid NOT NULL REFERENCES public.iframe_tokens(id) ON DELETE CASCADE,
    action varchar(100) NOT NULL,
    ip_address inet,
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- 13. TABLAS AUXILIARES
-- =============================================
CREATE TABLE IF NOT EXISTS public.email_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    group_id uuid REFERENCES public.registration_groups(id),
    email_type text NOT NULL,
    recipient_email text NOT NULL,
    subject text NOT NULL,
    status text DEFAULT 'pending' NOT NULL,
    sent_at timestamptz,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT email_logs_email_type_check CHECK (email_type IN (
        'registration_pending', 'payment_confirmed', 'payment_rejected',
        'reservation_expiring', 'reservation_expired'
    )),
    CONSTRAINT email_logs_status_check CHECK (status IN ('pending', 'sent', 'failed'))
);

CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    endpoint text,
    method text,
    headers jsonb,
    payload jsonb,
    response jsonb,
    status_code integer,
    ip_address inet,
    created_at timestamptz DEFAULT now()
);

-- 14. FUNCIONES PRINCIPALES
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.calculate_age(p_birth_date date)
RETURNS integer AS $$
    SELECT EXTRACT(YEAR FROM age(CURRENT_DATE, p_birth_date))::integer;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS text AS $$
DECLARE
    ticket_num text;
    exists_check boolean;
BEGIN
    LOOP
        ticket_num := 'TICKET-' || LPAD((FLOOR(RANDOM() * 999999) + 1)::text, 6, '0');
        SELECT EXISTS(SELECT 1 FROM concert_tickets WHERE ticket_number = ticket_num) INTO exists_check;
        IF NOT exists_check THEN
            EXIT;
        END IF;
    END LOOP;
    RETURN ticket_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.generate_qr_code()
RETURNS text AS $$
DECLARE
    qr_code text;
    exists_check boolean;
BEGIN
    LOOP
        qr_code := 'QR-' || UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 12));
        SELECT EXISTS(SELECT 1 FROM concert_tickets WHERE qr_code = qr_code) INTO exists_check;
        IF NOT exists_check THEN
            EXIT;
        END IF;
    END LOOP;
    RETURN qr_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.generate_barcode()
RETURNS text AS $$
DECLARE
    barcode text;
    exists_check boolean;
BEGIN
    LOOP
        barcode := LPAD((FLOOR(RANDOM() * 9999999999999) + 1000000000000)::text, 13, '0');
        SELECT EXISTS(SELECT 1 FROM concert_tickets WHERE barcode = barcode) INTO exists_check;
        IF NOT exists_check THEN
            EXIT;
        END IF;
    END LOOP;
    RETURN barcode;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_next_runner_number()
RETURNS text AS $$
DECLARE
    next_num integer;
    max_num integer;
BEGIN
    SELECT rn.max_number INTO max_num FROM runner_numbers rn LIMIT 1;

    UPDATE runner_numbers
    SET current_number = current_number + 1
    WHERE current_number < max_num
    RETURNING current_number INTO next_num;

    IF NOT FOUND OR next_num IS NULL THEN
        RAISE EXCEPTION 'No hay números de corredor disponibles';
    END IF;

    RETURN LPAD(next_num::text, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. TRIGGERS
-- =============================================
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_banks_updated_at BEFORE UPDATE ON public.banks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_exchange_rates_updated_at BEFORE UPDATE ON public.exchange_rates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gateway_config_updated_at BEFORE UPDATE ON public.gateway_config
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_reservations_updated_at BEFORE UPDATE ON public.inventory_reservations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_registration_groups_updated_at BEFORE UPDATE ON public.registration_groups
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_runners_updated_at BEFORE UPDATE ON public.runners
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_runner_numbers_updated_at BEFORE UPDATE ON public.runner_numbers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON public.payment_transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_concert_tickets_updated_at BEFORE UPDATE ON public.concert_tickets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ticket_inventory_updated_at BEFORE UPDATE ON public.ticket_inventory
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ticket_payments_updated_at BEFORE UPDATE ON public.ticket_payments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 16. ÍNDICES PRINCIPALES
-- =============================================
-- Índices para usuarios y permisos
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON public.user_roles(role_id);
CREATE INDEX idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON public.role_permissions(permission_id);
CREATE INDEX idx_permissions_resource_action ON public.permissions(resource, action);

-- Índices para inventario
CREATE INDEX idx_inventory_size_gender ON public.inventory(shirt_size, gender);
CREATE INDEX idx_inventory_reservations_status_time ON public.inventory_reservations(status, reserved_until);

-- Índices para registros y runners
CREATE INDEX idx_runners_group_id ON public.runners(group_id);
CREATE INDEX idx_runners_payment_status ON public.runners(payment_status);
CREATE INDEX idx_runners_identification ON public.runners(identification_type, identification);

CREATE INDEX idx_registration_groups_payment_status ON public.registration_groups(payment_status);
CREATE INDEX idx_registration_groups_reserved_until ON public.registration_groups(reserved_until);

CREATE INDEX idx_concert_tickets_ticket_number ON public.concert_tickets(ticket_number);
CREATE INDEX idx_concert_tickets_qr_code ON public.concert_tickets(qr_code);
CREATE INDEX idx_concert_tickets_barcode ON public.concert_tickets(barcode);
CREATE INDEX idx_concert_tickets_buyer_email ON public.concert_tickets(buyer_email);
CREATE INDEX idx_concert_tickets_payment_status ON public.concert_tickets(payment_status);
CREATE INDEX idx_concert_tickets_ticket_status ON public.concert_tickets(ticket_status);

CREATE INDEX idx_payment_transactions_group_id ON public.payment_transactions(group_id);
CREATE INDEX idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX idx_payment_transactions_payment_method ON public.payment_transactions(payment_method);
CREATE INDEX idx_payment_transactions_megasoft_control ON public.payment_transactions(megasoft_control) 
WHERE megasoft_control IS NOT NULL;

CREATE INDEX idx_exchange_rates_date ON public.exchange_rates(date DESC);

CREATE INDEX idx_email_logs_group_id ON public.email_logs(group_id);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);

CREATE INDEX idx_iframe_tokens_token ON public.iframe_tokens(token) WHERE is_active = true;
CREATE INDEX idx_iframe_tokens_user_id ON public.iframe_tokens(user_id);
CREATE INDEX idx_iframe_tokens_expires_at ON public.iframe_tokens(expires_at);
CREATE INDEX idx_iframe_token_usage_token_id ON public.iframe_token_usage(token_id);


-- 17. ROW LEVEL SECURITY (RLS)
-- ============================================= 
-- Habilitar RLS en las tablas principales
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concert_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iframe_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iframe_token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad básicas
-- Usuarios pueden ver su propia información
CREATE POLICY "Users can view and manage their own data" ON public.users
    FOR ALL USING (auth.uid() = id);

-- Administradores pueden ver todos los usuarios
CREATE POLICY "Admin can view all users" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- Políticas para bancos (público puede leer)
CREATE POLICY "Public can read banks" ON public.banks
    FOR SELECT USING (true);

CREATE POLICY "Admin can manage banks" ON public.banks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Políticas para tasas de cambio (público puede leer)
CREATE POLICY "Public can read exchange rates" ON public.exchange_rates
    FOR SELECT USING (true);

CREATE POLICY "Admin can manage exchange rates" ON public.exchange_rates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Políticas para inventario (público puede leer)
CREATE POLICY "Public can read inventory status" ON public.inventory
    FOR SELECT USING (true);

CREATE POLICY "Admin can manage inventory" ON public.inventory
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Políticas para grupos de registro
CREATE POLICY "Authenticated users can view groups and runners" ON public.registration_groups
    FOR SELECT USING (true);

CREATE POLICY "Admin/Tienda can create registration groups" ON public.registration_groups
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('admin', 'tienda')
        )
    );

CREATE POLICY "Admin can update any group" ON public.registration_groups
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Políticas para corredores
CREATE POLICY "Authenticated users can view groups and runners" ON public.runners
    FOR SELECT USING (true);

CREATE POLICY "Admin can manage all runners" ON public.runners
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Políticas para tickets de concierto
CREATE POLICY "Authenticated users can read tickets" ON public.concert_tickets
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and tienda can insert tickets" ON public.concert_tickets
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('admin', 'tienda')
        )
    );

CREATE POLICY "Admin can update all tickets" ON public.concert_tickets
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Tienda can update own sales" ON public.concert_tickets
    FOR UPDATE USING (
        sold_by = auth.uid() AND 
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'tienda'
        )
    );

-- 18. DATOS INICIALES
-- =============================================
-- Insertar configuración inicial
INSERT INTO public.gateway_config (config_key, config_value, description) VALUES
('reservation_hours', '72', 'Horas de reserva para grupos de registro'),
('max_runners_per_group', '5', 'Máximo de corredores por grupo'),
('ticket_price_usd', '35', 'Precio del ticket en USD');

-- Insertar números de corredor iniciales
INSERT INTO public.runner_numbers (current_number, max_number) VALUES (10, 2000);

-- Insertar inventario inicial de tickets
INSERT INTO public.ticket_inventory (total_tickets, sold_tickets, reserved_tickets) VALUES (5000, 0, 0);

-- Insertar roles básicos del sistema
INSERT INTO public.roles (name, display_name, description, is_system, priority) VALUES
('admin', 'Administrador', 'Acceso completo al sistema', true, 100),
('tienda', 'Tienda', 'Acceso para puntos de venta', true, 50),
('usuario', 'Usuario', 'Usuario estándar', true, 10),
('administracion', 'Administración', 'Acceso administrativo', true, 70),
('boss', 'Boss', 'Acceso de supervisor', true, 90);

-- Insertar algunos bancos comunes
INSERT INTO public.banks (code, name, short_name) VALUES
('0102', 'Banco de Venezuela', 'BDV'),
('0134', 'Banesco', 'Banesco'),
('0191', 'Banco Nacional de Crédito', 'BNC'),
('0115', 'Banco Exterior', 'Exterior'),
('0151', 'Banco Fondo Común', 'BFC');

-- Insertar configuración de métodos de pago
INSERT INTO public.payment_methods_configuration 
(role_name, payment_method, display_name, requires_proof, auto_confirm, requires_reference, display_order) VALUES
('admin', 'obsequio_exonerado', 'Obsequio/Exonerado', false, true, false, 1),
('admin', 'tienda', 'Tienda', false, true, false, 2),
('admin', 'pago_movil_p2c', 'Pago Móvil P2C', true, false, true, 3),
('admin', 'zelle', 'Zelle', true, false, true, 4),
('admin', 'transferencia_nacional', 'Transferencia Nacional', true, false, true, 5),
('tienda', 'tienda', 'Tienda', false, true, false, 1),
('tienda', 'pago_movil_p2c', 'Pago Móvil P2C', true, false, true, 2),
('usuario', 'pago_movil_p2c', 'Pago Móvil P2C', true, false, true, 1),
('usuario', 'zelle', 'Zelle', true, false, true, 2),
('usuario', 'transferencia_nacional', 'Transferencia Nacional', true, false, true, 3);

-- 19. VISTAS
-- =============================================
-- Vista de resumen de grupos de corredores
CREATE OR REPLACE VIEW public.runner_group_summary AS
SELECT 
    rg.id AS group_id,
    rg.group_code,
    rg.registrant_email,
    rg.total_runners,
    rg.payment_status,
    rg.payment_method,
    rg.payment_reference,
    rg.reserved_until,
    rg.created_at,
    COUNT(r.id) AS registered_runners,
    STRING_AGG(r.full_name, ', ' ORDER BY r.created_at) AS runner_names,
    JSONB_AGG(
        JSONB_BUILD_OBJECT(
            'id', r.id,
            'name', r.full_name,
            'identification', r.identification_type || '-' || r.identification,
            'birth_date', r.birth_date,
            'age', public.calculate_age(r.birth_date),
            'gender', r.gender,
            'shirt_size', r.shirt_size,
            'runner_number', r.runner_number
        ) ORDER BY r.created_at
    ) AS runners_detail
FROM public.registration_groups rg
LEFT JOIN public.runners r ON r.group_id = rg.id
GROUP BY rg.id;

-- Vista de estadísticas diarias
CREATE OR REPLACE VIEW public.daily_statistics AS
SELECT 
    DATE(created_at) AS date,
    COUNT(*) AS total_registrations,
    COUNT(CASE WHEN payment_status = 'confirmado' THEN 1 END) AS confirmed_registrations,
    COUNT(CASE WHEN payment_status IN ('pendiente', 'procesando') THEN 1 END) AS pending_registrations,
    COUNT(CASE WHEN payment_method = 'pago_movil_p2c' THEN 1 END) AS p2c_registrations,
    COUNT(CASE WHEN payment_method = 'tienda' THEN 1 END) AS store_registrations
FROM public.runners
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

-- Vista de estado del inventario
CREATE OR REPLACE VIEW public.inventory_status AS
SELECT 
    shirt_size,
    gender,
    stock,
    reserved,
    (stock - reserved) AS available,
    CASE 
        WHEN (stock - reserved) = 0 THEN 'Agotado'
        WHEN (stock - reserved) <= 10 THEN 'Bajo'
        ELSE 'Disponible'
    END AS status
FROM public.inventory
ORDER BY 
    gender,
    CASE shirt_size
        WHEN 'XS' THEN 1
        WHEN 'S' THEN 2
        WHEN 'M' THEN 3
        WHEN 'L' THEN 4
        WHEN 'XL' THEN 5
        WHEN 'XXL' THEN 6
    END;

-- Vista de auditoría de pagos
CREATE OR REPLACE VIEW public.payment_audit_view AS
SELECT 
    rg.id,
    rg.group_code,
    rg.order_code,
    rg.registrant_email,
    rg.payment_method,
    rg.payment_status,
    rg.payment_reference,
    rg.created_at,
    rg.payment_confirmed_at,
    u.email AS confirmed_by_email,
    u.role AS confirmed_by_role,
    pmc.auto_confirm,
    pmc.requires_proof,
    COUNT(r.id) AS runners_count
FROM public.registration_groups rg
LEFT JOIN public.users u ON rg.payment_confirmed_by = u.id
LEFT JOIN public.runners r ON r.group_id = rg.id
LEFT JOIN public.payment_methods_configuration pmc 
    ON pmc.payment_method = rg.payment_method 
    AND pmc.is_active = true
GROUP BY 
    rg.id, rg.group_code, rg.order_code, rg.registrant_email, 
    rg.payment_method, rg.payment_status, rg.payment_reference, 
    rg.created_at, rg.payment_confirmed_at, u.email, u.role, 
    pmc.auto_confirm, pmc.requires_proof;