/*
  # Sistema Completo de Registro de Corredores

  1. Nuevas Tablas
    - `users` - Sistema de autenticación con roles
    - `runners` - Registro de corredores con todos los datos
    - `inventory` - Control de stock por tallas
    - `payments` - Historial de pagos y transacciones
    - `runner_numbers` - Secuencia de números de corredor

  2. Seguridad
    - RLS habilitado en todas las tablas
    - Políticas específicas por rol
    - Autenticación requerida para operaciones críticas

  3. Funcionalidades
    - Gestión completa de usuarios y roles
    - Control de inventario automático
    - Asignación automática de números
    - Trazabilidad de pagos
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication and roles
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'usuario' CHECK (role IN ('admin', 'tienda', 'usuario')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Runners table for race registrations
CREATE TABLE IF NOT EXISTS runners (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name text NOT NULL,
  identification text UNIQUE NOT NULL,
  age integer NOT NULL CHECK (age >= 16 AND age <= 99),
  email text NOT NULL,
  phone text NOT NULL,
  shirt_size text NOT NULL CHECK (shirt_size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  profile_photo_url text,
  runner_number integer UNIQUE,
  payment_status text NOT NULL DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente', 'confirmado', 'rechazado')),
  payment_method text NOT NULL CHECK (payment_method IN ('tienda', 'zelle', 'transferencia')),
  payment_reference text,
  registered_by uuid REFERENCES users(id),
  user_id uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Inventory table for shirt stock management
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shirt_size text UNIQUE NOT NULL CHECK (shirt_size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (reserved <= stock)
);

-- Payments table for payment history and tracking
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  runner_id uuid NOT NULL REFERENCES runners(id) ON DELETE CASCADE,
  amount decimal(10,2) NOT NULL DEFAULT 25.00,
  payment_method text NOT NULL CHECK (payment_method IN ('tienda', 'zelle', 'transferencia')),
  payment_reference text,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'confirmado', 'rechazado')),
  confirmed_by uuid REFERENCES users(id),
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Runner numbers sequence table
CREATE TABLE IF NOT EXISTS runner_numbers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  current_number integer NOT NULL DEFAULT 1000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Initialize runner numbers sequence
INSERT INTO runner_numbers (current_number) 
SELECT 1000 
WHERE NOT EXISTS (SELECT 1 FROM runner_numbers);

-- Initialize inventory with default stock
INSERT INTO inventory (shirt_size, stock) VALUES 
  ('XS', 50),
  ('S', 100),
  ('M', 150),
  ('L', 150),
  ('XL', 100),
  ('XXL', 50)
ON CONFLICT (shirt_size) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE runners ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE runner_numbers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can read all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for runners table
CREATE POLICY "Authenticated users can read runners" ON runners
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can read own registration" ON runners
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admin and tienda can insert runners" ON runners
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'tienda')
    )
  );

CREATE POLICY "Admin can update all runners" ON runners
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Tienda can update own registrations" ON runners
  FOR UPDATE USING (
    registered_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'tienda'
    )
  );

-- RLS Policies for inventory table
CREATE POLICY "Everyone can read inventory" ON inventory
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage inventory" ON inventory
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for payments table
CREATE POLICY "Authenticated users can read payments" ON payments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage payments" ON payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for runner_numbers table
CREATE POLICY "Authenticated users can read runner numbers" ON runner_numbers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage runner numbers" ON runner_numbers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to get next runner number
CREATE OR REPLACE FUNCTION get_next_runner_number()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_num integer;
BEGIN
  UPDATE runner_numbers 
  SET current_number = current_number + 1,
      updated_at = now()
  RETURNING current_number INTO next_num;
  
  RETURN next_num;
END;
$$;

-- Function to reserve inventory
CREATE OR REPLACE FUNCTION reserve_inventory(size text, quantity integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  available integer;
BEGIN
  SELECT (stock - reserved) INTO available
  FROM inventory
  WHERE shirt_size = size;
  
  IF available >= quantity THEN
    UPDATE inventory
    SET reserved = reserved + quantity,
        updated_at = now()
    WHERE shirt_size = size;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- Function to confirm inventory (convert reserved to sold)
CREATE OR REPLACE FUNCTION confirm_inventory(size text, quantity integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE inventory
  SET stock = stock - quantity,
      reserved = reserved - quantity,
      updated_at = now()
  WHERE shirt_size = size AND reserved >= quantity;
  
  RETURN FOUND;
END;
$$;

-- Function to release reserved inventory
CREATE OR REPLACE FUNCTION release_inventory(size text, quantity integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE inventory
  SET reserved = reserved - quantity,
      updated_at = now()
  WHERE shirt_size = size AND reserved >= quantity;
  
  RETURN FOUND;
END;
$$;

-- Trigger to update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_runners_updated_at BEFORE UPDATE ON runners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_runners_email ON runners(email);
CREATE INDEX IF NOT EXISTS idx_runners_identification ON runners(identification);
CREATE INDEX IF NOT EXISTS idx_runners_payment_status ON runners(payment_status);
CREATE INDEX IF NOT EXISTS idx_runners_registered_by ON runners(registered_by);
CREATE INDEX IF NOT EXISTS idx_runners_user_id ON runners(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_runner_id ON payments(runner_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);