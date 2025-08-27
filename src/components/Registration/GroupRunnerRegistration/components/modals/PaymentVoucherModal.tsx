//src/components/Forms/PaymentVoucherModal.tsx
import React, { useState, useEffect } from 'react';
import { 
  X, Printer, Download, CheckCircle, AlertCircle, 
  Clock, RefreshCw, Copy, Phone, Building 
} from 'lucide-react';
import { useAuth } from "../../../../../contexts/AuthContext";
import toast from 'react-hot-toast';

interface VoucherLine {
  linea: string;
}

interface PaymentDetails {
  type?: string;
  clientPhone?: string;
  clientBankCode?: string;
  clientBankName?: string;
  commercePhone?: string;
  commerceBankCode?: string;
  commerceBankName?: string;
}

interface PaymentVoucherProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: any;
  reference?: string;
  control: string;
  amount: number; // ESTO ES USD
  amountBs?: number; // NUEVO: Monto en Bolívares
  exchangeRate?: number; // NUEVO: Tasa de cambio
  paymentMethod: string;
  paymentStatus?: string;
  paymentDetails?: PaymentDetails;
  paymentId?: string;
  onStatusUpdate?: (newStatus: string) => void;
  isError?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

const PaymentVoucherModal: React.FC<PaymentVoucherProps> = ({
  isOpen,
  onClose,
  voucher,
  reference,
  control,
  amount, // USD
  amountBs, // Bs
  exchangeRate,
  paymentMethod,
  paymentStatus = 'procesando',
  paymentDetails,
  paymentId,
  onStatusUpdate,
  isError = false,
  errorCode,
  errorMessage
}) => {
  const { token } = useAuth();
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(paymentStatus);
  
  // Calcular monto en Bs si no viene explícito
  const displayAmountBs = amountBs || (amount * (exchangeRate || 37.00));

  useEffect(() => {
    setCurrentStatus(paymentStatus);
  }, [paymentStatus]);

  if (!isOpen) return null;

  const formatVoucher = (voucherData: any): string[] => {
    // Si es un string, procesarlo como antes
    if (typeof voucherData === 'string') {
      return voucherData
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/<UT>/g, '')
        .replace(/<\/UT>/g, '')
        .split('\n')
        .map(line => line.replace(/_/g, ' ').trim())
        .filter(line => line);
    }

    // Si es un objeto con propiedad 'linea' (estructura del XML)
    if (voucherData && voucherData.linea) {
      const lineas = Array.isArray(voucherData.linea) 
        ? voucherData.linea 
        : [voucherData.linea];

      return lineas.map((line: any) => {
        // Si la línea es un objeto con propiedad UT
        if (typeof line === 'object' && line.UT) {
          return line.UT.replace(/_/g, ' ').trim();
        }
        // Si es un string directo
        if (typeof line === 'string') {
          return line.replace(/_/g, ' ').trim();
        }
        return '';
      }).filter(line => line);
    }

    // Si es un array directo
    if (Array.isArray(voucherData)) {
      return voucherData.map(line => {
        if (typeof line === 'object' && line.linea) {
          return line.linea.replace(/_/g, ' ').trim();
        }
        if (typeof line === 'string') {
          return line.replace(/_/g, ' ').trim();
        }
        return '';
      }).filter(line => line);
    }

    return [];
  };

  // Procesar voucher de error - usar SIEMPRE el voucher real del gateway
  const processErrorVoucher = (): string[] => {
    // SIEMPRE intentar usar el voucher del gateway primero
    if (voucher) {
      const voucherLines = formatVoucher(voucher);
      if (voucherLines.length > 0) {
        return voucherLines;
      }
    }
    
    // Solo si NO hay voucher del gateway en absoluto, mostrar mensaje mínimo
    // Esto casi nunca debería ocurrir ya que el gateway siempre envía voucher
    return [
      'ERROR EN LA TRANSACCIÓN',
      `Código: ${errorCode || 'UNKNOWN'}`,
      `${errorMessage || 'Transacción rechazada'}`
    ];
  };

  const checkPaymentStatus = async () => {
    if (!control || isError) return;
    
    setIsCheckingStatus(true);
    try {
      const response = await fetch(`/api/payment-gateway/payment-status/${control}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentStatus(data.status);
        
        if (onStatusUpdate && data.status !== currentStatus) {
          onStatusUpdate(data.status);
        }

        // Mostrar mensaje según el estado
        if (data.status === 'confirmado') {
          toast.success('¡Pago confirmado exitosamente!');
        } else if (data.status === 'rechazado') {
          toast.error('El pago fue rechazado');
        } else if (data.status === 'pendiente_cliente') {
          toast('Esperando que el cliente complete el pago');
        } else {
          toast('El pago sigue en proceso');
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
      toast.error('Error al verificar el estado');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const voucherLines = isError ? processErrorVoucher() : formatVoucher(voucher);
    const voucherHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprobante de Pago - ${reference || control}</title>
          <style>
            body { 
              font-family: monospace; 
              padding: 20px; 
              max-width: 600px; 
              margin: 0 auto;
            }
            .header { 
              text-align: center; 
              margin-bottom: 20px; 
              padding-bottom: 10px; 
              border-bottom: 2px solid #000;
            }
            .error-section {
              background-color: #fef2f2;
              border: 1px solid #fca5a5;
              padding: 10px;
              margin: 10px 0;
              border-radius: 4px;
            }
            .details { 
              margin: 20px 0; 
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }
            .detail-item {
              margin: 5px 0;
            }
            .label { 
              font-weight: bold; 
            }
            .voucher-content { 
              background: #f5f5f5; 
              padding: 15px; 
              margin: 20px 0; 
              white-space: pre-wrap;
              border: 1px solid #ddd;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              text-align: center;
              font-size: 12px;
            }
            @media print {
              body { margin: 0; padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>COMPROBANTE DE PAGO</h2>
            <p>Fecha: ${new Date().toLocaleString('es-VE')}</p>
          </div>
          
          ${isError ? `
            <div class="error-section">
              <h3 style="color: #dc2626; margin: 0 0 10px 0;">⚠️ TRANSACCIÓN CON ERROR</h3>
              <p><strong>Código:</strong> ${errorCode || 'N/A'}</p>
              <p><strong>Descripción:</strong> ${errorMessage || 'Error no especificado'}</p>
            </div>
          ` : ''}
          
          <div class="details">
            <div class="detail-item">
              <span class="label">Control:</span> ${control}
            </div>
            <div class="detail-item">
              <span class="label">Referencia:</span> ${reference || '0'}
            </div>
            <div class="detail-item">
              <span class="label">Monto USD:</span> $${amount.toFixed(2)}
            </div>
            <div class="detail-item">
              <span class="label">Monto Bs:</span> Bs. ${displayAmountBs.toFixed(2)}
            </div>
            ${exchangeRate ? `
            <div class="detail-item">
              <span class="label">Tasa BCV:</span> ${exchangeRate.toFixed(4)}
            </div>
            ` : ''}
            <div class="detail-item">
              <span class="label">Método:</span> ${paymentMethod === 'pago_movil_p2c' ? 'Pago Móvil P2C' : paymentMethod}
            </div>
            ${paymentDetails?.type === 'p2c' ? `
              <div class="detail-item">
                <span class="label">Teléfono Cliente:</span> ${paymentDetails.clientPhone || ''}
              </div>
              <div class="detail-item">
                <span class="label">Banco Cliente:</span> ${paymentDetails.clientBankName || ''}
              </div>
              <div class="detail-item">
                <span class="label">Teléfono Comercio:</span> ${paymentDetails.commercePhone || ''}
              </div>
              <div class="detail-item">
                <span class="label">Banco Comercio:</span> ${paymentDetails.commerceBankName || ''}
              </div>
            ` : ''}
          </div>
          
          <div class="voucher-content">
            ${voucherLines.join('\n')}
          </div>
          
          <div class="footer">
            <p>Este es un comprobante de transacción electrónica</p>
            <p>Conserve este documento para futuras referencias</p>
            ${isError ? '<p style="color: #dc2626;"><strong>Esta transacción presentó errores.</strong></p>' : ''}
          </div>
          
          <script>
            window.onload = function() { 
              window.print(); 
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(voucherHtml);
    printWindow.document.close();
  };

  const handleDownload = () => {
    const voucherLines = isError ? processErrorVoucher() : formatVoucher(voucher);
    const content = [
      '='.repeat(50),
      'COMPROBANTE DE PAGO',
      '='.repeat(50),
      '',
      `Fecha: ${new Date().toLocaleString('es-VE')}`,
      `Control: ${control}`,
      `Referencia: ${reference || '0'}`,
      `Monto USD: $${amount.toFixed(2)}`,
      `Monto Bs: Bs. ${displayAmountBs.toFixed(2)}`,
      exchangeRate ? `Tasa BCV: ${exchangeRate.toFixed(4)}` : '',
      `Método: ${paymentMethod === 'pago_movil_p2c' ? 'Pago Móvil P2C' : paymentMethod}`,
      `Estado: ${getStatusLabel(currentStatus)}`,
      ...(isError ? [
        '',
        '⚠️ TRANSACCIÓN CON ERROR',
        `Código de Error: ${errorCode || 'N/A'}`,
        `Descripción: ${errorMessage || 'Error no especificado'}`,
      ] : []),
      '',
      'COMPROBANTE DEL GATEWAY:',
      '-'.repeat(30),
      ...voucherLines,
      '',
      '='.repeat(50),
      'Conserve este comprobante para futuras referencias',
      '='.repeat(50)
    ].filter(line => line !== '').join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprobante-${reference || control}-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getStatusLabel = (status: string) => {
    if (isError) return 'Error';
    
    const labels: Record<string, string> = {
      'procesando': 'Procesando',
      'pendiente_cliente': 'Esperando pago del cliente',
      'pendiente': 'Pendiente de confirmación',
      'confirmado': 'Confirmado',
      'rechazado': 'Rechazado',
      'fallido': 'Fallido'
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status: string) => {
    if (isError) {
      return <AlertCircle className="w-6 h-6 text-red-600" />;
    }
    
    switch (status) {
      case 'confirmado':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'rechazado':
      case 'fallido':
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      default:
        return <Clock className="w-6 h-6 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    if (isError) {
      return 'bg-red-50';
    }
    
    switch (status) {
      case 'confirmado':
        return 'bg-green-50';
      case 'rechazado':
      case 'fallido':
        return 'bg-red-50';
      default:
        return 'bg-yellow-50';
    }
  };

  const getStatusMessage = () => {
    if (isError) {
      return errorMessage || 'La transacción presentó errores durante el procesamiento.';
    }

    switch (currentStatus) {
      case 'pendiente_cliente':
        return 'El cliente debe completar el pago móvil con los datos proporcionados.';
      case 'procesando':
        return 'Su transacción está siendo procesada por el banco.';
      case 'pendiente':
        return 'Su pago está pendiente de confirmación manual. Esto puede tomar 24-48 horas.';
      case 'confirmado':
        return 'Su pago ha sido confirmado exitosamente.';
      case 'rechazado':
        return 'Su pago fue rechazado. Por favor, intente nuevamente o contacte soporte.';
      default:
        return 'Estado de la transacción desconocido.';
    }
  };

  const voucherLines = isError ? processErrorVoucher() : formatVoucher(voucher);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[95vh] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gray-50">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              Comprobante de Pago
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {new Date().toLocaleString('es-VE')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-200 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-200px)]">
          {/* Status Alert */}
          <div className={`mb-6 p-4 rounded-lg flex items-start ${getStatusColor(currentStatus)}`}>
            {getStatusIcon(currentStatus)}
            <div className="ml-3 flex-1">
              <p className="font-medium text-gray-900">
                Estado: {getStatusLabel(currentStatus)}
              </p>
              <p className="text-sm text-gray-700 mt-1">
                {getStatusMessage()}
              </p>
            </div>
          </div>

          {/* Detalles de error si aplica */}
          {isError && (
            <div className="mb-6">
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <h4 className="font-medium text-red-900 mb-3">Información del Error</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {errorCode && (
                    <div>
                      <p className="text-red-600">Código de Error:</p>
                      <p className="font-mono font-medium text-red-900">{errorCode}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-red-600">Descripción:</p>
                    <p className="font-medium text-red-900">{errorMessage || 'Error no especificado'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transaction Details */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">Detalles de la Transacción</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Número de Control</p>
                <div className="flex items-center mt-1">
                  <p className="font-mono font-medium text-gray-900">{control}</p>
                  <button
                    onClick={() => copyToClipboard(control)}
                    className="ml-2 text-gray-400 hover:text-gray-600"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Referencia</p>
                <div className="flex items-center mt-1">
                  <p className="font-mono font-medium text-gray-900">{reference || '0'}</p>
                  {reference && reference !== '0' && (
                    <button
                      onClick={() => copyToClipboard(reference)}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Monto en USD</p>
                <p className="font-semibold text-gray-900 text-lg mt-1">
                  ${amount.toFixed(2)}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Monto en Bolívares</p>
                <p className="font-semibold text-gray-900 text-lg mt-1">
                  Bs. {displayAmountBs.toFixed(2)}
                </p>
              </div>
              
              {exchangeRate && (
                <div>
                  <p className="text-sm text-gray-600">Tasa BCV</p>
                  <p className="font-medium text-gray-900 mt-1">
                    {exchangeRate.toFixed(4)}
                  </p>
                </div>
              )}
              
              <div>
                <p className="text-sm text-gray-600">Método de Pago</p>
                <p className="font-medium text-gray-900 mt-1">
                  {paymentMethod === 'pago_movil_p2c' ? 'Pago Móvil P2C' : paymentMethod}
                </p>
              </div>
            </div>
          </div>

          {/* P2C Payment Details */}
          {paymentDetails?.type === 'p2c' && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <Phone className="w-4 h-4 mr-2" />
                Datos del Pago Móvil P2C
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-orange-50 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Cliente</p>
                  <p className="font-medium text-gray-900 flex items-center mt-1">
                    <Phone className="w-4 h-4 mr-1 text-gray-500" />
                    {paymentDetails.clientPhone}
                  </p>
                  <p className="text-sm text-gray-700 flex items-center">
                    <Building className="w-4 h-4 mr-1 text-gray-500" />
                    {paymentDetails.clientBankName}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Comercio (Destino)</p>
                  <p className="font-medium text-gray-900 flex items-center mt-1">
                    <Phone className="w-4 h-4 mr-1 text-gray-500" />
                    {paymentDetails.commercePhone}
                  </p>
                  <p className="text-sm text-gray-700 flex items-center">
                    <Building className="w-4 h-4 mr-1 text-gray-500" />
                    {paymentDetails.commerceBankName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Voucher Text */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">Comprobante del Banco</h4>
            <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-xs overflow-x-auto">
              <pre className="whitespace-pre-wrap">
                {voucherLines.map((line, index) => (
                  <div 
                    key={index} 
                    className={`${
                      line.includes('ERROR') || 
                      line.includes('RECHAZADO') || 
                      line.includes('FALLIDO') ||
                      line.includes('TRANSACCION FALLIDA') ||
                      line.includes('================================') 
                        ? 'text-red-400' 
                        : 'text-green-300'
                    }`}
                  >
                    {line || '\u00A0'}
                  </div>
                ))}
              </pre>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {isError 
                ? 'Este comprobante muestra los detalles del error reportado por el gateway de pago.'
                : 'Este comprobante confirma que la transacción fue procesada por el gateway de pago.'
              }
            </div>
          </div>

          {/* Instructions based on status */}
          {!isError && currentStatus === 'pendiente_cliente' && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h5 className="font-medium text-amber-900 mb-2">
                Instrucciones para el Cliente:
              </h5>
              <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
                <li>Ingrese a su banca móvil o en línea</li>
                <li>Seleccione la opción "Pago Móvil P2C"</li>
                <li>Ingrese el teléfono del comercio: <strong>{paymentDetails?.commercePhone}</strong></li>
                <li>Seleccione el banco: <strong>{paymentDetails?.commerceBankName}</strong></li>
                <li>Ingrese el monto exacto: <strong>Bs. {displayAmountBs.toFixed(2)}</strong></li>
                <li>Complete la transacción</li>
              </ol>
              <p className="text-xs text-amber-700 mt-2">
                El pago debe completarse en los próximos 30 minutos.
              </p>
            </div>
          )}

          {/* Instrucciones para casos de error */}
          {isError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h5 className="font-medium text-red-900 mb-2">
                ¿Qué hacer ahora?
              </h5>
              <div className="text-sm text-red-800 space-y-2">
                <div className="flex items-start">
                  <span className="font-medium mr-1">•</span>
                  <span>Verifique los datos ingresados y vuelva a intentar</span>
                </div>
                <div className="flex items-start">
                  <span className="font-medium mr-1">•</span>
                  <span>Si el error persiste, contacte al soporte técnico</span>
                </div>
                <div className="flex items-start">
                  <span className="font-medium mr-1">•</span>
                  <span>Conserve este comprobante para referencia</span>
                </div>
                
                {/* Instrucciones específicas por código de error */}
                {errorCode === 'PB' && (
                  <div className="bg-red-100 p-2 rounded mt-2">
                    <span className="font-medium">⚠️ Transacciones no encontradas - verifique los datos del pago móvil</span>
                  </div>
                )}
                {errorCode === 'PT' && (
                  <div className="bg-red-100 p-2 rounded mt-2">
                    <span className="font-medium">⚠️ Banco destino no configurado - intente con otro banco</span>
                  </div>
                )}
                {errorCode === 'P3' && (
                  <div className="bg-red-100 p-2 rounded mt-2">
                    <span className="font-medium">⚠️ No se pudo verificar el débito - verifique saldo disponible</span>
                  </div>
                )}
                {errorCode === 'R1' && (
                  <div className="bg-red-100 p-2 rounded mt-2">
                    <span className="font-medium">⚠️ Datos inválidos - verifique teléfono y banco</span>
                  </div>
                )}
                {errorCode === 'COMM_ERROR' && (
                  <div className="bg-red-100 p-2 rounded mt-2">
                    <span className="font-medium">⚠️ Error de comunicación - intente nuevamente en unos minutos</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-center p-6 border-t bg-gray-50 space-y-3 sm:space-y-0">
          <button
            onClick={checkPaymentStatus}
            disabled={isCheckingStatus || isError}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-orange-700 bg-white border border-orange-300 rounded-md hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isCheckingStatus ? 'animate-spin' : ''}`} />
            {isCheckingStatus ? 'Verificando...' : 'Verificar Estado'}
          </button>
          
          <div className="flex space-x-3 w-full sm:w-auto">
            <button
              onClick={handleDownload}
              className="flex-1 sm:flex-initial px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors flex items-center justify-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Descargar
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-initial px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors flex items-center justify-center"
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentVoucherModal;