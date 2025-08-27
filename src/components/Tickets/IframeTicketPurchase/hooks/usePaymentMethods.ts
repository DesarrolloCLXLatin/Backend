// src/components/tickets/IframeTicketPurchase/hooks/usePaymentMethods.ts

import { useState, useEffect, useCallback } from 'react';
import { PaymentMethod, Bank } from '../types';
import { fetchBanks, fetchExchangeRate } from '../utils/api';
import { PAYMENT_METHODS } from '../constants';

export const usePaymentMethods = () => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPaymentMethods = useCallback(async () => {
    try {
      // En producción, esto vendría de una API
      // Por ahora usamos los métodos mock
      const methods = PAYMENT_METHODS.map(method => ({
        ...method,
        available: true
      }));
      setPaymentMethods(methods);
    } catch (err) {
      console.error('Error loading payment methods:', err);
      setError('Error al cargar métodos de pago');
    }
  }, []);

  const loadBanks = useCallback(async () => {
    try {
      const banksData = await fetchBanks();
      setBanks(banksData);
    } catch (err) {
      console.error('Error loading banks:', err);
      setError('Error al cargar bancos');
    }
  }, []);

  const loadExchangeRate = useCallback(async () => {
    try {
      const rate = await fetchExchangeRate();
      setExchangeRate(rate);
    } catch (err) {
      console.error('Error loading exchange rate:', err);
      setError('Error al cargar tasa de cambio');
    }
  }, []);

  const loadAllPaymentData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        loadPaymentMethods(),
        loadBanks(),
        loadExchangeRate()
      ]);
    } catch (err) {
      setError('Error al cargar información de pago');
    } finally {
      setIsLoading(false);
    }
  }, [loadPaymentMethods, loadBanks, loadExchangeRate]);

  useEffect(() => {
    loadAllPaymentData();
  }, [loadAllPaymentData]);

  const refreshExchangeRate = useCallback(async () => {
    await loadExchangeRate();
  }, [loadExchangeRate]);

  const validatePaymentMethod = useCallback((method: string): boolean => {
    const selectedMethod = paymentMethods.find(m => m.value === method);
    return selectedMethod?.available || false;
  }, [paymentMethods]);

  return {
    paymentMethods,
    banks,
    exchangeRate,
    isLoading,
    error,
    refreshExchangeRate,
    validatePaymentMethod,
    reloadPaymentData: loadAllPaymentData
  };
};