import React from 'react';
import { CheckCircle, Mail, QrCode } from 'lucide-react';
import { IframeTicketPurchaseForm } from '../IframeTicketPurchase';
import toast from 'react-hot-toast';

interface SellSectionProps {
  onSuccess: () => void;
}

const SellSection: React.FC<SellSectionProps> = ({ onSuccess }) => {
  const handleTicketSale = (newTicketData: any) => {
    const successMessage = newTicketData?.payment_method === 'pago_movil' 
      ? '🎉 ¡Pago confirmado inmediatamente! Email enviado al comprador'
      : '🎉 ¡Venta exitosa! Email enviado al comprador';

    toast.success(successMessage, { duration: 5000 });
    
    // Refrescar datos después de la venta
    setTimeout(onSuccess, 500);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Punto de Venta de Entradas
        </h2>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center">
            <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
            Confirmación instantánea con Pago Móvil
          </span>
          <span className="flex items-center">
            <Mail className="w-4 h-4 text-blue-500 mr-1" />
            Emails automáticos
          </span>
          <span className="flex items-center">
            <QrCode className="w-4 h-4 text-orange-500 mr-1" />
            QR y códigos de barras
          </span>
        </div>
      </div>
      
      <IframeTicketPurchaseForm 
        isEmbedded={false}
        token={null}
        onSuccess={handleTicketSale}
      />
    </div>
  );
};

export default SellSection;