import { useState, useCallback, useMemo } from 'react';
import { ConcertTicket } from '../../../types';
import { FilterState } from '../types';

export const useTicketFilters = (tickets: ConcertTicket[]) => {
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    search: '',
    page: 1,
    limit: 50
  });

  const filteredTickets = useMemo(() => {
    let result = [...tickets];

    // Filtrar por estado
    if (filters.status !== 'all') {
      result = result.filter(ticket => 
        ticket.payment_status === filters.status
      );
    }

    // Filtrar por búsqueda
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(ticket =>
        ticket.ticket_number.toLowerCase().includes(searchLower) ||
        ticket.buyer_name.toLowerCase().includes(searchLower) ||
        ticket.buyer_email.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [tickets, filters]);

  const paginatedTickets = useMemo(() => {
    const start = (filters.page - 1) * filters.limit;
    const end = start + filters.limit;
    return filteredTickets.slice(start, end);
  }, [filteredTickets, filters.page, filters.limit]);

  const totalPages = Math.ceil(filteredTickets.length / filters.limit);

  const updateFilters = useCallback((newFilters: Partial<FilterState>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.status !== undefined || newFilters.search !== undefined ? 1 : (newFilters.page || prev.page)
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      status: 'all',
      search: '',
      page: 1,
      limit: 50
    });
  }, []);

  return {
    filters,
    setFilters,
    updateFilters,
    resetFilters,
    filteredTickets,
    paginatedTickets,
    totalPages
  };
};