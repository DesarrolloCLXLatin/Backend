// components/PaymentSummary.tsx
import React from 'react';
import { DollarSign, Calculator } from 'lucide-react';

interface PaymentSummaryProps {
  runnersCount: number;
  priceUSD: number;
  exchangeRate: number | null;
  paymentMethod: string;
  testMode?: boolean; // CÓDIGO DE PRUEBA
  testAmountBs?: number; // CÓDIGO DE PRUEBA
}

export const PaymentSummary: React.FC<PaymentSummaryProps> = ({
  runnersCount,
  priceUSD,
  exchangeRate,
  paymentMethod,
  testMode,
  testAmountBs
}) => {
  const totalUSD = runnersCount * priceUSD;
  // CÓDIGO DE PRUEBA: Usar el monto de prueba si está disponible
  const totalBs = testMode && testAmountBs 
    ? testAmountBs 
    : (exchangeRate ? totalUSD * exchangeRate : null);

  return (
    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Calculator className="w-5 h-5 mr-2 text-gray-600" />
        Resumen de Pago
      </h3>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Corredores:</span>
          <span className="font-medium text-gray-900">{runnersCount}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Precio por corredor:</span>
          <span className="font-medium text-gray-900">${priceUSD} USD</span>
        </div>
        
        <div className="border-t border-gray-200 pt-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-900 font-semibold">Total USD:</span>
            <span className="text-xl font-bold text-gray-900">${totalUSD}</span>
          </div>
          
          {totalBs && (
            <div className="flex justify-between items-center mt-2">
              <span className="text-gray-900 font-semibold">
                Total Bs:
                {testMode && <span className="text-yellow-600 text-sm ml-2">(MODO PRUEBA)</span>}
              </span>
              <span className="text-xl font-bold text-gray-900">
                Bs. {totalBs.toFixed(2)}
              </span>
            </div>
          )}
          
          {exchangeRate && (
            <div className="mt-2 text-sm text-gray-600 text-right">
              Tasa BCV: {exchangeRate.toFixed(4)}
            </div>
          )}
        </div>
        
        {/* CÓDIGO DE PRUEBA: Mostrar advertencia si está en modo de prueba */}
        {testMode && (
          <div className="mt-3 p-3 bg-yellow-100 border border-yellow-300 rounded-md">
            <p className="text-xs text-yellow-800">
              <strong>Modo de prueba activo:</strong> Se enviará Bs. {testAmountBs?.toFixed(2)} al gateway 
              en lugar del monto calculado (Bs. {exchangeRate ? (totalUSD * exchangeRate).toFixed(2) : '0.00'})
            </p>
          </div>
        )}
      </div>
    </div>
  );
};