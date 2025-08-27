import { useMemo } from 'react';
import { ConcertTicket } from '../../../types';
import { calculateEmailStats } from '../utils/ticketHelpers';

export const useTicketStatistics = (tickets: ConcertTicket[]) => {
  const emailStats = useMemo(() => calculateEmailStats(tickets), [tickets]);

  const paymentMethodStats = useMemo(() => {
    const stats: Record<string, number> = {};
    
    tickets.forEach(ticket => {
      const method = ticket.payment_method;
      stats[method] = (stats[method] || 0) + 1;
    });
    
    return stats;
  }, [tickets]);

  const statusStats = useMemo(() => {
    const stats = {
      pendiente: 0,
      confirmado: 0,
      rechazado: 0,
      canjeado: 0
    };
    
    tickets.forEach(ticket => {
      if (ticket.payment_status in stats) {
        stats[ticket.payment_status as keyof typeof stats]++;
      }
      if (ticket.ticket_status === 'canjeado') {
        stats.canjeado++;
      }
    });
    
    return stats;
  }, [tickets]);

  const revenueStats = useMemo(() => {
    const confirmed = tickets.filter(t => t.payment_status === 'confirmado');
    const totalRevenue = confirmed.reduce((sum, ticket) => {
      const price = parseFloat(String(ticket.ticket_price || ticket.price || 35));
      const quantity = ticket.quantity || 1;
      return sum + (price * quantity);
    }, 0);

    return {
      totalRevenue,
      averageTicketPrice: confirmed.length > 0 ? totalRevenue / confirmed.length : 0,
      totalTicketsSold: confirmed.length
    };
  }, [tickets]);

  const dailyStats = useMemo(() => {
    const today = new Date().toDateString();
    const todayTickets = tickets.filter(ticket => {
      const ticketDate = new Date(ticket.created_at).toDateString();
      return ticketDate === today;
    });

    return {
      ticketsSoldToday: todayTickets.filter(t => t.payment_status === 'confirmado').length,
      pendingToday: todayTickets.filter(t => t.payment_status === 'pendiente').length,
      revenueToday: todayTickets
        .filter(t => t.payment_status === 'confirmado')
        .reduce((sum, ticket) => {
          const price = parseFloat(String(ticket.ticket_price || ticket.price || 35));
          return sum + price;
        }, 0)
    };
  }, [tickets]);

  return {
    emailStats,
    paymentMethodStats,
    statusStats,
    revenueStats,
    dailyStats
  };
};
