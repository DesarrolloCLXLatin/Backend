CREATE OR REPLACE FUNCTION public.create_registration_group_with_runners(
    p_registrant_email text, 
    p_registrant_phone text, 
    p_payment_method text, 
    p_runners jsonb, 
    p_registered_by uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    v_group_id uuid;
    v_group_code text;
    v_runner jsonb;
    v_runner_id uuid;
    v_runner_count integer := 0;
    v_payment_status text;
BEGIN
    -- Generar código de grupo único
    v_group_code := 'GRP' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD') || 
                    LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    
    -- IMPORTANTE: Establecer el estado de pago correcto
    -- Todos los métodos deben comenzar como 'pendiente'
    v_payment_status := 'pendiente';
    
    -- Crear el grupo de registro
    INSERT INTO registration_groups (
        registrant_email,
        registrant_phone,
        payment_method,
        payment_status,
        group_code,
        total_runners,
        reserved_until
    ) VALUES (
        p_registrant_email,
        p_registrant_phone,
        p_payment_method,
        v_payment_status,
        v_group_code,
        jsonb_array_length(p_runners),
        CURRENT_TIMESTAMP + INTERVAL '72 hours'
    ) RETURNING id INTO v_group_id;
    
    -- Procesar cada corredor
    FOR v_runner IN SELECT * FROM jsonb_array_elements(p_runners)
    LOOP
        -- Insertar corredor
        INSERT INTO runners (
            group_id,
            full_name,
            identification_type,
            identification,
            birth_date,
            gender,
            email,
            phone,
            shirt_size,
            profile_photo_url,
            payment_status,
            payment_method,  -- ⚠️ AGREGAR payment_method aquí
            registered_by
        ) VALUES (
            v_group_id,
            v_runner->>'full_name',
            v_runner->>'identification_type',
            v_runner->>'identification',
            (v_runner->>'birth_date')::date,
            v_runner->>'gender',
            v_runner->>'email',
            v_runner->>'phone',
            v_runner->>'shirt_size',
            v_runner->>'profile_photo_url',
            v_payment_status,
            p_payment_method,  -- ⚠️ Usar el método de pago del grupo
            p_registered_by
        ) RETURNING id INTO v_runner_id;
        
        -- Reservar inventario
        PERFORM reserve_inventory(
            v_runner->>'shirt_size',
            v_runner->>'gender',
            1
        );
        
        v_runner_count := v_runner_count + 1;
    END LOOP;
    
    -- Retornar información del grupo creado
    RETURN jsonb_build_object(
        'group_id', v_group_id,
        'group_code', v_group_code,
        'total_runners', v_runner_count,
        'payment_status', v_payment_status,
        'reserved_until', CURRENT_TIMESTAMP + INTERVAL '72 hours'
    );
END;
$function$;

===================================================================================================
-- Actualizar la función para que funcione correctamente con el backend
CREATE OR REPLACE FUNCTION create_registration_group_with_runners(
  p_registrant_email text,
  p_registrant_phone text,
  p_payment_method text,
  p_runners jsonb,
  p_registered_by uuid DEFAULT NULL -- Cambiar de auth.uid() a NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_group_id uuid;
  v_group_code text;
  v_runner jsonb;
  v_total_runners integer;
  v_all_reserved boolean := true;
  v_birth_date date;
  v_age integer;
  v_initial_status text;
BEGIN
  v_total_runners := jsonb_array_length(p_runners);
  IF v_total_runners < 1 OR v_total_runners > 5 THEN
    RAISE EXCEPTION 'El grupo debe tener entre 1 y 5 corredores.';
  END IF;

  -- IMPORTANTE: Para pago_movil_p2c, el estado inicial debe ser 'pendiente'
  v_initial_status := 'pendiente'; -- Siempre pendiente hasta confirmación de pago

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
      v_group_id, 
      v_runner->>'full_name', 
      v_runner->>'identification_type', 
      v_runner->>'identification',
      v_birth_date, 
      v_runner->>'gender', 
      v_runner->>'email', 
      v_runner->>'phone',
      v_runner->>'shirt_size', 
      v_runner->>'profile_photo_url', 
      v_initial_status, 
      p_payment_method, 
      p_registered_by
    );

    -- Reservar inventario para todos los métodos de pago (se liberará si falla)
    IF NOT reserve_inventory_with_timeout(v_group_id, v_runner->>'shirt_size', v_runner->>'gender') THEN
      v_all_reserved := false;
    END IF;
  END LOOP;

  IF NOT v_all_reserved THEN
    RAISE EXCEPTION 'Error de inventario: No hay suficientes franelas disponibles para una de las tallas solicitadas.';
  END IF;

  -- NO confirmar automáticamente para ningún método
  -- La confirmación se hará después del pago exitoso

  RETURN jsonb_build_object(
    'group_id', v_group_id,
    'group_code', v_group_code,
    'total_runners', v_total_runners,
    'payment_status', v_initial_status,
    'reserved_until', (SELECT reserved_until FROM registration_groups WHERE id = v_group_id)
  );
END;
$$;
==============================================================================================

-- Crear función reserve_inventory que llama a reserve_inventory_with_timeout
-- Esto es para mantener compatibilidad con el código que espera reserve_inventory
CREATE OR REPLACE FUNCTION reserve_inventory(
  p_shirt_size text,
  p_gender text,
  p_quantity integer
)
RETURNS void AS $$
DECLARE
  v_dummy_group_id uuid;
BEGIN
  -- Para compatibilidad, simplemente actualizar el inventario directamente
  UPDATE inventory
  SET reserved = reserved + p_quantity,
      updated_at = now()
  WHERE shirt_size = p_shirt_size 
  AND gender = p_gender
  AND (stock - reserved) >= p_quantity;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock insuficiente para talla % género %', p_shirt_size, p_gender;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- También crear release_inventory si no existe
CREATE OR REPLACE FUNCTION release_inventory(
  p_shirt_size text,
  p_gender text,
  p_quantity integer
)
RETURNS void AS $$
BEGIN
  UPDATE inventory
  SET reserved = GREATEST(0, reserved - p_quantity),
      updated_at = now()
  WHERE shirt_size = p_shirt_size 
  AND gender = p_gender;
END;
$$ LANGUAGE plpgsql;

======================================================================================================

-- Agregar columnas faltantes para pago móvil P2C
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS client_phone text,
ADD COLUMN IF NOT EXISTS client_bank_code text,
ADD COLUMN IF NOT EXISTS commerce_phone text,
ADD COLUMN IF NOT EXISTS commerce_bank_code text,
ADD COLUMN IF NOT EXISTS terminal text,
ADD COLUMN IF NOT EXISTS lote text,
ADD COLUMN IF NOT EXISTS seqnum text,
ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Agregar columnas para la trazabilidad completa
ALTER TABLE registration_groups
ADD COLUMN IF NOT EXISTS payment_date timestamptz,
ADD COLUMN IF NOT EXISTS payment_transaction_id uuid REFERENCES payment_transactions(id),
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS last_payment_attempt timestamptz;

-- Crear tabla para eventos de pago si no existe
CREATE TABLE IF NOT EXISTS payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES registration_groups(id),
  transaction_id uuid REFERENCES payment_transactions(id),
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Índices para las nuevas columnas
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_method ON payment_transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_payment_events_group_id ON payment_events(group_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_transaction_id ON payment_events(transaction_id);

-- Verificar la estructura actualizada
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_transactions'
ORDER BY ordinal_position;

========================================================================================================

-- Habilitar RLS en la nueva tabla
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

-- Políticas para payment_events
CREATE POLICY "Admin can manage payment events" ON payment_events 
FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view their payment events" ON payment_events 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM registration_groups rg 
    WHERE rg.id = payment_events.group_id 
    AND rg.registrant_email = (SELECT email FROM users WHERE id = auth.uid())
  )
);

-- Si estás en desarrollo y auth.uid() no funciona, usa políticas temporales:
DROP POLICY IF EXISTS "Temp allow all payment events" ON payment_events;
CREATE POLICY "Temp allow all payment events" ON payment_events 
FOR ALL USING (true);

=========================================================================================================

