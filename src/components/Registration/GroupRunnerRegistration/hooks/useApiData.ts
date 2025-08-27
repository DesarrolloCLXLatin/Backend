// hooks/useApiData.ts - Versión final con soporte completo para iframe
import { useState, useEffect } from 'react';
import { Bank, InventoryItem } from '../types';
import { apiBanks, apiExchangeRate, apiInventory } from '../utils/api';

// Definir la interfaz para los props
interface UseApiDataProps {
  token?: string;
  isEmbedded?: boolean;
}

export const useApiData = ({ token, isEmbedded }: UseApiDataProps = {}) => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [errors, setErrors] = useState<{
    banks?: string;
    exchangeRate?: string;
    inventory?: string;
  }>({});

  // LOG INICIAL PARA DEBUGGING
  useEffect(() => {
    console.log('🚀 useApiData inicializado con:', {
      token: token ? `${token.substring(0, 12)}...` : 'NO TOKEN',
      isEmbedded: isEmbedded ? 'SÍ' : 'NO'
    });
  }, [token, isEmbedded]);

  const fetchBanks = async () => {
    try {
      console.log('📦 Obteniendo bancos...');
      const response = await apiBanks.getAll({ token, isEmbedded });
      console.log('Respuesta de bancos:', response);
      
      const banksData = response.banks || response.data || response;
      setBanks(Array.isArray(banksData) ? banksData : []);
      console.log('✅ Bancos cargados:', banksData.length);
    } catch (error) {
      console.error('Error obteniendo bancos:', error);
      setErrors(prev => ({ ...prev, banks: 'Error cargando bancos' }));
      // Fallback a bancos por defecto
      setBanks([
        { code: '0102', name: 'Banco de Venezuela' },
        { code: '0134', name: 'Banesco' },
        { code: '0105', name: 'Banco Mercantil' },
        { code: '0108', name: 'Banco Provincial' }
      ]);
    }
  };

  const fetchExchangeRate = async () => {
    try {
      console.log('💱 Obteniendo tasa de cambio...');
      const response = await apiExchangeRate.getCurrent({ token, isEmbedded });
      console.log('Respuesta de tasa de cambio:', response);
      
      const rate = response.rate || response.data?.rate || response.exchangeRate;
      setExchangeRate(rate);
      console.log('✅ Tasa de cambio:', rate);
    } catch (error) {
      console.error('Error obteniendo tasa de cambio:', error);
      setErrors(prev => ({ ...prev, exchangeRate: 'Error cargando tasa de cambio' }));
    }
  };

  const fetchInventory = async () => {
    try {
      console.log('📋 Obteniendo inventario...');
      console.log('Token disponible:', !!token);
      console.log('Es embebido:', !!isEmbedded);
      
      const response = await apiInventory.getAll({ token, isEmbedded });
      console.log('Respuesta completa del inventario:', response);
      
      // Procesar la respuesta
      let inventoryData: InventoryItem[] = [];
      
      if (response) {
        // Si la respuesta tiene la estructura { success: true, data: [...] }
        if (response.success && response.data) {
          inventoryData = response.data;
        } 
        // Si la respuesta es directamente un array
        else if (Array.isArray(response)) {
          inventoryData = response;
        }
        // Si la respuesta tiene solo la propiedad data
        else if (response.data && Array.isArray(response.data)) {
          inventoryData = response.data;
        }
        // Si la respuesta es un objeto pero no tiene la estructura esperada
        else if (typeof response === 'object' && !Array.isArray(response)) {
          // Verificar si el objeto tiene propiedades de inventario
          if (response.shirt_size !== undefined) {
            // Es un solo item de inventario
            inventoryData = [response];
          }
        }
      }
      
      console.log('✅ Inventario procesado:', inventoryData.length, 'items');
      
      // Validar que cada item tenga la estructura esperada
      const validatedInventory = inventoryData.filter(item => 
        item && 
        typeof item === 'object' && 
        'shirt_size' in item
      );
      
      if (validatedInventory.length !== inventoryData.length) {
        console.warn('Algunos items del inventario no tienen la estructura esperada');
      }
      
      setInventory(validatedInventory);
      
      // Log detallado de los primeros items para debugging
      if (validatedInventory.length > 0) {
        console.log('Ejemplo de items:', validatedInventory.slice(0, 3));
      } else {
        console.warn('⚠️ No se encontraron items de inventario');
        console.log('Token presente:', !!token);
        console.log('Es embebido:', !!isEmbedded);
      }
      
    } catch (error) {
      console.error('❌ Error obteniendo inventario:', error);
      setErrors(prev => ({ ...prev, inventory: 'Error cargando inventario' }));
      setInventory([]);
    }
  };

  const getAvailableStock = (size: string, gender: string): number => {
    console.log(`🔍 Buscando stock para talla ${size}, género ${gender}`);
    
    if (!Array.isArray(inventory) || inventory.length === 0) {
      console.warn('Inventario vacío o no válido');
      return 0;
    }
    
    // Para depuración, mostrar todas las tallas disponibles
    const availableSizes = inventory.map(item => `${item.shirt_size}/${item.gender || 'U'}`);
    console.log('Tallas disponibles en inventario:', availableSizes);
    
    const item = inventory.find(inv => {
      const itemSize = inv.shirt_size || inv.size;
      const itemGender = inv.gender || 'U'; // U = Unisex si no hay género
      
      // Coincidencia exacta o unisex
      const sizeMatch = itemSize === size;
      const genderMatch = itemGender === gender || itemGender === 'U' || !gender || gender === 'U';
      
      return sizeMatch && genderMatch;
    });
    
    if (item) {
      const available = item.available ?? item.stock ?? 0;
      console.log(`✅ Stock encontrado para ${size}/${gender}:`, available);
      return available;
    }
    
    console.log(`❌ No se encontró stock para ${size}/${gender}`);
    return 0;
  };

  // Efecto principal para cargar datos
  useEffect(() => {
    const loadInitialData = async () => {
      console.log('===========================================');
      console.log('🔄 INICIANDO CARGA DE DATOS');
      console.log('Token:', token ? `${token.substring(0, 12)}...` : 'NO HAY TOKEN');
      console.log('Es embebido:', isEmbedded);
      console.log('===========================================');
      
      setIsLoadingData(true);
      
      const results = await Promise.allSettled([
        fetchBanks(),
        fetchExchangeRate(),
        fetchInventory()
      ]);

      results.forEach((result, index) => {
        const names = ['Bancos', 'Tasa de cambio', 'Inventario'];
        if (result.status === 'rejected') {
          console.error(`❌ Error cargando ${names[index]}:`, result.reason);
        } else {
          console.log(`✅ ${names[index]} cargado exitosamente`);
        }
      });

      setIsLoadingData(false);
      console.log('===========================================');
      console.log('✅ CARGA DE DATOS COMPLETADA');
      console.log('===========================================');
    };

    // Solo cargar si tenemos token en modo embebido, o si no es embebido
    if (!isEmbedded || (isEmbedded && token)) {
      loadInitialData();
    } else {
      console.warn('⚠️ Esperando token para cargar datos...');
      setIsLoadingData(false); // No mantener el loading si no hay token
    }
  }, [token, isEmbedded]); // Re-ejecutar si cambia el token o isEmbedded

  const refetch = {
    banks: fetchBanks,
    exchangeRate: fetchExchangeRate,
    inventory: fetchInventory,
    all: async () => {
      console.log('🔄 Recargando todos los datos...');
      setIsLoadingData(true);
      try {
        await Promise.all([
          fetchBanks(), 
          fetchExchangeRate(), 
          fetchInventory()
        ]);
        console.log('✅ Recarga completa');
      } finally {
        setIsLoadingData(false);
      }
    }
  };

  // Debug del estado actual
  useEffect(() => {
    if (!isLoadingData) {
      console.log('📊 ESTADO ACTUAL:', {
        banks: banks.length,
        inventory: inventory.length,
        inventoryItems: inventory.length > 0 ? inventory.slice(0, 2) : [],
        exchangeRate,
        errors,
        token: token ? 'PRESENTE' : 'AUSENTE',
        isEmbedded
      });
    }
  }, [banks, inventory, exchangeRate, isLoadingData]);

  return {
    banks,
    inventory,
    exchangeRate,
    isLoadingData,
    errors,
    getAvailableStock,
    refetch
  };
};