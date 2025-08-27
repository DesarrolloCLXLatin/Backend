// components/modals/RegistrationConfirmationModal.tsx
import React from 'react';
import { X, User, CreditCard, Users, CheckCircle, AlertTriangle, DollarSign, Clock, Gift, Store } from 'lucide-react';
import { FormData, Bank } from '../../types';
import { PRICE_USD } from '../../constants';

// Interfaz para la configuración del método de pago
interface PaymentMethodConfig {
  display_name: string;
  requires_proof: boolean;
  auto_confirm: boolean;
  isStoreMethod?: boolean;
  isGift?: boolean;
  isOnlineOnly?: boolean;
}

interface RegistrationConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  formData: FormData;
  banks: Bank[];
  exchangeRate: number | null;
  paymentProof: File | null;
  isSubmitting: boolean;
  paymentMethodConfig?: PaymentMethodConfig;
}

export const RegistrationConfirmationModal: React.FC<RegistrationConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  formData,
  banks,
  exchangeRate,
  paymentProof,
  isSubmitting,
  paymentMethodConfig
}) => {
  if (!isOpen) return null;

  const totalUSD = formData.runners.length * PRICE_USD;
  const totalBs = exchangeRate ? totalUSD * exchangeRate : null;
  const selectedBank = banks.find(b => b.code === formData.client_bank);

  const getPaymentMethodIcon = () => {
    if (paymentMethodConfig?.isGift) return <Gift className="w-5 h-5 text-green-600" />;
    if (paymentMethodConfig?.isStoreMethod) return <Store className="w-5 h-5 text-blue-600" />;
    return <CreditCard className="w-5 h-5 text-orange-600" />;
  };

  const getConfirmationMessage = () => {
    if (paymentMethodConfig?.isGift) {
      return {
        type: 'gift',
        title: 'Registro de Obsequio',
        message: 'Este registro será procesado como obsequio exonerado',
        icon: <Gift className="w-6 h-6 text-green-600" />
      };
    }
    
    if (paymentMethodConfig?.auto_confirm) {
      return {
        type: 'auto',
        title: 'Confirmación Automática',
        message: 'Su registro será confirmado inmediatamente',
        icon: <CheckCircle className="w-6 h-6 text-green-600" />
      };
    }
    
    return {
      type: 'manual',
      title: 'Verificación Manual',
      message: 'Su registro será verificado en las próximas 24-48 horas',
      icon: <Clock className="w-6 h-6 text-yellow-600" />
    };
  };

  const confirmationInfo = getConfirmationMessage();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <CheckCircle className="w-6 h-6 text-orange-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">
              Confirmar Registro - CLX Night Run 2025
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Mensaje de confirmación */}
          <div className={`p-4 rounded-lg border ${
            confirmationInfo.type === 'gift' ? 'bg-green-50 border-green-200' :
            confirmationInfo.type === 'auto' ? 'bg-green-50 border-green-200' :
            'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center">
              {confirmationInfo.icon}
              <div className="ml-3">
                <h3 className="font-semibold text-gray-900">{confirmationInfo.title}</h3>
                <p className="text-sm text-gray-600">{confirmationInfo.message}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Información del Registrante */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <User className="w-5 h-5 mr-2 text-orange-600" />
                Datos del Registrante
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium text-gray-900">{formData.registrant_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Teléfono:</span>
                  <span className="font-medium text-gray-900">{formData.registrant_phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cédula:</span>
                  <span className="font-medium text-gray-900">
                    {formData.registrant_identification_type}{formData.registrant_identification}
                  </span>
                </div>
              </div>
            </div>

            {/* Información de Pago */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                {getPaymentMethodIcon()}
                <span className="ml-2">Información de Pago</span>
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Método:</span>
                  <span className="font-medium text-gray-900">
                    {paymentMethodConfig?.display_name || formData.payment_method}
                  </span>
                </div>
                
                {formData.payment_method === 'pago_movil_p2c' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Teléfono bancario:</span>
                      <span className="font-medium text-gray-900">{formData.client_phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Banco:</span>
                      <span className="font-medium text-gray-900">{selectedBank?.name}</span>
                    </div>
                  </>
                )}

                {formData.payment_reference && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Referencia:</span>
                    <span className="font-medium text-gray-900">{formData.payment_reference}</span>
                  </div>
                )}

                {formData.terminal_reference && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Terminal:</span>
                    <span className="font-medium text-gray-900">{formData.terminal_reference}</span>
                  </div>
                )}

                {paymentProof && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Comprobante:</span>
                    <span className="font-medium text-gray-900 flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
                      {paymentProof.name}
                    </span>
                  </div>
                )}

                {/* Campos especiales para obsequio */}
                {formData.payment_method === 'obsequio_exonerado' && (
                  <>
                    {formData.employee_id && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">ID Empleado:</span>
                        <span className="font-medium text-gray-900">{formData.employee_id}</span>
                      </div>
                    )}
                    {formData.gift_reason && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Motivo:</span>
                        <span className="font-medium text-gray-900">{formData.gift_reason}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Lista de Corredores */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Users className="w-5 h-5 mr-2 text-orange-600" />
              Corredores Registrados ({formData.runners.length})
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="space-y-3">
                {formData.runners.map((runner, index) => (
                  <div key={index} className="bg-white p-3 rounded border border-gray-200">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Nombre:</span>
                        <p className="font-medium text-gray-900">{runner.full_name}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Cédula:</span>
                        <p className="font-medium text-gray-900">
                          {runner.identification_type}{runner.identification}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Edad:</span>
                        <p className="font-medium text-gray-900">
                          {runner.birth_date ? calculateAge(runner.birth_date) : 'N/A'} años
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Talla:</span>
                        <p className="font-medium text-gray-900">
                          {runner.shirt_size} ({runner.gender === 'M' ? 'Masculino' : 'Femenino'})
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resumen de Costos */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-orange-600" />
              Resumen de Costos
            </h3>
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Corredores:</span>
                  <span className="font-medium text-gray-900">{formData.runners.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Precio por corredor:</span>
                  <span className="font-medium text-gray-900">${PRICE_USD} USD</span>
                </div>
                <div className="border-t border-orange-200 pt-2">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-gray-900">Total USD:</span>
                    <span className="text-xl font-bold text-orange-600">${totalUSD}</span>
                  </div>
                  {totalBs && formData.payment_method !== 'obsequio_exonerado' && (
                    <div className="flex justify-between mt-1">
                      <span className="text-lg font-semibold text-gray-900">Total Bs:</span>
                      <span className="text-xl font-bold text-orange-600">Bs. {totalBs.toFixed(2)}</span>
                    </div>
                  )}
                  {exchangeRate && (
                    <div className="text-sm text-gray-600 text-right mt-1">
                      Tasa BCV: {exchangeRate.toFixed(4)}
                    </div>
                  )}
                  {formData.payment_method === 'obsequio_exonerado' && (
                    <div className="text-sm text-green-600 text-right mt-1 flex items-center justify-end">
                      <Gift className="w-4 h-4 mr-1" />
                      Registro exonerado
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Advertencias según el método de pago */}
          {!paymentMethodConfig?.auto_confirm && !paymentMethodConfig?.isGift && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Importante:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Su registro será verificado manualmente</li>
                    <li>Recibirá una confirmación por email en las próximas 24-48 horas</li>
                    <li>Conserve el comprobante de pago para cualquier consulta</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-4 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Revisar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-6 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Procesando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmar Registro
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Función auxiliar para calcular la edad
const calculateAge = (birthDate: string): number => {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
};