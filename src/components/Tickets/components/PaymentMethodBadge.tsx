import React from 'react';
import { getPaymentMethodIcon, getPaymentMethodLabel, getMethodColor } from '../utils/ticketHelpers';

interface PaymentMethodBadgeProps {
  method: string;
}

const PaymentMethodBadge: React.FC<PaymentMethodBadgeProps> = ({ method }) => {
  // Get the icon component (not JSX, just the component reference)
  const Icon = getPaymentMethodIcon(method);
  
  return (
    <div className="flex items-center">
      {/* Render the Icon as a React component with <Icon /> */}
      <Icon className="w-4 h-4" />
      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getMethodColor(method)}`}>
        {getPaymentMethodLabel(method)}
      </span>
    </div>
  );
};

export default PaymentMethodBadge;