// utils/validation.ts
import * as yup from 'yup';
import { MIN_AGE, MAX_RUNNERS_PER_GROUP } from '../constants';

// Validadores personalizados
const phoneValidator = yup
  .string()
  .required('Teléfono es requerido')
  .min(10, 'Teléfono debe tener al menos 10 dígitos')
  .matches(/^[0-9]+$/, 'Solo se permiten números');

const venezuelanPhoneValidator = yup
  .string()
  .required('Teléfono es requerido')
  .matches(/^04[0-9]{9}$/, 'Formato: 04XXXXXXXXX');

const identificationValidator = yup
  .string()
  .required('Cédula es requerida')
  .min(6, 'Cédula debe tener al menos 6 caracteres')
  .matches(/^[0-9]+$/, 'Solo se permiten números');

const emailValidator = yup
  .string()
  .email('Email inválido')
  .required('Email es requerido');

// Schema para un corredor individual
const runnerSchema = yup.object().shape({
  full_name: yup
    .string()
    .required('Nombre completo es requerido')
    .min(2, 'Nombre debe tener al menos 2 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'Solo se permiten letras'),
  
  identification_type: yup
    .string()
    .required('Tipo de identificación es requerido')
    .oneOf(['V', 'E'], 'Tipo de identificación inválido'),
  
  identification: identificationValidator,
  
  birth_date: yup
    .date()
    .required('Fecha de nacimiento es requerida')
    .max(
      new Date(new Date().setFullYear(new Date().getFullYear() - MIN_AGE)), 
      `Debe tener al menos ${MIN_AGE} años`
    )
    .typeError('Fecha inválida'),
  
  gender: yup
    .string()
    .required('Género es requerido')
    .oneOf(['M', 'F'], 'Género inválido'),
  
  email: emailValidator,
  
  phone: phoneValidator,
  
  shirt_size: yup
    .string()
    .required('Talla de camiseta es requerida')
    .oneOf(['XS', 'S', 'M', 'L', 'XL', 'XXL'], 'Talla inválida'),
  
  profile_photo_url: yup.string().nullable()
});

// Schema principal del formulario
export const registrationSchema = yup.object().shape({
  // Datos del registrante
  registrant_email: emailValidator,
  
  registrant_phone: phoneValidator,
  
  registrant_identification_type: yup
    .string()
    .required('Tipo de identificación es requerido')
    .oneOf(['V', 'E', 'J', 'P'], 'Tipo de identificación inválido'),
  
  registrant_identification: identificationValidator,
  
  // Método de pago
  payment_method: yup
    .string()
    .required('Método de pago es requerido')
    .oneOf([
      'pago_movil_p2c',
      'zelle',
      'transferencia_nacional',
      'transferencia_internacional',
      'paypal',
      'tienda'
    ], 'Método de pago inválido'),
  
  // Referencia de pago (condicional)
  payment_reference: yup.string().when('payment_method', {
    is: (val: string) => ['zelle', 'transferencia_nacional', 'transferencia_internacional', 'paypal'].includes(val),
    then: (schema) => schema.required('Referencia de pago es requerida'),
    otherwise: (schema) => schema.notRequired()
  }),
  
  // Teléfono del cliente para pago móvil (condicional)
  client_phone: yup.string().when('payment_method', {
    is: 'pago_movil_p2c',
    then: (schema) => venezuelanPhoneValidator,
    otherwise: (schema) => schema.notRequired()
  }),
  
  // Banco del cliente para pago móvil (condicional)
  client_bank: yup.string().when('payment_method', {
    is: 'pago_movil_p2c',
    then: (schema) => schema.required('Banco es requerido'),
    otherwise: (schema) => schema.notRequired()
  }),
  
  // Lista de corredores
  runners: yup
    .array()
    .of(runnerSchema)
    .min(1, 'Debe registrar al menos un corredor')
    .max(MAX_RUNNERS_PER_GROUP, `Máximo ${MAX_RUNNERS_PER_GROUP} corredores por grupo`)
    .required('Debe agregar corredores')
});

// Funciones de validación adicionales
export const validateFileUpload = (file: File): { isValid: boolean; error?: string } => {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  
  if (file.size > maxSize) {
    return { isValid: false, error: 'El archivo no debe superar 5MB' };
  }
  
  if (!validTypes.includes(file.type)) {
    return { isValid: false, error: 'Solo se aceptan imágenes (JPG, PNG) o PDF' };
  }
  
  return { isValid: true };
};

// Validador de disponibilidad de inventario
export const validateInventoryAvailability = (
  runners: Array<{ shirt_size: string; gender: string }>,
  inventory: Array<{ shirt_size: string; gender: string; available: number }>
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const requestedItems = new Map<string, number>();
  
  // Contar items solicitados
  runners.forEach(runner => {
    const key = `${runner.shirt_size}-${runner.gender}`;
    requestedItems.set(key, (requestedItems.get(key) || 0) + 1);
  });
  
  // Verificar disponibilidad
  requestedItems.forEach((count, key) => {
    const [size, gender] = key.split('-');
    const item = inventory.find(inv => inv.shirt_size === size && inv.gender === gender);
    
    if (!item || item.available < count) {
      const genderLabel = gender === 'M' ? 'Masculino' : 'Femenino';
      errors.push(`No hay suficiente inventario para talla ${size} ${genderLabel}`);
    }
  });
  
  return { isValid: errors.length === 0, errors };
};