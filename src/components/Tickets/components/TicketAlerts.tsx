import React from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { TicketInventory } from '../../../types';

interface TicketAlertsProps {
  inventory: TicketInventory | null;
  pendingCount: number;
}

const TicketAlerts: React.FC<TicketAlertsProps> = ({ inventory, pendingCount }) => {
  const showLowStock = inventory && inventory.available_tickets < 100;
  const showPending = pendingCount > 0;

  if (!showLowStock && !showPending) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {showLowStock && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-orange-600 mr-2 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-orange-800">Stock Bajo</h4>
              <p className="text-sm text-orange-700 mt-1">
                ¡Quedan solo {inventory.available_tickets} entradas disponibles!
              </p>
            </div>
          </div>
        </div>
      )}

      {showPending && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800">Pagos Pendientes</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Hay {pendingCount} pago(s) esperando validación manual
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketAlerts;