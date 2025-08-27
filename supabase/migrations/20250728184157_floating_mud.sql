/*
  # Sistema de Gestión y Ventas de Entradas para Concierto

  1. Nuevas Tablas
    - `concert_tickets` - Entradas vendidas con códigos únicos
    - `ticket_inventory` - Control de stock de entradas (5000 inicial)
    - `ticket_payments` - Pagos de entradas con comprobantes

  2. Seguridad
    - RLS habilitado en todas las tablas
    - Políticas específicas por rol
    - Códigos únicos para cada entrada

  3. Funcionalidades
    - Generación automática de códigos QR y barras
    - Control de stock automático
    - Comprobantes de pago y retiro
    - Trazabilidad completa
*/

-- Concert tickets table
CREATE TABLE IF NOT EXISTS concert_tickets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number text UNIQUE NOT NULL,
  qr_code text UNIQUE NOT NULL,
  barcode text UNIQUE NOT NULL,
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  buyer_phone text NOT NULL,
  buyer_identification text NOT NULL,
  ticket_price decimal(10,2) NOT NULL DEFAULT 15.00,
  payment_status text NOT NULL DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente', 'confirmado', 'rechazado')),
  payment_method text NOT NULL CHECK (payment_method IN ('tienda', 'zelle', 'transferencia', 'tarjeta')),
  payment_reference text,
  ticket_status text NOT NULL DEFAULT 'vendido' CHECK (ticket_status IN ('vendido', 'canjeado', 'cancelado')),
  sold_by uuid REFERENCES users(id),
  confirmed_by uuid REFERENCES users(id),
  confirmed_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by uuid REFERENCES users(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ticket inventory table
CREATE TABLE IF NOT EXISTS ticket_inventory (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  total_tickets integer NOT NULL DEFAULT 5000,
  sold_tickets integer NOT NULL DEFAULT 0,
  reserved_tickets integer NOT NULL DEFAULT 0,
  available_tickets integer GENERATED ALWAYS AS (total_tickets - sold_tickets - reserved_tickets) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (sold_tickets >= 0),
  CHECK (reserved_tickets >= 0),
  CHECK (sold_tickets + reserved_tickets <= total_tickets)
);

-- Ticket payments table
CREATE TABLE IF NOT EXISTS ticket_payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id uuid NOT NULL REFERENCES concert_tickets(id) ON DELETE CASCADE,
  amount decimal(10,2) NOT NULL DEFAULT 15.00,
  payment_method text NOT NULL CHECK (payment_method IN ('tienda', 'zelle', 'transferencia', 'tarjeta')),
  payment_reference text,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'confirmado', 'rechazado')),
  confirmed_by uuid REFERENCES users(id),
  confirmed_at timestamptz,
  notes text,
  receipt_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Initialize ticket inventory
INSERT INTO ticket_inventory (total_tickets, sold_tickets, reserved_tickets) 
SELECT 5000, 0, 0 
WHERE NOT EXISTS (SELECT 1 FROM ticket_inventory);

-- Enable Row Level Security
ALTER TABLE concert_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for concert_tickets table
CREATE POLICY "Authenticated users can read tickets" ON concert_tickets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and tienda can insert tickets" ON concert_tickets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'tienda')
    )
  );

CREATE POLICY "Admin can update all tickets" ON concert_tickets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Tienda can update own sales" ON concert_tickets
  FOR UPDATE USING (
    sold_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'tienda'
    )
  );

-- RLS Policies for ticket_inventory table
CREATE POLICY "Everyone can read ticket inventory" ON ticket_inventory
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage ticket inventory" ON ticket_inventory
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for ticket_payments table
CREATE POLICY "Authenticated users can read ticket payments" ON ticket_payments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage ticket payments" ON ticket_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to generate unique ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Function to generate unique QR code
CREATE OR REPLACE FUNCTION generate_qr_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Function to generate unique barcode
CREATE OR REPLACE FUNCTION generate_barcode()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Function to reserve ticket inventory
CREATE OR REPLACE FUNCTION reserve_ticket_inventory(quantity integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  available integer;
BEGIN
  SELECT available_tickets INTO available
  FROM ticket_inventory
  LIMIT 1;
  
  IF available >= quantity THEN
    UPDATE ticket_inventory
    SET reserved_tickets = reserved_tickets + quantity,
        updated_at = now();
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- Function to confirm ticket sale (convert reserved to sold)
CREATE OR REPLACE FUNCTION confirm_ticket_sale(quantity integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ticket_inventory
  SET sold_tickets = sold_tickets + quantity,
      reserved_tickets = reserved_tickets - quantity,
      updated_at = now()
  WHERE reserved_tickets >= quantity;
  
  RETURN FOUND;
END;
$$;

-- Function to release reserved tickets
CREATE OR REPLACE FUNCTION release_ticket_reservation(quantity integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ticket_inventory
  SET reserved_tickets = reserved_tickets - quantity,
      updated_at = now()
  WHERE reserved_tickets >= quantity;
  
  RETURN FOUND;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER update_concert_tickets_updated_at BEFORE UPDATE ON concert_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_inventory_updated_at BEFORE UPDATE ON ticket_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_payments_updated_at BEFORE UPDATE ON ticket_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_concert_tickets_ticket_number ON concert_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_concert_tickets_qr_code ON concert_tickets(qr_code);
CREATE INDEX IF NOT EXISTS idx_concert_tickets_barcode ON concert_tickets(barcode);
CREATE INDEX IF NOT EXISTS idx_concert_tickets_buyer_email ON concert_tickets(buyer_email);
CREATE INDEX IF NOT EXISTS idx_concert_tickets_payment_status ON concert_tickets(payment_status);
CREATE INDEX IF NOT EXISTS idx_concert_tickets_ticket_status ON concert_tickets(ticket_status);
CREATE INDEX IF NOT EXISTS idx_ticket_payments_ticket_id ON ticket_payments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_payments_status ON ticket_payments(status);