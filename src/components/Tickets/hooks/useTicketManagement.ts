import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { ConcertTicket, TicketInventory, PaymentTransaction } from '../../../types';
import { TabType, FilterState } from '../types';
import * as api from '../utils/api';

export const useTicketManagement = (activeTab: TabType) => {
  const { user, token } = useAuth();
  const [tickets, setTickets] = useState<ConcertTicket[]>([]);
  const [inventory, setInventory] = useState<TicketInventory | null>(null);
  const [venueStats, setVenueStats] = useState<any>(null);
  const [pendingValidations, setPendingValidations] = useState<PaymentTransaction[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    search: '',
    page: 1,
    limit: 50
  });

  useEffect(() => {
    loadData();
  }, [activeTab, filters, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'tickets':
          await loadTicketsData();
          break;
        case 'pending-validations':
          if (user?.role === 'admin') {
            await loadPendingValidations();
          }
          break;
        case 'stats':
          if (user?.role === 'admin') {
            await loadStatsData();
          }
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  const loadTicketsData = async () => {
    if (user?.role === 'admin') {
      const data = await api.fetchAllTickets(token, filters);
      setTickets(data);
      const stats = await api.fetchVenueStatistics(token);
      setVenueStats(stats);
    } else if (user?.role === 'tienda') {
      const data = await api.fetchStoreTickets(token, filters);
      setTickets(data);
    } else {
      const data = await api.fetchMyTickets(token, filters);
      setTickets(data);
    }
    
    const inventoryData = await api.fetchInventory(token);
    setInventory(inventoryData);
  };

  const loadPendingValidations = async () => {
    const { validations, count } = await api.fetchPendingValidations(token);
    setPendingValidations(validations);
    setPendingCount(count);
  };

  const loadStatsData = async () => {
    const stats = await api.fetchVenueStatistics(token);
    setVenueStats(stats);
  };

  const refreshData = () => {
    loadData();
  };

  return {
    tickets,
    setTickets,
    inventory,
    venueStats,
    pendingValidations,
    pendingCount,
    loading,
    filters,
    setFilters,
    refreshData,
  };
};