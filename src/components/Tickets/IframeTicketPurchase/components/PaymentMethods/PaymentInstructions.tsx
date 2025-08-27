// src/components/tickets/IframeTicketPurchase/components/PaymentMethods/PaymentInstructions.tsx

import React, { useState } from 'react';
import { Copy, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { PAYMENT_INSTRUCTIONS } from '../../constants';

interface PaymentInstructionsProps {
  method: 'transferencia_nacional' | 'zelle';
}

const PaymentInstructions: React.FC<PaymentInstructionsProps> = ({ method }) => {
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  
  const handleCopy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied({ ...copied, [key]: true });
      toast.success('Copiado al portapapeles');
      
      setTimeout(() => {
        setCopied(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (err) {
      toast.error('Error al copiar');
    }
  };
  
  const info = PAYMENT_INSTRUCTIONS[method];
  if (!info) return null;
  
  return (
    <div className="bg-gradient-to-r from-[#FD8D6A]/10 to-[#ff6b4a]/10 rounded-2xl p-6 border border-[#FD8D6A]/30">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{info.icon}</span>
        <h4 className="text-xl font-bold text-white">{info.title}</h4>
      </div>
      
      <div className="space-y-3">
        {info.data.map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <span className="text-gray-400">{item.label}:</span>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">{item.value}</span>
              {item.copyable && (
                <button
                  onClick={() => handleCopy(item.value, `${method}-${index}`)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  title="Copiar"
                >
                  {copied[`${method}-${index}`] ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {info.notes && (
        <div className="mt-4 p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
          <p className="text-sm text-yellow-300">
            ⚠️ {info.notes}
          </p>
        </div>
      )}
    </div>
  );
};

export default PaymentInstructions;