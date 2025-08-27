// src/components/tickets/IframeTicketPurchase/components/common/LoadingSpinner.tsx

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  color = 'border-white',
  text 
}) => {
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8',
    large: 'h-12 w-12'
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`animate-spin rounded-full border-b-2 ${color} ${sizeClasses[size]}`} />
      {text && <p className="text-gray-300 text-sm">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;