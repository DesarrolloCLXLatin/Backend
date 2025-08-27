// hooks/useFormValidation.ts
import { useState, useCallback } from 'react';
import { FieldErrors } from 'react-hook-form';
import { FormData, Runner, InventoryItem } from '../types';
import { validateInventoryAvailability, validateFileUpload } from '../utils/validation';

interface ValidationError {
  field: string;
  message: string;
}

interface UseFormValidationProps {
  inventory: InventoryItem[];
}

export const useFormValidation = ({ inventory }: UseFormValidationProps) => {
  const [customErrors, setCustomErrors] = useState<ValidationError[]>([]);

  // Validar disponibilidad de inventario
  const validateInventory = useCallback((runners: Runner[]): boolean => {
    if (!inventory || inventory.length === 0) return true;

    const validation = validateInventoryAvailability(runners, inventory);
    
    if (!validation.isValid) {
      setCustomErrors(validation.errors.map((error, index) => ({
        field: `inventory_${index}`,
        message: error
      })));
      return false;
    }

    return true;
  }, [inventory]);

  // Validar archivo de comprobante
  const validatePaymentFile = useCallback((file: File | null, paymentMethod: string): boolean => {
    // Solo validar si hay archivo y el método lo requiere
    const methodsRequiringProof = ['zelle', 'transferencia_nacional', 'transferencia_internacional', 'paypal'];
    
    if (!methodsRequiringProof.includes(paymentMethod)) return true;
    
    if (!file) {
      setCustomErrors([{
        field: 'payment_proof',
        message: 'El comprobante de pago es requerido para este método'
      }]);
      return false;
    }

    const validation = validateFileUpload(file);
    
    if (!validation.isValid) {
      setCustomErrors([{
        field: 'payment_proof',
        message: validation.error || 'Archivo inválido'
      }]);
      return false;
    }

    return true;
  }, []);

  // Validar que no haya duplicados de cédula
  const validateUniqueIdentifications = useCallback((runners: Runner[]): boolean => {
    const identifications = runners.map(r => `${r.identification_type}${r.identification}`);
    const uniqueIdentifications = new Set(identifications);

    if (identifications.length !== uniqueIdentifications.size) {
      const duplicates: string[] = [];
      const seen = new Set<string>();
      
      identifications.forEach((id, index) => {
        if (seen.has(id)) {
          duplicates.push(`Corredor ${index + 1}`);
        }
        seen.add(id);
      });

      setCustomErrors([{
        field: 'runners_duplicates',
        message: `Cédulas duplicadas en: ${duplicates.join(', ')}`
      }]);
      return false;
    }

    return true;
  }, []);

  // Validar edad mínima de todos los corredores
  const validateRunnersAge = useCallback((runners: Runner[]): boolean => {
    const today = new Date();
    const minAgeDate = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());
    
    const invalidAgeRunners: number[] = [];

    runners.forEach((runner, index) => {
      if (runner.birth_date) {
        const birthDate = new Date(runner.birth_date);
        if (birthDate > minAgeDate) {
          invalidAgeRunners.push(index + 1);
        }
      }
    });

    if (invalidAgeRunners.length > 0) {
      setCustomErrors([{
        field: 'runners_age',
        message: `Los siguientes corredores no cumplen la edad mínima (16 años): Corredor ${invalidAgeRunners.join(', Corredor ')}`
      }]);
      return false;
    }

    return true;
  }, []);

  // Validar coherencia de datos bancarios para P2C
  const validateP2CData = useCallback((formData: FormData): boolean => {
    if (formData.payment_method !== 'pago_movil_p2c') return true;

    const errors: ValidationError[] = [];

    // Validar que el teléfono bancario sea venezolano
    if (formData.client_phone && !formData.client_phone.match(/^04[0-9]{9}$/)) {
      errors.push({
        field: 'client_phone',
        message: 'El teléfono bancario debe ser venezolano (04XXXXXXXXX)'
      });
    }

    // Validar que se haya seleccionado un banco
    if (!formData.client_bank) {
      errors.push({
        field: 'client_bank',
        message: 'Debe seleccionar su banco'
      });
    }

    if (errors.length > 0) {
      setCustomErrors(errors);
      return false;
    }

    return true;
  }, []);

  // Función principal de validación
  const validateForm = useCallback((
    formData: FormData,
    paymentProof: File | null
  ): { isValid: boolean; errors: ValidationError[] } => {
    setCustomErrors([]); // Limpiar errores previos
    const validations: boolean[] = [];

    // Ejecutar todas las validaciones
    validations.push(validateInventory(formData.runners));
    validations.push(validatePaymentFile(paymentProof, formData.payment_method));
    validations.push(validateUniqueIdentifications(formData.runners));
    validations.push(validateRunnersAge(formData.runners));
    validations.push(validateP2CData(formData));

    const isValid = validations.every(v => v === true);

    return {
      isValid,
      errors: customErrors
    };
  }, [
    validateInventory,
    validatePaymentFile,
    validateUniqueIdentifications,
    validateRunnersAge,
    validateP2CData,
    customErrors
  ]);

  // Limpiar errores personalizados
  const clearCustomErrors = useCallback(() => {
    setCustomErrors([]);
  }, []);

  // Obtener error específico por campo
  const getFieldError = useCallback((fieldName: string): string | undefined => {
    const error = customErrors.find(e => e.field === fieldName);
    return error?.message;
  }, [customErrors]);

  // Combinar errores de react-hook-form con errores personalizados
  const mergeErrors = useCallback((
    formErrors: FieldErrors<FormData>
  ): FieldErrors<FormData> & { custom?: ValidationError[] } => {
    return {
      ...formErrors,
      custom: customErrors
    };
  }, [customErrors]);

  return {
    validateForm,
    customErrors,
    clearCustomErrors,
    getFieldError,
    mergeErrors,
    // Validaciones individuales expuestas
    validateInventory,
    validatePaymentFile,
    validateUniqueIdentifications,
    validateRunnersAge,
    validateP2CData
  };
};