// components/PaymentSection.tsx
import React, { useMemo } from 'react';
import { UseFormRegister, FieldErrors, UseFormWatch } from 'react-hook-form';
import { CreditCard, Upload, CheckCircle, X, AlertCircle, FileText, Image, Gift, Store, Shield } from 'lucide-react';
import { FormData, Bank } from '../types';
import { FormField } from '../../shared/FormField';
import { PaymentMethodFields } from './PaymentMethodFields';
import { StorePaymentFields } from './StorePaymentFields';
import { GiftPaymentFields } from './GiftPaymentFields';
import { FILE_UPLOAD_CONFIG, MESSAGES } from '../constants';
import { usePaymentMethods } from '../hooks/usePaymentMethods';

interface PaymentSectionProps {
  register: UseFormRegister<FormData>;
  errors: FieldErrors<FormData>;
  watch: UseFormWatch<FormData>;
  banks: Bank[];
  paymentProof: File | null;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  tokenType?: 'public_token' | 'seller_token' | null; // NUEVO
  isEmbedded?: boolean; // NUEVO
}

export const PaymentSection: React.FC<PaymentSectionProps> = ({
  register,
  errors,
  watch,
  banks,
  paymentProof,
  onFileUpload,
  onRemoveFile,
  tokenType,
  isEmbedded
}) => {
  const paymentMethod = watch('payment_method');
  const { paymentMethods, isLoading, userRole } = usePaymentMethods({
    tokenType,
    isEmbedded
  });

  // Obtener configuración del método seleccionado
  const selectedMethodConfig = useMemo(() => {
    return paymentMethods.find(m => m.payment_method === paymentMethod);
  }, [paymentMethod, paymentMethods]);

  // Determinar qué campos mostrar
  const showManualPaymentFields = selectedMethodConfig?.requires_proof && 
    !['pago_movil_p2c'].includes(paymentMethod);
  
  const showStoreFields = selectedMethodConfig?.isStoreMethod || 
    ['tarjeta_debito', 'tarjeta_credito', 'efectivo_bs', 'efectivo_usd'].includes(paymentMethod);
  
  const showGiftFields = paymentMethod === 'obsequio_exonerado';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-orange-400 border-b border-orange-200 pb-2">
        Información de Pago
      </h3>
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-orange-400 border-b border-orange-200 pb-2">
        Información de Pago
      </h3>

      {/* Mensaje para tokens públicos */}
      {tokenType === 'public_token' && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-sm text-blue-700">
            <Shield className="w-4 h-4 inline mr-1" />
            Solo métodos de pago online disponibles para compras públicas
          </p>
        </div>
      )}
      
      {/* Mostrar rol del usuario si es especial */}
      {userRole !== 'usuario' && userRole !== 'guest' && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-sm text-blue-700">
            {userRole === 'admin' && '👨‍💼 Modo Administrador - Todos los métodos disponibles'}
            {userRole === 'tienda' && '🏪 Modo Tienda - Confirmación inmediata'}
            {userRole === 'boss' && '🎁 Modo RRHH - Registro de obsequios'}
          </p>
        </div>
      )}
      
      <FormField
        label="Método de Pago"
        error={errors.payment_method}
        required
      >
        <select
          {...register('payment_method')}
          className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          {paymentMethods.map(method => (
            <option key={method.payment_method} value={method.payment_method}>
              {method.display_name}
              {method.isGift && ' 🎁'}
              {method.isStoreMethod && ' 🏪'}
            </option>
          ))}
        </select>
      </FormField>

      {/* Mensaje informativo según el método */}
      {selectedMethodConfig && (
        <PaymentMethodInfo 
          method={selectedMethodConfig} 
          userRole={userRole}
        />
      )}

      {/* Campos para Obsequio Exonerado */}
      {showGiftFields && (
        <GiftPaymentFields
          register={register}
          errors={errors}
        />
      )}

      {/* Campos para métodos de tienda */}
      {showStoreFields && !showGiftFields && (
        <StorePaymentFields
          register={register}
          errors={errors}
          paymentMethod={paymentMethod}
        />
      )}

      {/* Campos específicos según método de pago (P2C) */}
      {paymentMethod === 'pago_movil_p2c' && (
        <PaymentMethodFields
          paymentMethod={paymentMethod}
          register={register}
          errors={errors}
          watch={watch}
          banks={banks}
        />
      )}

      {/* Campos para pagos manuales */}
      {showManualPaymentFields && (
        <ManualPaymentFields
          register={register}
          errors={errors}
          paymentProof={paymentProof}
          onFileUpload={onFileUpload}
          onRemoveFile={onRemoveFile}
          requiresReference={selectedMethodConfig?.requires_reference}
        />
      )}
    </div>
  );
};

// Componente para mostrar información del método
const PaymentMethodInfo: React.FC<{ 
  method: any; 
  userRole: string;
}> = ({ method, userRole }) => {
  if (method.payment_method === 'obsequio_exonerado') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-md p-3">
        <div className="flex items-start">
          <Gift className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-700">
            <p className="font-semibold">Registro de Obsequio</p>
            <p>Este registro será exonerado de pago. Se deducirá del inventario pero no generará cobro.</p>
          </div>
        </div>
      </div>
    );
  }

  if (method.isStoreMethod) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <div className="flex items-start">
          <Store className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-semibold">Pago en Tienda</p>
            <p>Confirmación inmediata al recibir el pago presencial.</p>
          </div>
        </div>
      </div>
    );
  }

  if (method.auto_confirm && method.payment_method !== 'pago_movil_p2c') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-md p-3">
        <CheckCircle className="w-4 h-4 text-green-600 inline mr-1" />
        <span className="text-sm text-green-700">
          Confirmación automática
        </span>
      </div>
    );
  }

  return null;
};

// Actualizar ManualPaymentFields para hacer la referencia opcional según configuración
interface ManualPaymentFieldsProps {
  register: UseFormRegister<FormData>;
  errors: FieldErrors<FormData>;
  paymentProof: File | null;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  requiresReference?: boolean;
}

const ManualPaymentFields: React.FC<ManualPaymentFieldsProps> = ({
  register,
  errors,
  paymentProof,
  onFileUpload,
  onRemoveFile,
  requiresReference = true
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño
    if (file.size > FILE_UPLOAD_CONFIG.maxSize) {
      alert(MESSAGES.errors.fileSize);
      return;
    }

    // Validar tipo
    if (!FILE_UPLOAD_CONFIG.acceptedTypes.includes(file.type)) {
      alert(MESSAGES.errors.fileType);
      return;
    }

    onFileUpload(e);
  };

  const getFileIcon = () => {
    if (!paymentProof) return null;
    
    if (paymentProof.type === 'application/pdf') {
      return <FileText className="w-4 h-4 mr-1 text-red-500" />;
    }
    return <Image className="w-4 h-4 mr-1 text-blue-500" />;
  };

  return (
    <div className="space-y-4 p-4 bg-orange-50 rounded-md">
      <div className="flex items-start">
        <AlertCircle className="w-5 h-5 text-orange-500 mr-2 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-orange-700">
          <p className="font-semibold mb-1">Información importante:</p>
          <ul className="list-disc list-inside space-y-1 text-orange-600">
            <li>Sube una imagen clara del comprobante de pago</li>
            <li>Asegúrate de que se vea el número de referencia</li>
            <li>El pago será verificado manualmente en las próximas 24-48 horas</li>
          </ul>
        </div>
      </div>

      {requiresReference && (
        <FormField
          label="Referencia del Pago"
          error={errors.payment_reference}
          required
        >
          <input
            {...register('payment_reference', {
              required: requiresReference ? 'La referencia del pago es requerida' : false
            })}
            type="text"
            placeholder="Número de confirmación o referencia"
            className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </FormField>
      )}

      <div>
        <label className="block text-sm font-medium text-orange-400 mb-1">
          Comprobante de Pago <span className="text-red-500">*</span>
        </label>
        <div className="mt-1">
          <label className="w-full flex items-center justify-center px-4 py-2 border-2 border-dashed border-orange-300 rounded-md shadow-sm text-sm font-medium text-orange-400 bg-white hover:bg-orange-50 cursor-pointer transition-colors">
            <Upload className="w-5 h-5 mr-2" />
            {paymentProof ? 'Cambiar archivo' : 'Subir comprobante'}
            <input
              type="file"
              className="hidden"
              accept={FILE_UPLOAD_CONFIG.acceptedExtensions}
              onChange={handleFileChange}
              required={!paymentProof}
            />
          </label>
        </div>
        
        {paymentProof && (
          <div className="mt-2 flex items-center justify-between text-sm text-orange-400 bg-orange-100 p-3 rounded">
            <div className="flex items-center">
              {getFileIcon()}
              <span className="truncate max-w-xs font-medium">{paymentProof.name}</span>
              <span className="ml-2 text-xs text-orange-500">
                ({(paymentProof.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
            <button
              type="button"
              onClick={onRemoveFile}
              className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded transition-colors"
              aria-label="Eliminar archivo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        
        <p className="mt-1 text-xs text-orange-500">
          Formatos aceptados: JPG, PNG, PDF (máx. 5MB)
        </p>
      </div>
    </div>
  );
};