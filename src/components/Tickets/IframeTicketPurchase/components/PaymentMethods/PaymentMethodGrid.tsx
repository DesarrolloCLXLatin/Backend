// src/components/tickets/IframeTicketPurchase/components/PaymentMethods/PaymentMethodGrid.tsx

import React from 'react';
import { Smartphone, Building, DollarSign, CreditCard } from 'lucide-react';

interface PaymentMethodGridProps {
  selectedMethod: string;
  onSelectMethod: (method: string) => void;
}

const PaymentMethodGrid: React.FC<PaymentMethodGridProps> = ({ 
  selectedMethod, 
  onSelectMethod 
}) => {
  const methods = [
    {
      value: 'pago_movil',
      icon: <Smartphone className="w-8 h-8 mb-2 mx-auto text-orange-400" />,
      title: 'Pago Móvil P2C',
      description: 'Instantáneo'
    },
    {
      value: 'transferencia_nacional',
      icon: <Building className="w-8 h-8 mb-2 mx-auto text-blue-400" />,
      title: 'Transferencia Nacional',
      description: 'Validación en 24h'
    },
    {
      value: 'zelle',
      icon: <DollarSign className="w-8 h-8 mb-2 mx-auto text-green-400" />,
      title: 'Zelle',
      description: 'Validación en 24h'
    },
    {
      value: 'paypal',
      icon: <CreditCard className="w-8 h-8 mb-2 mx-auto text-purple-400" />,
      title: 'PayPal',
      description: 'Instantáneo'
    }
  ];

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium text-gray-300">
        Seleccione su método de pago
      </label>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {methods.map((method) => (
          <button
            key={method.value}
            type="button"
            onClick={() => onSelectMethod(method.value)}
            className={`
              p-6 rounded-2xl border-2 transition-all duration-300 transform text-center
              ${selectedMethod === method.value
                ? 'border-[#FD8D6A] bg-gradient-to-br from-[#FD8D6A]/20 to-orange-500/20 scale-105 shadow-lg shadow-[#FD8D6A]/30'
                : 'border-gray-700 bg-gray-800 hover:border-gray-600 hover:scale-105'
              }
            `}
          >
            {method.icon}
            <h4 className="font-bold text-white">{method.title}</h4>
            <p className="text-sm text-gray-400">{method.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default PaymentMethodGrid;