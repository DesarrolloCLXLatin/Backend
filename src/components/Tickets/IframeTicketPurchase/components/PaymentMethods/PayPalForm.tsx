// src/components/tickets/IframeTicketPurchase/components/PaymentMethods/PayPalForm.tsx

import React from 'react';
import { CreditCard } from 'lucide-react';
import { PaymentFormProps } from '../../types';

const PayPalForm: React.FC<PaymentFormProps> = ({ 
  data, 
  onChange, 
  errors 
}) => {
  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
        <p className="text-sm text-purple-300 flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          Pago seguro con PayPal
        </p>
      </div>

      <div className="p-6 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl border border-purple-500/30">
        <h4 className="font-bold text-white mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-purple-400" />
          ¿Cómo funciona PayPal?
        </h4>
        <ol className="space-y-2 text-gray-300 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-purple-400 font-bold">1.</span>
            <span>Al hacer clic en "Pagar con PayPal", será redirigido a PayPal</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 font-bold">2.</span>
            <span>Inicie sesión en su cuenta PayPal</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 font-bold">3.</span>
            <span>Complete el pago de forma segura</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 font-bold">4.</span>
            <span>Recibirá sus entradas instantáneamente por email</span>
          </li>
        </ol>
      </div>
    </div>
  );
};

export default PayPalForm;