/*
  # Sistema Completo de Registro de Corredores con P2C Automático

  1. Tablas Existentes Actualizadas
    - `users` - Sistema de autenticación con roles
    - `runners` - Registro de corredores con soporte P2C
    - `inventory` - Control de stock por tallas
    - `payments` - Historial de pagos mejorado para P2C
    - `runner_numbers` - Secuencia de números de corredor

  2. Nuevas Tablas
    - `exchange_rates` - Tasas de cambio BCV
    - `payment_transactions` - Transacciones detalladas del gateway
    - `payment_errors` - Log de errores de pago
    - `banks` - Catálogo de bancos venezolanos
    - `gateway_config` - Configuración del gateway
    - `webhook_logs` - Logs de webhooks

  3. Seguridad
    - RLS habilitado en todas las tablas
    - Políticas específicas por rol
    - Autenticación requerida para operaciones críticas
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla para autenticación y roles de usuarios
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'usuario' CHECK (role IN ('admin', 'tienda', 'usuario')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla para el registro de corredores con soporte P2C
CREATE TABLE IF NOT EXISTS runners (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name text NOT NULL,
  identification_type text NOT NULL CHECK (identification_type IN ('V', 'E', 'J', 'P')),
  identification text NOT NULL,
  age integer NOT NULL CHECK (age >= 16 AND age <= 99),
  email text NOT NULL,
  phone text NOT NULL,
  shirt_size text NOT NULL CHECK (shirt_size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  profile_photo_url text,
  runner_number integer UNIQUE,
  payment_status text NOT NULL DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente', 'confirmado', 'rechazado', 'procesando')),
  payment_method text NOT NULL CHECK (payment_method IN ('tienda', 'zelle', 'transferencia', 'pago_movil_p2c')),
  payment_reference text,
  payment_confirmed_at timestamptz,
  registered_by uuid REFERENCES users(id),
  user_id uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(identification_type, identification)
);

-- Tabla para el control de inventario de franelas
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shirt_size text UNIQUE NOT NULL CHECK (shirt_size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (reserved <= stock)
);

-- Catálogo de bancos venezolanos
CREATE TABLE IF NOT EXISTS banks (
  code text PRIMARY KEY,
  name text NOT NULL,
  short_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tasas de cambio (BCV)
CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  rate decimal(10,4) NOT NULL,
  source text NOT NULL DEFAULT 'BCV',
  date date NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Transacciones detalladas de la pasarela de pago
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  runner_id uuid NOT NULL REFERENCES runners(id) ON DELETE CASCADE,
  control text UNIQUE NOT NULL,
  invoice text UNIQUE NOT NULL,
  amount_usd decimal(10,2) NOT NULL,
  amount_bs decimal(15,2) NOT NULL,
  exchange_rate decimal(10,4),
  payment_method text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'failed', 'cancelled')),
  gateway_response jsonb,
  auth_id text,
  reference text,
  terminal text,
  lote text,
  seqnum text,
  voucher jsonb,
  client_phone text,
  client_bank_code text REFERENCES banks(code),
  commerce_phone text,
  commerce_bank_code text REFERENCES banks(code),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- Historial de pagos general
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  runner_id uuid NOT NULL REFERENCES runners(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES payment_transactions(id),
  amount decimal(10,2) NOT NULL DEFAULT 55.00,
  payment_method text NOT NULL CHECK (payment_method IN ('tienda', 'zelle', 'transferencia', 'pago_movil_p2c')),
  payment_reference text,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'confirmado', 'rechazado')),
  confirmed_by uuid REFERENCES users(id),
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Log de errores de la pasarela de pago
CREATE TABLE IF NOT EXISTS payment_errors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  runner_id uuid REFERENCES runners(id),
  transaction_id uuid REFERENCES payment_transactions(id),
  error_code text,
  error_message text,
  error_details jsonb,
  gateway_response text,
  created_at timestamptz DEFAULT now()
);

-- Configuración de la pasarela de pago
CREATE TABLE IF NOT EXISTS gateway_config (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key text UNIQUE NOT NULL,
  config_value text NOT NULL,
  description text,
  is_encrypted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Logs de Webhooks recibidos
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


-- Secuencia para números de corredor
CREATE TABLE IF NOT EXISTS runner_numbers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  current_number integer NOT NULL DEFAULT 1000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Inicializar secuencia de números de corredor
INSERT INTO runner_numbers (current_number) 
SELECT 1000 
WHERE NOT EXISTS (SELECT 1 FROM runner_numbers);

-- Inicializar inventario con stock por defecto
INSERT INTO inventory (shirt_size, stock) VALUES 
  ('XS', 50), ('S', 100), ('M', 150), ('L', 150), ('XL', 100), ('XXL', 50)
ON CONFLICT (shirt_size) DO NOTHING;

-- Insertar bancos venezolanos
INSERT INTO banks (code, name, short_name) VALUES
  ('0102', 'Banco de Venezuela', 'BDV'), ('0104', 'Banco Venezolano de Crédito', 'BVC'), ('0105', 'Banco Mercantil', 'Mercantil'), ('0108', 'Banco Provincial', 'Provincial'),
  ('0114', 'Bancaribe', 'Bancaribe'), ('0115', 'Banco Exterior', 'Exterior'), ('0116', 'Banco Occidental de Descuento', 'BOD'), ('0128', 'Banco Caroní', 'Caroní'),
  ('0134', 'Banesco', 'Banesco'), ('0137', 'Banco Sofitasa', 'Sofitasa'), ('0138', 'Banco Plaza', 'Plaza'), ('0146', 'Banco de la Gente Emprendedora', 'Bangente'),
  ('0151', 'BFC Banco Fondo Común', 'BFC'), ('0156', '100% Banco', '100% Banco'), ('0157', 'DelSur', 'DelSur'), ('0163', 'Banco del Tesoro', 'Tesoro'),
  ('0166', 'Banco Agrícola de Venezuela', 'BAV'), ('0168', 'Bancrecer', 'Bancrecer'), ('0169', 'Mi Banco', 'Mi Banco'), ('0171', 'Banco Activo', 'Activo'),
  ('0172', 'Bancamiga', 'Bancamiga'), ('0173', 'Banco Internacional de Desarrollo', 'BID'), ('0174', 'Banplus', 'Banplus'), ('0175', 'Banco Bicentenario', 'Bicentenario'),
  ('0176', 'Banco Espirito Santo', 'BES'), ('0177', 'Banfanb', 'Banfanb'), ('0191', 'Banco Nacional de Crédito', 'BNC')
ON CONFLICT DO NOTHING;

-- Configuración inicial de la pasarela
INSERT INTO gateway_config (config_key, config_value, description) VALUES
  ('gateway_url', 'https://paytest.megasoft.com.ve', 'URL del gateway de pagos'),
  ('cod_afiliacion', '20250325', 'Código de afiliación del comercio'),
  ('race_price_usd', '55.00', 'Precio de la carrera en USD'),
  ('auto_approve_p2c', 'true', 'Aprobar automáticamente pagos P2C'),
  ('max_retry_attempts', '3', 'Máximo número de reintentos')
ON CONFLICT DO NOTHING;


-- Obtener el siguiente número de corredor
CREATE OR REPLACE FUNCTION get_next_runner_number()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE next_num integer;
BEGIN
  UPDATE runner_numbers SET current_number = current_number + 1, updated_at = now()
  RETURNING current_number INTO next_num;
  RETURN next_num;
END;
$$;

-- Obtener la tasa de cambio BCV más reciente
CREATE OR REPLACE FUNCTION get_current_exchange_rate()
RETURNS decimal LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE current_rate decimal;
BEGIN
  SELECT rate INTO current_rate FROM exchange_rates ORDER BY date DESC LIMIT 1;
  IF current_rate IS NULL THEN RAISE EXCEPTION 'No exchange rate found'; END IF;
  RETURN current_rate;
END;
$$;

-- Convertir monto de USD a Bs. usando la tasa actual
CREATE OR REPLACE FUNCTION convert_usd_to_bs(amount_usd decimal)
RETURNS decimal LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN ROUND(amount_usd * get_current_exchange_rate(), 2);
END;
$$;

-- Reservar una unidad del inventario
CREATE OR REPLACE FUNCTION reserve_inventory(size text, quantity integer DEFAULT 1)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE available integer;
BEGIN
  SELECT (stock - reserved) INTO available FROM inventory WHERE shirt_size = size;
  IF available >= quantity THEN
    UPDATE inventory SET reserved = reserved + quantity, updated_at = now() WHERE shirt_size = size;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- Confirmar una reserva (reducir stock y reserva)
CREATE OR REPLACE FUNCTION confirm_inventory(size text, quantity integer DEFAULT 1)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE inventory SET stock = stock - quantity, reserved = reserved - quantity, updated_at = now()
  WHERE shirt_size = size AND reserved >= quantity;
  RETURN FOUND;
END;
$$;

-- Liberar una reserva de inventario
CREATE OR REPLACE FUNCTION release_inventory(size text, quantity integer DEFAULT 1)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE inventory SET reserved = reserved - quantity, updated_at = now()
  WHERE shirt_size = size AND reserved >= quantity;
  RETURN FOUND;
END;
$$;

-- Procesar un pago P2C (crea la transacción)
CREATE OR REPLACE FUNCTION process_p2c_payment(p_runner_id uuid, p_control text, p_invoice text, p_amount_usd decimal, p_amount_bs decimal, p_exchange_rate decimal, p_client_phone text, p_client_bank_code text, p_commerce_phone text, p_commerce_bank_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_transaction_id uuid;
BEGIN
  INSERT INTO payment_transactions (runner_id, control, invoice, amount_usd, amount_bs, exchange_rate, payment_method, status, client_phone, client_bank_code, commerce_phone, commerce_bank_code) 
  VALUES (p_runner_id, p_control, p_invoice, p_amount_usd, p_amount_bs, p_exchange_rate, 'pago_movil_p2c', 'pending', p_client_phone, p_client_bank_code, p_commerce_phone, p_commerce_bank_code)
  RETURNING id INTO v_transaction_id;
  
  UPDATE runners SET payment_status = 'procesando' WHERE id = p_runner_id;
  
  RETURN v_transaction_id;
END;
$$;

-- Confirma un pago P2C (actualiza corredor, inventario y pago)
CREATE OR REPLACE FUNCTION confirm_p2c_payment(p_transaction_id uuid, p_auth_id text, p_reference text, p_voucher jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_runner_id uuid;
  v_shirt_size text;
  v_runner_number integer;
BEGIN
  UPDATE payment_transactions SET status = 'approved', auth_id = p_auth_id, reference = p_reference, voucher = p_voucher, processed_at = now()
  WHERE id = p_transaction_id RETURNING runner_id INTO v_runner_id;
  
  IF NOT FOUND THEN RETURN false; END IF;
  
  SELECT shirt_size INTO v_shirt_size FROM runners WHERE id = v_runner_id;
  v_runner_number := get_next_runner_number();
  
  UPDATE runners SET payment_status = 'confirmado', payment_confirmed_at = now(), runner_number = v_runner_number
  WHERE id = v_runner_id;
  
  PERFORM confirm_inventory(v_shirt_size);
  
  INSERT INTO payments (runner_id, transaction_id, amount, payment_method, status, confirmed_at)
  VALUES (v_runner_id, p_transaction_id, (SELECT amount_usd FROM payment_transactions WHERE id = p_transaction_id), 'pago_movil_p2c', 'confirmado', now());
  
  RETURN true;
END;
$$;

-- Función de trigger para actualizar la columna updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language plpgsql;

-- Aplicar el trigger a todas las tablas relevantes
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_runners_updated_at BEFORE UPDATE ON runners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_exchange_rates_updated_at BEFORE UPDATE ON exchange_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_banks_updated_at BEFORE UPDATE ON banks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gateway_config_updated_at BEFORE UPDATE ON gateway_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_runner_numbers_updated_at BEFORE UPDATE ON runner_numbers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vista con el resumen de pago por corredor
CREATE OR REPLACE VIEW runner_payment_summary AS
SELECT 
  r.id as runner_id, r.full_name, r.identification_type, r.identification, r.email, r.phone,
  r.shirt_size, r.payment_status, r.runner_number, r.created_at as registration_date,
  p.amount as payment_amount, p.status as payment_status_detail, p.confirmed_at,
  pt.control, pt.invoice, pt.amount_bs, pt.exchange_rate, pt.reference, pt.processed_at
FROM runners r
LEFT JOIN payments p ON p.runner_id = r.id
LEFT JOIN payment_transactions pt ON pt.id = p.transaction_id;

-- Vista para el estado del inventario
CREATE OR REPLACE VIEW inventory_status AS
SELECT 
  shirt_size, stock, reserved, (stock - reserved) as available,
  CASE 
    WHEN (stock - reserved) = 0 THEN 'Agotado'
    WHEN (stock - reserved) < 10 THEN 'Bajo'
    ELSE 'Disponible'
  END as status
FROM inventory
ORDER BY CASE shirt_size WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3 WHEN 'L' THEN 4 WHEN 'XL' THEN 5 ELSE 6 END;

-- Vista para estadísticas diarias de registros
CREATE OR REPLACE VIEW daily_statistics AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_registrations,
  COUNT(CASE WHEN payment_status = 'confirmado' THEN 1 END) as confirmed_payments,
  COUNT(CASE WHEN payment_status = 'pendiente' THEN 1 END) as pending_payments,
  COUNT(CASE WHEN payment_method = 'pago_movil_p2c' THEN 1 END) as p2c_payments,
  COUNT(CASE WHEN payment_method = 'tienda' THEN 1 END) as store_payments
FROM runners
GROUP BY DATE(created_at)
ORDER BY date DESC;

CREATE INDEX IF NOT EXISTS idx_runners_email ON runners(email);
CREATE INDEX IF NOT EXISTS idx_runners_identification ON runners(identification_type, identification);
CREATE INDEX IF NOT EXISTS idx_runners_payment_status ON runners(payment_status);
CREATE INDEX IF NOT EXISTS idx_runners_registered_by ON runners(registered_by);
CREATE INDEX IF NOT EXISTS idx_runners_user_id ON runners(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_runner_id ON payments(runner_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_runner_id ON payment_transactions(runner_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_control ON payment_transactions(control);
CREATE INDEX IF NOT EXISTS idx_payment_errors_runner_id ON payment_errors(runner_id);
CREATE INDEX IF NOT EXISTS idx_payment_errors_transaction_id ON payment_errors(transaction_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(date DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE runners ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE runner_numbers ENABLE ROW LEVEL SECURITY;

-- Definición de Políticas RLS
-- (Se utilizan las políticas de la versión más completa, que cubren todas las tablas)

-- Políticas para la tabla 'users'
CREATE POLICY "Users can read own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can read all users" ON users FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);

-- Políticas para la tabla 'runners'
CREATE POLICY "Authenticated users can read runners" ON runners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read own registration" ON runners FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admin and tienda can insert runners" ON runners FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'tienda')));
CREATE POLICY "Admin can update all runners" ON runners FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Tienda can update own registrations" ON runners FOR UPDATE USING (registered_by = auth.uid() AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'tienda'));

-- Políticas para la tabla 'inventory'
CREATE POLICY "Everyone can read inventory" ON inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage inventory" ON inventory FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Políticas para tablas de pagos y transacciones
CREATE POLICY "Authenticated users can read payments" ON payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage payments" ON payments FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Authenticated users can read transactions" ON payment_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin and tienda can insert transactions" ON payment_transactions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'tienda')));
CREATE POLICY "Admin can update transactions" ON payment_transactions FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Políticas para tablas auxiliares y de configuración
CREATE POLICY "Everyone can read exchange rates" ON exchange_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage exchange rates" ON exchange_rates FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Everyone can read banks" ON banks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can read gateway config" ON gateway_config FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin can manage gateway config" ON gateway_config FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Políticas para tablas de logs
CREATE POLICY "Admin can view errors" ON payment_errors FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin can view webhook logs" ON webhook_logs FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));