import React from 'react';

interface TicketHeaderProps {
  userRole?: string;
}

const TicketHeader: React.FC<TicketHeaderProps> = ({ userRole }) => {
  const getTitle = () => {
    switch (userRole) {
      case 'admin':
        return '🎫 Gestión de Entradas';
      case 'tienda':
        return '🏪 Punto de Venta';
      default:
        return '🎵 Mis Entradas';
    }
  };

  return (
    <div className="bg-gradient-to-r from-orange-600 to-[#f08772] rounded-lg p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">{getTitle()}</h1>
          <p className="text-white/90">
            Sistema integrado con notificaciones automáticas por email
          </p>
        </div>
        
        <div className="text-right">
          <p className="text-sm text-white/80">Evento</p>
          <p className="text-xl font-semibold">08 de Noviembre, 2025</p>
          <p className="text-sm text-white/80 mt-1">Wynwood Park</p>
        </div>
      </div>
    </div>
  );
};

export default TicketHeader;