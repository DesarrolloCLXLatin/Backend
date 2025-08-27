// src/components/tickets/IframeTicketPurchase/components/common/ErrorMessage.tsx

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
  title?: string;
  message: string;
  icon?: boolean;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
  title, 
  message, 
  icon = true 
}) => {
  return (
    <div className="text-center p-8">
      {icon && (
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
      )}
      {title && (
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      )}
      <p className="text-gray-600">{message}</p>
    </div>
  );
};

export default ErrorMessage;