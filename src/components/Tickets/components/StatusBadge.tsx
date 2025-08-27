import React from 'react';
import { getStatusIcon, getStatusColor } from '../utils/ticketHelpers';

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(status)}`}>
      {getStatusIcon(status)}
      <span className="ml-1 capitalize">{status}</span>
    </span>
  );
};

export default StatusBadge;