-- =============================================
-- MIGRACIÓN PARA SISTEMA DE TICKETS VIP Y ASIENTOS
-- =============================================

-- 1. CREAR TABLA DE CONFIGURACIÓN DE ZONAS
-- =============================================
CREATE TABLE IF NOT EXISTS public.ticket_zones (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    zone_code text NOT NULL UNIQUE,
    zone_name text NOT NULL,
    zone_type text NOT NULL,
    price_usd numeric(10,2) NOT NULL,
    total_capacity integer NOT NULL,
    is_numbered boolean DEFAULT false,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    zone_color text DEFAULT '#4F46E5',
    zone_icon text,
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT ticket_zones_type_check CHECK (zone_type IN ('general', 'vip', 'box'))
);

-- 2. CREAR TABLA DE ASIENTOS VIP/BOX
-- =============================================
CREATE TABLE IF NOT EXISTS public.vip_seats (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    zone_id uuid NOT NULL REFERENCES public.ticket_zones(id) ON DELETE CASCADE,
    seat_number text NOT NULL,
    row_number text,
    column_number integer,
    position_x integer,
    position_y integer,
    status text DEFAULT 'available' NOT NULL,
    is_accessible boolean DEFAULT false,
    seat_type text DEFAULT 'standard',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT vip_seats_unique_number UNIQUE (zone_id, seat_number),
    CONSTRAINT vip_seats_status_check CHECK (status IN ('available', 'reserved', 'sold', 'blocked', 'maintenance')),
    CONSTRAINT vip_seats_type_check CHECK (seat_type IN ('standard', 'premium', 'accessible', 'love_seat'))
);

-- 3. MODIFICAR TABLA DE TICKETS PARA INCLUIR ZONA Y ASIENTO
-- =============================================
ALTER TABLE public.concert_tickets 
ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.ticket_zones(id),
ADD COLUMN IF NOT EXISTS seat_id uuid REFERENCES public.vip_seats(id),
ADD COLUMN IF NOT EXISTS ticket_type text DEFAULT 'general',
ADD COLUMN IF NOT EXISTS is_vip boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS seat_number text,
ADD COLUMN IF NOT EXISTS zone_name text,
ADD CONSTRAINT concert_tickets_type_check CHECK (ticket_type IN ('general', 'vip', 'box'));

-- 4. CREAR TABLA DE RESERVAS TEMPORALES DE ASIENTOS
-- =============================================
CREATE TABLE IF NOT EXISTS public.seat_reservations (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    seat_id uuid NOT NULL REFERENCES public.vip_seats(id) ON DELETE CASCADE,
    session_id text NOT NULL,
    user_id uuid REFERENCES public.users(id),
    buyer_email text,
    buyer_phone text,
    reserved_until timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
    status text DEFAULT 'active' NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT seat_reservations_status_check CHECK (status IN ('active', 'expired', 'confirmed', 'cancelled'))
);

-- 5. CREAR TABLA DE LAYOUTS DE ZONAS VIP/BOX
-- =============================================
CREATE TABLE IF NOT EXISTS public.zone_layouts (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    zone_id uuid NOT NULL REFERENCES public.ticket_zones(id) ON DELETE CASCADE,
    layout_type text DEFAULT 'grid' NOT NULL,
    rows_count integer,
    columns_count integer,
    layout_config jsonb DEFAULT '{}'::jsonb,
    svg_layout text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT zone_layouts_type_check CHECK (layout_type IN ('grid', 'theater', 'custom', 'circular'))
);

-- 6. CREAR TABLA DE PAQUETES/COMBOS VIP
-- =============================================
CREATE TABLE IF NOT EXISTS public.vip_packages (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    package_name text NOT NULL,
    package_code text NOT NULL UNIQUE,
    zone_id uuid REFERENCES public.ticket_zones(id),
    seats_included integer DEFAULT 1 NOT NULL,
    price_usd numeric(10,2) NOT NULL,
    amenities jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    max_available integer,
    sold_count integer DEFAULT 0,
    description text,
    image_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 7. ACTUALIZAR TABLA DE INVENTARIO DE TICKETS
-- =============================================
ALTER TABLE public.ticket_inventory
ADD COLUMN IF NOT EXISTS zone_breakdown jsonb DEFAULT '{}'::jsonb;

-- Crear vista mejorada de inventario por zonas
CREATE OR REPLACE VIEW public.ticket_inventory_by_zone AS
SELECT 
    tz.id AS zone_id,
    tz.zone_code,
    tz.zone_name,
    tz.zone_type,
    tz.price_usd,
    tz.total_capacity,
    COUNT(CASE WHEN vs.status = 'sold' THEN 1 END) AS sold_seats,
    COUNT(CASE WHEN vs.status = 'reserved' THEN 1 END) AS reserved_seats,
    COUNT(CASE WHEN vs.status = 'available' THEN 1 END) AS available_seats,
    tz.total_capacity - COUNT(CASE WHEN vs.status IN ('sold', 'reserved') THEN 1 END) AS remaining_capacity
FROM public.ticket_zones tz
LEFT JOIN public.vip_seats vs ON vs.zone_id = tz.id
WHERE tz.is_active = true
GROUP BY tz.id, tz.zone_code, tz.zone_name, tz.zone_type, tz.price_usd, tz.total_capacity;

-- 8. FUNCIONES PARA MANEJO DE ASIENTOS
-- =============================================
CREATE OR REPLACE FUNCTION public.reserve_vip_seats(
    p_seat_ids uuid[],
    p_session_id text,
    p_user_id uuid DEFAULT NULL,
    p_buyer_email text DEFAULT NULL,
    p_buyer_phone text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_reserved_seats jsonb[];
    v_seat record;
    v_reservation_id uuid;
BEGIN
    -- Verificar disponibilidad de todos los asientos
    FOR v_seat IN 
        SELECT * FROM vip_seats 
        WHERE id = ANY(p_seat_ids) 
        FOR UPDATE
    LOOP
        IF v_seat.status != 'available' THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', format('El asiento %s no está disponible', v_seat.seat_number)
            );
        END IF;
    END LOOP;
    
    -- Actualizar estado de asientos a reservado
    UPDATE vip_seats 
    SET status = 'reserved',
        updated_at = now()
    WHERE id = ANY(p_seat_ids);
    
    -- Crear registros de reserva
    FOR v_seat IN 
        SELECT * FROM vip_seats WHERE id = ANY(p_seat_ids)
    LOOP
        INSERT INTO seat_reservations (
            seat_id, session_id, user_id, buyer_email, buyer_phone
        ) VALUES (
            v_seat.id, p_session_id, p_user_id, p_buyer_email, p_buyer_phone
        ) RETURNING id INTO v_reservation_id;
        
        v_reserved_seats := array_append(v_reserved_seats, 
            jsonb_build_object(
                'reservation_id', v_reservation_id,
                'seat_id', v_seat.id,
                'seat_number', v_seat.seat_number,
                'zone_id', v_seat.zone_id
            )
        );
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'reserved_seats', v_reserved_seats,
        'expires_at', (now() + interval '15 minutes')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.release_expired_seat_reservations()
RETURNS void AS $$
BEGIN
    -- Actualizar reservas expiradas
    UPDATE seat_reservations 
    SET status = 'expired'
    WHERE status = 'active' 
    AND reserved_until < now();
    
    -- Liberar asientos de reservas expiradas
    UPDATE vip_seats 
    SET status = 'available'
    WHERE id IN (
        SELECT seat_id 
        FROM seat_reservations 
        WHERE status = 'expired'
        AND seat_id IN (
            SELECT id FROM vip_seats WHERE status = 'reserved'
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. TRIGGERS
-- =============================================
CREATE TRIGGER update_ticket_zones_updated_at BEFORE UPDATE ON public.ticket_zones
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vip_seats_updated_at BEFORE UPDATE ON public.vip_seats
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seat_reservations_updated_at BEFORE UPDATE ON public.seat_reservations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_zone_layouts_updated_at BEFORE UPDATE ON public.zone_layouts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vip_packages_updated_at BEFORE UPDATE ON public.vip_packages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. ÍNDICES
-- =============================================
CREATE INDEX idx_vip_seats_zone_id ON public.vip_seats(zone_id);
CREATE INDEX idx_vip_seats_status ON public.vip_seats(status);
CREATE INDEX idx_vip_seats_zone_status ON public.vip_seats(zone_id, status);

CREATE INDEX idx_seat_reservations_seat_id ON public.seat_reservations(seat_id);
CREATE INDEX idx_seat_reservations_session_id ON public.seat_reservations(session_id);
CREATE INDEX idx_seat_reservations_status ON public.seat_reservations(status);
CREATE INDEX idx_seat_reservations_reserved_until ON public.seat_reservations(reserved_until) 
    WHERE status = 'active';

CREATE INDEX idx_concert_tickets_zone_id ON public.concert_tickets(zone_id);
CREATE INDEX idx_concert_tickets_seat_id ON public.concert_tickets(seat_id);

-- 11. RLS POLICIES
-- =============================================
ALTER TABLE public.ticket_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zone_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_packages ENABLE ROW LEVEL SECURITY;

-- Políticas públicas de lectura para zonas y asientos
CREATE POLICY "Public can read ticket zones" ON public.ticket_zones
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public can read vip seats" ON public.vip_seats
    FOR SELECT USING (true);

CREATE POLICY "Users can manage own seat reservations" ON public.seat_reservations
    FOR ALL USING (
        session_id = current_setting('app.session_id', true)
        OR user_id = auth.uid()
    );

-- Políticas administrativas
CREATE POLICY "Admin can manage ticket zones" ON public.ticket_zones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('admin', 'boss')
        )
    );

CREATE POLICY "Admin can manage vip seats" ON public.vip_seats
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('admin', 'boss')
        )
    );

-- 12. DATOS INICIALES
-- =============================================
-- Insertar zonas de tickets
INSERT INTO public.ticket_zones (zone_code, zone_name, zone_type, price_usd, total_capacity, is_numbered, display_order) VALUES
('GENERAL', 'Entrada General', 'general', 15.00, 4970, false, 1),
('VIP', 'Zona VIP', 'vip', 50.00, 20, true, 2),
('BOX', 'Palco Premium', 'box', 75.00, 10, true, 3);

-- Insertar layout para zona VIP (20 asientos en 4 filas de 5)
INSERT INTO public.zone_layouts (zone_id, layout_type, rows_count, columns_count, layout_config)
SELECT 
    id, 
    'theater', 
    4, 
    5,
    jsonb_build_object(
        'seatPrefix', 'V',
        'rowLabels', ARRAY['A', 'B', 'C', 'D'],
        'startNumber', 1,
        'spacing', jsonb_build_object('row', 60, 'column', 50)
    )
FROM public.ticket_zones WHERE zone_code = 'VIP';

-- Insertar layout para zona BOX (10 asientos en 2 filas de 5)
INSERT INTO public.zone_layouts (zone_id, layout_type, rows_count, columns_count, layout_config)
SELECT 
    id, 
    'theater', 
    2, 
    5,
    jsonb_build_object(
        'seatPrefix', 'B',
        'rowLabels', ARRAY['A', 'B'],
        'startNumber', 1,
        'spacing', jsonb_build_object('row', 80, 'column', 60),
        'luxurySeating', true
    )
FROM public.ticket_zones WHERE zone_code = 'BOX';

-- Generar asientos VIP
INSERT INTO public.vip_seats (zone_id, seat_number, row_number, column_number, position_x, position_y, seat_type)
SELECT 
    tz.id,
    'V' || r.row_label || lpad(c.col::text, 2, '0'),
    r.row_label,
    c.col,
    50 + (c.col - 1) * 50,
    50 + (r.row_num - 1) * 60,
    'standard'
FROM public.ticket_zones tz
CROSS JOIN (
    SELECT 'A' as row_label, 1 as row_num UNION ALL
    SELECT 'B', 2 UNION ALL
    SELECT 'C', 3 UNION ALL
    SELECT 'D', 4
) r
CROSS JOIN generate_series(1, 5) as c(col)
WHERE tz.zone_code = 'VIP';

-- Generar asientos BOX (más espaciosos)
INSERT INTO public.vip_seats (zone_id, seat_number, row_number, column_number, position_x, position_y, seat_type)
SELECT 
    tz.id,
    'B' || r.row_label || lpad(c.col::text, 2, '0'),
    r.row_label,
    c.col,
    50 + (c.col - 1) * 60,
    50 + (r.row_num - 1) * 80,
    'premium'
FROM public.ticket_zones tz
CROSS JOIN (
    SELECT 'A' as row_label, 1 as row_num UNION ALL
    SELECT 'B', 2
) r
CROSS JOIN generate_series(1, 5) as c(col)
WHERE tz.zone_code = 'BOX';

-- Crear paquetes VIP
INSERT INTO public.vip_packages (package_name, package_code, zone_id, seats_included, price_usd, amenities, description, max_available)
SELECT 
    'Paquete VIP Pareja',
    'VIP_COUPLE',
    id,
    2,
    90.00,
    '["Welcome drink", "Acceso preferencial", "Programa del evento", "Meet & Greet"]'::jsonb,
    'Paquete especial para parejas con asientos contiguos garantizados',
    10
FROM public.ticket_zones WHERE zone_code = 'VIP';

INSERT INTO public.vip_packages (package_name, package_code, zone_id, seats_included, price_usd, amenities, description, max_available)
SELECT 
    'Palco Corporativo',
    'BOX_CORPORATE',
    id,
    5,
    350.00,
    '["Servicio de catering", "Bebidas premium", "Anfitrión dedicado", "Estacionamiento VIP", "Meet & Greet exclusivo"]'::jsonb,
    'Experiencia premium para grupos corporativos',
    2
FROM public.ticket_zones WHERE zone_code = 'BOX';

-- 13. FUNCIÓN PARA CREAR JOB DE LIMPIEZA DE RESERVAS EXPIRADAS
-- =============================================
CREATE OR REPLACE FUNCTION public.schedule_cleanup_expired_reservations()
RETURNS void AS $$
BEGIN
    -- Esta función debe ser ejecutada periódicamente (cada 5 minutos)
    -- En producción, usar pg_cron o un job scheduler externo
    PERFORM public.release_expired_seat_reservations();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario para recordar configurar el job
COMMENT ON FUNCTION public.schedule_cleanup_expired_reservations() IS 
'Ejecutar cada 5 minutos usando pg_cron: 
SELECT cron.schedule(''cleanup-expired-seats'', ''*/5 * * * *'', ''SELECT public.schedule_cleanup_expired_reservations();'');';