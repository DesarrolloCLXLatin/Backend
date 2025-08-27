import React, { useState } from 'react';
import { Download, Printer, FileText, FileSpreadsheet, MoreVertical } from 'lucide-react';
import { ConcertTicket } from '../../../types';
import { exportToCSV, exportToJSON, printTickets } from '../utils/exportData';

interface ExportActionsProps {
  tickets: ConcertTicket[];
  disabled?: boolean;
}

const ExportActions: React.FC<ExportActionsProps> = ({ tickets, disabled = false }) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleExportCSV = () => {
    exportToCSV(tickets);
    setShowMenu(false);
  };

  const handleExportJSON = () => {
    exportToJSON(tickets);
    setShowMenu(false);
  };

  const handlePrint = () => {
    printTickets(tickets);
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={disabled || tickets.length === 0}
        className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="w-4 h-4 mr-2" />
        Exportar
        <MoreVertical className="w-4 h-4 ml-2" />
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border z-10">
          <button
            onClick={handleExportCSV}
            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
            Exportar a CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center"
          >
            <FileText className="w-4 h-4 mr-2 text-blue-600" />
            Exportar a JSON
          </button>
          <div className="border-t"></div>
          <button
            onClick={handlePrint}
            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center"
          >
            <Printer className="w-4 h-4 mr-2 text-gray-600" />
            Imprimir Lista
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportActions;