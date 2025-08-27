import React from 'react';
import { ConcertTicket } from '../../../types';
import  { getEmailStatus }  from '../utils/ticketHelpers';

interface EmailStatusProps {
  ticket: ConcertTicket;
}

const EmailStatus: React.FC<EmailStatusProps> = ({ ticket }) => {
  const status = getEmailStatus(ticket);
  
  return (
    <div className="flex items-center">
      {status.icon}
      <span className={`ml-2 text-xs ${status.color}`}>
        {status.text}
      </span>
    </div>
  );
};

export default EmailStatus;