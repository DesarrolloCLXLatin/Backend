// src/components/tickets/IframeTicketPurchase/components/Confirmation/P2CConfirmationForm.tsx

import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  CheckCircle, 
  Receipt, 
  CreditCard,
  Calendar,
  Hash,
  Building,
  FileText,
  Clock,
  DollarSign
} from 'lucide-react';

interface P2CConfirmationFormProps {
  transactionId: string;
  totalPrice: number;
  totalBs: string;
  exchangeRate: number | null;
  isSubmitting: boolean;
  isEmbedded?: boolean;
  onConfirm: (reference: string) => void;
  onCancel: () => void;
  // Nuevas props para el resumen
  ticketDetails?: {
    zone_name?: string;
    quantity?: number;
    price_per_ticket?: number;
    seat_numbers?: string[];
    ticket_type?: string;
  };
  paymentDetails?: {
    commerce_phone?: string;
    commerce_bank_code?: string;
    commerce_bank_name?: string;
    commerce_rif?: string;
    invoiceNumber?: string;
    controlNumber?: string;
  };
  transactionData?: {
    authId?: string;
    terminal?: string;
    lote?: string;
    seqnum?: string;
    voucher?: string;
  };
}

const P2CConfirmationForm: React.FC<P2CConfirmationFormProps> = ({
  transactionId,
  totalPrice,
  totalBs,
  exchangeRate,
  isSubmitting,
  isEmbedded = false,
  onConfirm,
  onCancel,
  ticketDetails = {},
  paymentDetails = {},
  transactionData
}) => {
  const [reference, setReference] = useState('');
  const [showVoucher, setShowVoucher] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calcular detalles de la compra
  const quantity = ticketDetails.quantity || 1;
  const pricePerTicket = ticketDetails.price_per_ticket || totalPrice / quantity;
  const serviceFee = totalPrice * 0.05; // 5% de cargo por servicio
  const subtotal = totalPrice;
  const total = subtotal + serviceFee;
  const totalBsWithFee = ((total * (exchangeRate || 40)).toFixed(2));

  // Formatear fecha y hora
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Componente de Resumen de Compra
  const PurchaseSummarySection = () => (
    <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
      <h4 className="font-bold text-white mb-4 flex items-center gap-2">
        <Receipt className="w-5 h-5 text-orange-500" />
        Resumen de compra
      </h4>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 text-gray-400 font-medium">Descripción</th>
              <th className="text-center py-2 text-gray-400 font-medium">Cantidad</th>
              <th className="text-right py-2 text-gray-400 font-medium">P.Unit</th>
              <th className="text-right py-2 text-gray-400 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-700/50">
              <td className="py-3 text-white">
                <div>
                  <p className="font-medium">{ticketDetails.zone_name || 'ENTRADA GENERAL'}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {ticketDetails.ticket_type === 'vip' ? 'Zona VIP' : 'Zona General'}
                  </p>
                  {ticketDetails.seat_numbers && ticketDetails.seat_numbers.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Asientos: {ticketDetails.seat_numbers.join(', ')}
                    </p>
                  )}
                </div>
              </td>
              <td className="py-3 text-center text-gray-300">{quantity}</td>
              <td className="py-3 text-right text-gray-300">${pricePerTicket.toFixed(2)}</td>
              <td className="py-3 text-right text-white font-medium">${subtotal.toFixed(2)}</td>
            </tr>
            
            <tr className="border-b border-gray-700/50">
              <td className="py-3 text-white">
                <div>
                  <p className="font-medium">Servicio Web</p>
                  <p className="text-xs text-gray-400 mt-1">Cargo por procesamiento</p>
                </div>
              </td>
              <td className="py-3 text-center text-gray-300">1</td>
              <td className="py-3 text-right text-gray-300">${serviceFee.toFixed(2)}</td>
              <td className="py-3 text-right text-white font-medium">${serviceFee.toFixed(2)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-orange-500/50">
              <td colSpan={3} className="py-4 text-right font-bold text-white">
                Total USD:
              </td>
              <td className="py-4 text-right">
                <p className="text-2xl font-bold text-orange-500">${total.toFixed(2)}</p>
                {exchangeRate && (
                  <p className="text-sm text-gray-400 mt-1">≈ Bs. {totalBsWithFee}</p>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  // Componente de Voucher Electrónico
  const VoucherSection = () => (
    <div className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 backdrop-blur rounded-xl p-6 border border-purple-500/30">
      <h4 className="font-bold text-white mb-4 flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-purple-400" />
        Información del pago
      </h4>
      
      <div className="bg-gray-900/50 rounded-lg p-4 space-y-3">
        <div className="text-center mb-4 pb-4 border-b border-gray-700">
          <p className="text-sm text-gray-400">Voucher electrónico</p>
          <p className="text-lg font-bold text-white mt-1">
            {process.env.REACT_APP_COMPANY_NAME || 'EVENTOS PREMIUM'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400">RIF:</p>
            <p className="text-white font-medium">
              {paymentDetails.commerce_rif || 'J-12345678-9'}
            </p>
          </div>
          
          <div>
            <p className="text-gray-400">DUPLICADO:</p>
            <p className="text-white font-medium">CLIENTE</p>
          </div>

          <div>
            <p className="text-gray-400">BANCO:</p>
            <p className="text-white font-medium">
              {paymentDetails.commerce_bank_name || 'BANCO MERCANTIL'}
            </p>
          </div>

          <div>
            <p className="text-gray-400">PAGO MÓVIL:</p>
            <p className="text-white font-medium">
              {paymentDetails.commerce_phone || '04141234567'}
            </p>
          </div>

          <div>
            <p className="text-gray-400">CÓDIGO BANCO:</p>
            <p className="text-white font-medium">
              {paymentDetails.commerce_bank_code || '0105'}
            </p>
          </div>

          <div>
            <p className="text-gray-400">REF:</p>
            <p className="text-white font-medium text-xs">
              {transactionData?.authId || transactionId.substring(0, 12).toUpperCase()}
            </p>
          </div>

          <div>
            <p className="text-gray-400">NRO. TELÉFONO:</p>
            <p className="text-white font-medium">
              {paymentDetails.commerce_phone || '04141234567'}
            </p>
          </div>

          <div>
            <p className="text-gray-400">FECHA:</p>
            <p className="text-white font-medium">
              {formatDate(currentDateTime)} {formatTime(currentDateTime)}
            </p>
          </div>

          {transactionData?.seqnum && (
            <div>
              <p className="text-gray-400">SECUENCIA:</p>
              <p className="text-white font-medium">{transactionData.seqnum}</p>
            </div>
          )}

          <div className="col-span-2 pt-3 border-t border-gray-700">
            <p className="text-gray-400">MONTO BS.:</p>
            <p className="text-2xl font-bold text-purple-400">
              {totalBsWithFee}
            </p>
          </div>
        </div>

        {transactionData?.voucher && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
              {transactionData.voucher}
            </pre>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`${isEmbedded ? '' : 'max-w-4xl mx-auto'} relative`}>
      <div className="relative bg-gray-900/95 backdrop-blur-xl rounded-3xl border border-orange-500/20 shadow-2xl shadow-orange-500/10 p-8">
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Smartphone className="w-8 h-8 text-orange-500" />
          Complete su Pago Móvil
        </h3>

        <div className="space-y-6">
          {/* Instrucciones de Pago */}
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-6">
            <h4 className="font-bold text-white mb-4">Instrucciones de Pago:</h4>
            <ol className="space-y-3 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-orange-400 font-bold">1.</span>
                <div>
                  Realice una transferencia por <strong className="text-white">Bs. {totalBsWithFee}</strong> desde su banco
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-400 font-bold">2.</span>
                <div>
                  Use los datos del comercio mostrados en el voucher abajo
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-400 font-bold">3.</span>
                <div>
                  Ingrese la referencia de la transferencia para confirmar
                </div>
              </li>
            </ol>
          </div>

          {/* Resumen de Compra */}
          <PurchaseSummarySection />

          {/* Voucher/Información del Pago */}
          {/*{!showVoucher ? (
            <button
              onClick={() => setShowVoucher(true)}
              className="w-full py-3 bg-purple-600/20 border border-purple-500/30 rounded-xl text-purple-400 hover:bg-purple-600/30 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <FileText className="w-5 h-5" />
              Ver Voucher de Pago
            </button>
          ) : (
            <VoucherSection />
          )}*/}

          {/* Campo de Referencia */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-300">
              Referencia de la Transferencia <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value.toUpperCase())}
              placeholder="Ingrese los últimos 6 dígitos de la referencia"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all duration-300"
              maxLength={20}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && reference) {
                  onConfirm(reference);
                }
              }}
            />
            <p className="text-xs text-gray-400">
              La referencia aparece en el comprobante de su transferencia bancaria
            </p>
          </div>

          {/* Botones de Acción */}
          <div className="flex gap-4">
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-700 transition-all duration-300"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(reference)}
              disabled={isSubmitting || !reference || reference.length < 4}
              className="flex-1 px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-orange-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Confirmando con el banco...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Confirmar Pago
                </>
              )}
            </button>
          </div>

          {/* Mensaje de seguridad */}
          <div className="text-center text-xs text-gray-500">
            <p>🔒 Transacción segura procesada por el sistema bancario nacional</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default P2CConfirmationForm;