-- ====================================================================================
-- ESQUEMA UNIFICADO DE REGISTRO DE CORREDORES PARA CARRERA
-- Versión: 1.0
-- Descripción: Combina el registro individual y por grupos con un sistema de
--              inventario por género, reservas temporales (72h), y un detallado
--              módulo de procesamiento de pagos, incluyendo P2C automático.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- SECCIÓN 1: EXTENSIONES Y FUNCIONES DE UTILIDAD
-- ------------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron"; -- Necesario para el job de limpieza

-- Función para actualizar el campo `updated_at` automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language plpgsql;

-- Función para calcular la edad a partir de la fecha de nacimiento
CREATE OR REPLACE FUNCTION calculate_age(p_birth_date date)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT EXTRACT(YEAR FROM age(CURRENT_DATE, p_birth_date))::integer;
$$;

-- Función helper para verificar si un método de pago es de confirmación inmediata
CREATE OR REPLACE FUNCTION is_immediate_payment(p_method text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN p_method IN ('tienda', 'pago_movil_p2c');
END;
$$;


-- ------------------------------------------------------------------------------------
-- SECCIÓN 2: SECUENCIAS Y TABLAS
-- ------------------------------------------------------------------------------------

-- Secuencia para códigos de grupo (ej: GRP-00000001)
CREATE SEQUENCE IF NOT EXISTS group_sequence START 1;

-- Tabla para usuarios del sistema (administradores, personal de tienda)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'usuario' CHECK (role IN ('admin', 'tienda', 'usuario')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla para el catálogo de bancos venezolanos
CREATE TABLE IF NOT EXISTS banks (
  code text PRIMARY KEY,
  name text NOT NULL,
  short_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla para tasas de cambio (diarias, ej: BCV)
CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  rate decimal(10, 4) NOT NULL,
  source text NOT NULL DEFAULT 'BCV',
  date date NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla para la configuración del sistema y la pasarela de pagos
CREATE TABLE IF NOT EXISTS gateway_config (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key text UNIQUE NOT NULL,
  config_value text NOT NULL,
  description text,
  is_encrypted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de inventario de franelas, diferenciado por talla y género
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shirt_size text NOT NULL CHECK (shirt_size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  gender text NOT NULL CHECK (gender IN ('M', 'F')),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shirt_size, gender),
  CHECK (reserved <= stock)
);

-- Tabla para la secuencia de números de corredor (formato '0011' a '2000')
CREATE TABLE IF NOT EXISTS runner_numbers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  current_number integer NOT NULL DEFAULT 10, -- El primer número será 11
  max_number integer NOT NULL DEFAULT 2000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla para los grupos de registro
CREATE TABLE IF NOT EXISTS registration_groups (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_code text UNIQUE NOT NULL DEFAULT ('GRP-' || LPAD(nextval('group_sequence')::text, 8, '0')),
  registrant_email text NOT NULL,
  registrant_phone text NOT NULL,
  total_runners integer NOT NULL CHECK (total_runners >= 1 AND total_runners <= 5),
  payment_status text NOT NULL DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente', 'confirmado', 'rechazado', 'procesando')),
  payment_method text NOT NULL CHECK (payment_method IN ('tienda', 'zelle', 'transferencia_nacional', 'transferencia_internacional', 'paypal', 'pago_movil_p2c')),
  payment_reference text,
  payment_proof_url text,
  payment_confirmed_at timestamptz,
  payment_confirmed_by uuid REFERENCES users(id),
  reserved_until timestamptz, -- Para control de las 72 horas
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de corredores, ahora con fecha de nacimiento, género y asociada a un grupo
CREATE TABLE IF NOT EXISTS runners (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL REFERENCES registration_groups(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  identification_type text NOT NULL CHECK (identification_type IN ('V', 'E', 'J', 'P')),
  identification text NOT NULL,
  birth_date date NOT NULL,
  gender text NOT NULL CHECK (gender IN ('M', 'F')),
  email text NOT NULL,
  phone text NOT NULL,
  shirt_size text NOT NULL,
  profile_photo_url text,
  runner_number text UNIQUE,
  payment_status text NOT NULL,
  payment_method text NOT NULL,
  payment_confirmed_at timestamptz,
  registered_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  FOREIGN KEY (shirt_size, gender) REFERENCES inventory(shirt_size, gender),
  UNIQUE(identification_type, identification)
);

-- Tabla para reservas temporales de inventario (control de 72h)
CREATE TABLE IF NOT EXISTS inventory_reservations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL REFERENCES registration_groups(id) ON DELETE CASCADE,
  shirt_size text NOT NULL,
  gender text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  reserved_until timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'confirmed', 'released')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  FOREIGN KEY (shirt_size, gender) REFERENCES inventory(shirt_size, gender)
);

-- Tabla para transacciones detalladas de la pasarela de pago
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL REFERENCES registration_groups(id) ON DELETE CASCADE,
  control text UNIQUE,
  invoice text UNIQUE,
  amount_usd decimal(10, 2) NOT NULL,
  amount_bs decimal(15, 2),
  exchange_rate decimal(10, 4),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'failed', 'cancelled')),
  gateway_response jsonb,
  auth_id text,
  reference text,
  voucher jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- Log de errores de la pasarela de pago
CREATE TABLE IF NOT EXISTS payment_errors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id uuid REFERENCES registration_groups(id),
  transaction_id uuid REFERENCES payment_transactions(id),
  error_code text,
  error_message text,
  error_details jsonb,
  gateway_response text,
  created_at timestamptz DEFAULT now()
);

-- Log de webhooks recibidos desde la pasarela
CREATE TABLE IF NOT EXISTS webhook_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint text,
  method text,
  headers jsonb,
  payload jsonb,
  response jsonb,
  status_code integer,
  ip_address inet,
  created_at timestamptz DEFAULT now()
);


-- ------------------------------------------------------------------------------------
-- SECCIÓN 3: DATOS INICIALES
-- ------------------------------------------------------------------------------------

-- Inicializar el contador de números de corredor
INSERT INTO runner_numbers (current_number, max_number)
SELECT 10, 2000
WHERE NOT EXISTS (SELECT 1 FROM runner_numbers);

-- Inicializar inventario con stock para ambos géneros
INSERT INTO inventory (shirt_size, gender, stock) VALUES
  ('XS', 'M', 25), ('S', 'M', 50), ('M', 'M', 75), ('L', 'M', 75), ('XL', 'M', 50), ('XXL', 'M', 25),
  ('XS', 'F', 25), ('S', 'F', 50), ('M', 'F', 75), ('L', 'F', 75), ('XL', 'F', 50), ('XXL', 'F', 25)
ON CONFLICT (shirt_size, gender) DO NOTHING;

-- Insertar catálogo de bancos venezolanos
INSERT INTO banks (code, name, short_name) VALUES
  ('0102', 'Banco de Venezuela', 'BDV'), ('0105', 'Banco Mercantil', 'Mercantil'), ('0108', 'Banco Provincial', 'Provincial'),
  ('0134', 'Banesco', 'Banesco'), ('0151', 'BFC Banco Fondo Común', 'BFC'), ('0163', 'Banco del Tesoro', 'Tesoro'),
  ('0172', 'Bancamiga', 'Bancamiga'), ('0174', 'Banplus', 'Banplus'), ('0175', 'Banco Bicentenario', 'Bicentenario'),
  ('0191', 'Banco Nacional de Crédito', 'BNC')
ON CONFLICT (code) DO NOTHING;

-- Insertar configuración esencial del sistema
INSERT INTO gateway_config (config_key, config_value, description) VALUES
  ('gateway_url', 'https://paytest.megasoft.com.ve', 'URL del gateway de pagos'),
  ('cod_afiliacion', '20250325', 'Código de afiliación del comercio'),
  ('race_price_usd', '55.00', 'Precio de la inscripción por corredor en USD'),
  ('max_retry_attempts', '3', 'Máximo de reintentos de pago'),
  ('reservation_hours', '72', 'Horas de validez para una reserva de cupo e inventario')
ON CONFLICT (config_key) DO NOTHING;


-- ------------------------------------------------------------------------------------
-- SECCIÓN 4: FUNCIONES PRINCIPALES (LÓGICA DE NEGOCIO)
-- ------------------------------------------------------------------------------------

-- Obtener el siguiente número de corredor disponible
CREATE OR REPLACE FUNCTION get_next_runner_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
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
$$;

-- Reservar inventario con tiempo límite
CREATE OR REPLACE FUNCTION reserve_inventory_with_timeout(
  p_group_id uuid,
  p_size text,
  p_gender text,
  p_quantity integer DEFAULT 1
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_available integer;
  v_reservation_until timestamptz;
  v_hours integer;
BEGIN
  SELECT config_value::integer INTO v_hours FROM gateway_config WHERE config_key = 'reservation_hours';
  v_reservation_until := now() + (v_hours || ' hours')::interval;

  SELECT (stock - reserved) INTO v_available
  FROM inventory
  WHERE shirt_size = p_size AND gender = p_gender;

  IF v_available >= p_quantity THEN
    UPDATE inventory
    SET reserved = reserved + p_quantity, updated_at = now()
    WHERE shirt_size = p_size AND gender = p_gender;

    INSERT INTO inventory_reservations (group_id, shirt_size, gender, quantity, reserved_until)
    VALUES (p_group_id, p_size, p_gender, p_quantity, v_reservation_until);

    UPDATE registration_groups
    SET reserved_until = v_reservation_until
    WHERE id = p_group_id AND reserved_until IS NULL; -- Solo la primera vez

    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- Liberar reservas de cupos e inventario expiradas (para pg_cron)
CREATE OR REPLACE FUNCTION release_expired_reservations()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reservation RECORD;
BEGIN
  FOR v_reservation IN
    SELECT * FROM inventory_reservations
    WHERE status = 'active' AND reserved_until < now()
  LOOP
    UPDATE inventory
    SET reserved = reserved - v_reservation.quantity, updated_at = now()
    WHERE shirt_size = v_reservation.shirt_size AND gender = v_reservation.gender;

    UPDATE inventory_reservations
    SET status = 'released', updated_at = now()
    WHERE id = v_reservation.id;

    UPDATE registration_groups
    SET payment_status = 'rechazado', reserved_until = NULL, updated_at = now()
    WHERE id = v_reservation.group_id AND payment_status IN ('pendiente', 'procesando');
  END LOOP;
END;
$$;

-- Confirmar el pago de un grupo completo
CREATE OR REPLACE FUNCTION confirm_group_payment(p_group_id uuid, p_confirmed_by uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_runner RECORD;
  v_runner_number text;
BEGIN
  -- 1. Actualizar el estado del grupo
  UPDATE registration_groups
  SET payment_status = 'confirmado',
      payment_confirmed_at = now(),
      payment_confirmed_by = p_confirmed_by,
      reserved_until = NULL,
      updated_at = now()
  WHERE id = p_group_id AND payment_status <> 'confirmado';

  IF NOT FOUND THEN RETURN false; END IF;

  -- 2. Asignar números y confirmar a cada corredor del grupo
  FOR v_runner IN SELECT id, shirt_size, gender FROM runners WHERE group_id = p_group_id ORDER BY created_at
  LOOP
    v_runner_number := get_next_runner_number();

    UPDATE runners
    SET runner_number = v_runner_number,
        payment_status = 'confirmado',
        payment_confirmed_at = now(),
        updated_at = now()
    WHERE id = v_runner.id;
    
    -- 3. Confirmar inventario (convertir reservado en vendido)
    UPDATE inventory
    SET stock = stock - 1,
        reserved = reserved - 1,
        updated_at = now()
    WHERE shirt_size = v_runner.shirt_size
    AND gender = v_runner.gender
    AND reserved > 0;
  END LOOP;

  -- 4. Marcar las reservas de inventario como confirmadas
  UPDATE inventory_reservations
  SET status = 'confirmed', updated_at = now()
  WHERE group_id = p_group_id AND status = 'active';
  
  -- 5. Actualizar la transacción de pago asociada (si existe)
  UPDATE payment_transactions
  SET status = 'approved', processed_at = now(), updated_at = now()
  WHERE group_id = p_group_id AND status = 'pending';

  RETURN true;
END;
$$;

-- Función transaccional para crear un grupo con sus corredores
CREATE OR REPLACE FUNCTION create_registration_group_with_runners(
  p_registrant_email text,
  p_registrant_phone text,
  p_payment_method text,
  p_runners jsonb,
  p_registered_by uuid DEFAULT auth.uid()
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_group_id uuid;
  v_group_code text;
  v_runner jsonb;
  v_total_runners integer;
  v_all_reserved boolean := true;
  v_is_immediate boolean;
  v_birth_date date;
  v_age integer;
  v_price_usd decimal;
  v_initial_status text;
BEGIN
  v_total_runners := jsonb_array_length(p_runners);
  IF v_total_runners < 1 OR v_total_runners > 5 THEN
    RAISE EXCEPTION 'El grupo debe tener entre 1 y 5 corredores.';
  END IF;

  v_is_immediate := is_immediate_payment(p_payment_method);
  v_initial_status := CASE WHEN v_is_immediate THEN 'procesando' ELSE 'pendiente' END;

  -- Crear el grupo de registro
  INSERT INTO registration_groups (
    registrant_email, registrant_phone, total_runners, payment_method, payment_status
  ) VALUES (
    p_registrant_email, p_registrant_phone, v_total_runners, p_payment_method, v_initial_status
  ) RETURNING id, group_code INTO v_group_id, v_group_code;

  -- Crear cada corredor y reservar inventario
  FOR v_runner IN SELECT * FROM jsonb_array_elements(p_runners)
  LOOP
    v_birth_date := (v_runner->>'birth_date')::date;
    v_age := calculate_age(v_birth_date);
    IF v_age < 16 THEN
      RAISE EXCEPTION 'Error de validación: Todos los corredores deben tener al menos 16 años.';
    END IF;

    INSERT INTO runners (
      group_id, full_name, identification_type, identification, birth_date, gender, email, phone,
      shirt_size, profile_photo_url, payment_status, payment_method, registered_by
    ) VALUES (
      v_group_id, v_runner->>'full_name', v_runner->>'identification_type', v_runner->>'identification',
      v_birth_date, v_runner->>'gender', v_runner->>'email', v_runner->>'phone',
      v_runner->>'shirt_size', v_runner->>'profile_photo_url', v_initial_status, p_payment_method, p_registered_by
    );

    IF NOT v_is_immediate THEN
      IF NOT reserve_inventory_with_timeout(v_group_id, v_runner->>'shirt_size', v_runner->>'gender') THEN
        v_all_reserved := false;
      END IF;
    END IF;
  END LOOP;

  IF NOT v_is_immediate AND NOT v_all_reserved THEN
    RAISE EXCEPTION 'Error de inventario: No hay suficientes franelas disponibles para una de las tallas solicitadas.';
  END IF;

  IF v_is_immediate THEN
    PERFORM confirm_group_payment(v_group_id, p_registered_by);
  END IF;

  RETURN jsonb_build_object(
    'group_id', v_group_id,
    'group_code', v_group_code,
    'total_runners', v_total_runners,
    'payment_status', (SELECT payment_status FROM registration_groups WHERE id = v_group_id),
    'reserved_until', (SELECT reserved_until FROM registration_groups WHERE id = v_group_id)
  );
END;
$$;


-- ------------------------------------------------------------------------------------
-- SECCIÓN 5: TRIGGERS
-- ------------------------------------------------------------------------------------

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_banks_updated_at BEFORE UPDATE ON banks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_exchange_rates_updated_at BEFORE UPDATE ON exchange_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gateway_config_updated_at BEFORE UPDATE ON gateway_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_runner_numbers_updated_at BEFORE UPDATE ON runner_numbers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_registration_groups_updated_at BEFORE UPDATE ON registration_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_runners_updated_at BEFORE UPDATE ON runners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_reservations_updated_at BEFORE UPDATE ON inventory_reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------------------------------
-- SECCIÓN 6: VISTAS
-- ------------------------------------------------------------------------------------

-- Vista para el estado del inventario por género
CREATE OR REPLACE VIEW inventory_status_by_gender AS
SELECT
  shirt_size, gender, stock, reserved, (stock - reserved) as available,
  CASE
    WHEN (stock - reserved) = 0 THEN 'Agotado'
    WHEN (stock - reserved) <= 10 THEN 'Bajo'
    ELSE 'Disponible'
  END as status
FROM inventory
ORDER BY gender, CASE shirt_size WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3 WHEN 'L' THEN 4 WHEN 'XL' THEN 5 ELSE 6 END;

-- Vista para ver corredores con su edad calculada
CREATE OR REPLACE VIEW runners_with_age AS
SELECT r.*, calculate_age(r.birth_date) as age
FROM runners r;

-- Vista de resumen por grupo de registro
CREATE OR REPLACE VIEW runner_group_summary AS
SELECT
  rg.id as group_id, rg.group_code, rg.registrant_email, rg.total_runners,
  rg.payment_status, rg.payment_method, rg.payment_reference, rg.reserved_until, rg.created_at,
  COUNT(r.id) as registered_runners,
  STRING_AGG(r.full_name, ', ' ORDER BY r.created_at) as runner_names,
  jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'name', r.full_name,
      'identification', r.identification_type || '-' || r.identification,
      'birth_date', r.birth_date,
      'age', calculate_age(r.birth_date),
      'gender', r.gender,
      'shirt_size', r.shirt_size,
      'runner_number', r.runner_number
    ) ORDER BY r.created_at
  ) as runners_detail
FROM registration_groups rg
LEFT JOIN runners r ON r.group_id = rg.id
GROUP BY rg.id;

-- Vista para estadísticas diarias de registros
CREATE OR REPLACE VIEW daily_statistics AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_registrations,
  COUNT(CASE WHEN payment_status = 'confirmado' THEN 1 END) as confirmed_registrations,
  COUNT(CASE WHEN payment_status IN ('pendiente', 'procesando') THEN 1 END) as pending_registrations,
  COUNT(CASE WHEN payment_method = 'pago_movil_p2c' THEN 1 END) as p2c_registrations,
  COUNT(CASE WHEN payment_method = 'tienda' THEN 1 END) as store_registrations
FROM runners
GROUP BY DATE(created_at)
ORDER BY date DESC;


-- ------------------------------------------------------------------------------------
-- SECCIÓN 7: ÍNDICES
-- ------------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_runners_group_id ON runners(group_id);
CREATE INDEX IF NOT EXISTS idx_runners_identification ON runners(identification_type, identification);
CREATE INDEX IF NOT EXISTS idx_runners_payment_status ON runners(payment_status);
CREATE INDEX IF NOT EXISTS idx_registration_groups_payment_status ON registration_groups(payment_status);
CREATE INDEX IF NOT EXISTS idx_registration_groups_reserved_until ON registration_groups(reserved_until);
CREATE INDEX IF NOT EXISTS idx_inventory_size_gender ON inventory(shirt_size, gender);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_status_time ON inventory_reservations(status, reserved_until);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_group_id ON payment_transactions(group_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(date DESC);


-- ------------------------------------------------------------------------------------
-- SECCIÓN 8: JOB DE LIMPIEZA (PG_CRON)
-- ------------------------------------------------------------------------------------

-- Este job se ejecuta cada 30 minutos para limpiar reservas expiradas.
-- Descomentar y ajustar el `schedule` si pg_cron está instalado y configurado.
-- SELECT cron.schedule('release-expired-reservations-job', '*/30 * * * *', 'SELECT release_expired_reservations();');


-- ------------------------------------------------------------------------------------
-- SECCIÓN 9: SEGURIDAD (ROW LEVEL SECURITY)
-- ------------------------------------------------------------------------------------

-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE runner_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE runners ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para tablas de configuración y catálogos (lectura pública)
CREATE POLICY "Public can read configuration" ON gateway_config FOR SELECT USING (true);
CREATE POLICY "Public can read banks" ON banks FOR SELECT USING (true);
CREATE POLICY "Public can read exchange rates" ON exchange_rates FOR SELECT USING (true);
CREATE POLICY "Public can read inventory status" ON inventory FOR SELECT USING (true);
CREATE POLICY "Admin can manage system tables" ON gateway_config FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin can manage banks" ON banks FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin can manage exchange rates" ON exchange_rates FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin can manage inventory" ON inventory FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Políticas para usuarios
CREATE POLICY "Users can view and manage their own data" ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY "Admin can view all users" ON users FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Políticas para grupos de registro y corredores
CREATE POLICY "Authenticated users can view groups and runners" ON registration_groups FOR SELECT USING (true);
CREATE POLICY "Authenticated users can view groups and runners" ON runners FOR SELECT USING (true);
CREATE POLICY "Admin/Tienda can create registration groups" ON registration_groups FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'tienda')));
CREATE POLICY "Admin can update any group" ON registration_groups FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin can manage all runners" ON runners FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Políticas para tablas de pagos y reservas (restringidas)
CREATE POLICY "Admin can manage all payment data" ON payment_transactions FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin can manage all reservations" ON inventory_reservations FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin can view all logs" ON payment_errors FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin can view all logs" ON webhook_logs FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));