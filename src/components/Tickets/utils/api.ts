import { ConcertTicket, TicketInventory, PaymentTransaction } from '../../../types';
import { FilterState } from '../types';

const API_BASE = '/api/tickets';

export const fetchAllTickets = async (
  token: string, 
  filters: FilterState
): Promise<ConcertTicket[]> => {
  const response = await fetch(`${API_BASE}/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error('Failed to fetch tickets');
  
  const data = await response.json();
  let tickets = data.tickets || data || [];
  
  // Apply filters
  if (filters.status !== 'all') {
    tickets = tickets.filter((ticket: ConcertTicket) => 
      ticket.payment_status === filters.status
    );
  }
  
  if (filters.search) {
    tickets = tickets.filter((ticket: ConcertTicket) =>
      ticket.ticket_number.toLowerCase().includes(filters.search.toLowerCase()) ||
      ticket.buyer_name.toLowerCase().includes(filters.search.toLowerCase()) ||
      ticket.buyer_email.toLowerCase().includes(filters.search.toLowerCase())
    );
  }
  
  return tickets;
};

export const fetchStoreTickets = async (
  token: string,
  filters: FilterState
): Promise<ConcertTicket[]> => {
  const response = await fetch(`${API_BASE}/store`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error('Failed to fetch store tickets');
  
  const data = await response.json();
  let tickets = data.recentTickets || [];
  
  // Apply filters
  if (filters.status !== 'all') {
    tickets = tickets.filter((ticket: ConcertTicket) => 
      ticket.payment_status === filters.status
    );
  }
  
  if (filters.search) {
    tickets = tickets.filter((ticket: ConcertTicket) =>
      ticket.ticket_number.toLowerCase().includes(filters.search.toLowerCase()) ||
      ticket.buyer_name.toLowerCase().includes(filters.search.toLowerCase()) ||
      ticket.buyer_email.toLowerCase().includes(filters.search.toLowerCase())
    );
  }
  
  return tickets;
};

export const fetchMyTickets = async (
  token: string,
  filters: FilterState
): Promise<ConcertTicket[]> => {
  const response = await fetch(`${API_BASE}/my-tickets`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error('Failed to fetch my tickets');
  
  const data = await response.json();
  let tickets = data.tickets || [];
  
  // Apply filters
  if (filters.status !== 'all') {
    tickets = tickets.filter((ticket: ConcertTicket) => 
      ticket.payment_status === filters.status
    );
  }
  
  if (filters.search) {
    tickets = tickets.filter((ticket: ConcertTicket) =>
      ticket.ticket_number.toLowerCase().includes(filters.search.toLowerCase())
    );
  }
  
  return tickets;
};

export const fetchInventory = async (token: string): Promise<TicketInventory | null> => {
  try {
    const response = await fetch(`${API_BASE}/inventory`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return null;
  }
};

export const fetchVenueStatistics = async (token: string): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE}/stats`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching venue stats:', error);
    return null;
  }
};

export const fetchPendingValidations = async (token: string) => {
  try {
    const [manualResponse, iframeResponse] = await Promise.all([
      fetch(`${API_BASE}/pending-validations`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      }),
      fetch(`${API_BASE}/manual/pending-iframe-payments`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      })
    ]);

    let validations: PaymentTransaction[] = [];
    let count = 0;

    if (manualResponse.ok) {
      const manualData = await manualResponse.json();
      if (manualData.success) {
        validations = manualData.data || manualData.pendingValidations || [];
      } else if (Array.isArray(manualData)) {
        validations = manualData;
      }
    }

    if (iframeResponse.ok) {
      const iframeData = await iframeResponse.json();
      if (iframeData.success) {
        const iframePayments = iframeData.pendingPayments.map((payment: any) => ({
          ...payment,
          id: payment.id,
          type: 'iframe',
          user_name: payment.buyer_name,
          user_email: payment.buyer_email,
          reference_number: payment.payment_reference,
          amount_usd: payment.total_price,
          ticket_count: payment.quantity || 1
        }));
        validations = [...validations, ...iframePayments];
      }
    }

    count = validations.length;

    return { validations, count };
  } catch (error) {
    console.error('Error fetching pending validations:', error);
    return { validations: [], count: 0 };
  }
};

export const confirmPayment = async (
  token: string,
  ticketId: string,
  data: {
    payment_status: string;
    payment_reference?: string;
    notes?: string;
    send_email: boolean;
  }
): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/${ticketId}/payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    return response.ok;
  } catch (error) {
    console.error('Error confirming payment:', error);
    return false;
  }
};

export const redeemTicket = async (
  token: string,
  ticketId: string,
  userEmail: string,
  userRole: string
): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/${ticketId}/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        redeemed_by: userEmail,
        redeem_location: userRole === 'tienda' ? 'tienda' : 'entrada'
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error redeeming ticket:', error);
    return false;
  }
};

export const verifyTicket = async (
  token: string,
  code: string,
  userRole: string
): Promise<{ valid: boolean; ticket?: ConcertTicket; message?: string; warning?: string }> => {
  try {
    const response = await fetch(`${API_BASE}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        code,
        verify_location: userRole === 'tienda' ? 'tienda' : 'entrada'
      })
    });

    return await response.json();
  } catch (error) {
    console.error('Error verifying ticket:', error);
    return { valid: false, message: 'Error al verificar entrada' };
  }
};

export const resendTicketEmail = async (
  token: string,
  ticketId: string
): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/${ticketId}/resend-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        force_send: true
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error resending email:', error);
    return false;
  }
};

export const validateManualPayment = async (
  token: string,
  transactionId: string,
  approved: boolean,
  rejectionReason?: string
): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/manual/${transactionId}/confirm-manual`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        approved,
        rejectionReason: approved ? undefined : rejectionReason || 'El pago no pudo ser verificado'
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error validating manual payment:', error);
    return false;
  }
};

export const validateIframePayment = async (
  token: string,
  ticketId: string,
  approved: boolean,
  rejectionReason?: string
): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/manual/confirm-iframe-payment`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        ticketId,
        approved,
        rejectionReason: approved ? undefined : rejectionReason || 'El pago no pudo ser verificado'
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error validating iframe payment:', error);
    return false;
  }
};