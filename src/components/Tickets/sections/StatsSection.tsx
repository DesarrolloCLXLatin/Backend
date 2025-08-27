import React from 'react';
import { Info } from 'lucide-react';
import { ConcertTicket } from '../../../types';
import { calculateEmailStats } from '../utils/ticketHelpers';

interface StatsSectionProps {
  tickets: ConcertTicket[];
  venueStats: any;
}

const StatsSection: React.FC<StatsSectionProps> = ({ tickets, venueStats }) => {
  const emailStats = calculateEmailStats(tickets);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Estadísticas del Venue */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📊 Estadísticas del Venue
        </h3>
        
        {venueStats && (
          <div className="space-y-4">
            <OccupancyBar 
              label="Ocupación Total"
              percentage={venueStats.venue?.occupancyRate || 0}
            />

            <StatRow 
              label="Boxes Vendidos"
              value={`${venueStats.boxes?.sold || 0} de ${venueStats.boxes?.total || 30}`}
            />

            <StatRow 
              label="Zona General"
              value={`${venueStats.general?.sold || 0} de ${venueStats.general?.capacity || 4970}`}
            />

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">Ingresos Totales</span>
                <div className="text-right">
                  <p className="font-bold text-lg text-green-600">
                    ${venueStats.totalRevenueUSD?.toLocaleString() || '0'} USD
                  </p>
                  {venueStats.totalRevenueBs && (
                    <p className="text-sm text-gray-500">
                      Bs. {venueStats.totalRevenueBs.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Estadísticas de Emails */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📧 Estadísticas de Emails
        </h3>
        
        <div className="space-y-4">
          <StatRow 
            label="Enviados Hoy"
            value={emailStats.sent_today}
            valueColor="text-blue-600"
          />

          <StatRow 
            label="Verificación Pendiente"
            value={emailStats.pending_verification}
            valueColor="text-yellow-600"
          />

          <StatRow 
            label="Confirmaciones"
            value={emailStats.confirmed}
            valueColor="text-green-600"
          />

          <StatRow 
            label="Rechazos"
            value={emailStats.rejected}
            valueColor="text-red-600"
          />

          <div className="pt-4 border-t">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <Info className="w-4 h-4 inline mr-1" />
                Los emails se envían automáticamente según el estado del pago
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componentes auxiliares para StatsSection
const OccupancyBar: React.FC<{ label: string; percentage: number }> = ({ label, percentage }) => (
  <div className="flex justify-between items-center">
    <span className="text-gray-600">{label}</span>
    <div className="flex items-center">
      <span className="font-semibold text-lg mr-2">{percentage}%</span>
      <div className="w-32 bg-gray-200 rounded-full h-2">
        <div 
          className="bg-gradient-to-r from-orange-600 to-[#f08772] h-2 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  </div>
);

const StatRow: React.FC<{ 
  label: string; 
  value: string | number; 
  valueColor?: string 
}> = ({ label, value, valueColor = "text-gray-900" }) => (
  <div className="flex justify-between items-center">
    <span className="text-gray-600">{label}</span>
    <span className={`font-semibold text-lg ${valueColor}`}>
      {value}
    </span>
  </div>
);

export default StatsSection;