import React from 'react';
import { Eye, CheckCircle, XCircle } from 'lucide-react';
import { PaymentTransaction } from '../../../types';
import PaymentMethodBadge from './PaymentMethodBadge';
import { getPaymentMethodIcon } from '../utils/ticketHelpers';

interface PendingValidationsTableProps {
  validations: PaymentTransaction[];
  onSelectValidation: (validation: PaymentTransaction) => void;
  onQuickApprove: (validation: PaymentTransaction) => void;
  onQuickReject: (validation: PaymentTransaction) => void;
  isProcessing: boolean;
}

const PendingValidationsTable: React.FC<PendingValidationsTableProps> = ({
  validations,
  onSelectValidation,
  onQuickApprove,
  onQuickReject,
  isProcessing
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Usuario
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Referencia
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Método
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Monto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fecha
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tickets
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {validations.map((validation) => (
            <tr key={validation.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {validation.user_name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {validation.user_email}
                  </div>
                  {validation.type === 'iframe' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                      Iframe
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                  {validation.reference_number}
                </code>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <PaymentMethodBadge method={validation.payment_method || 'transferencia'} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <p className="text-sm font-medium text-gray-900">
                  ${validation.amount_usd || '35.00'} USD
                </p>
                {validation.amount && (
                  <p className="text-xs text-gray-500">
                    Bs. {parseFloat(validation.amount).toLocaleString('es-VE')}
                  </p>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(validation.created_at).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {validation.ticket_count} entrada(s)
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onSelectValidation(validation)}
                    className="bg-gradient-to-r from-orange-600 to-[#f08772] text-white px-3 py-1.5 rounded-md hover:shadow-lg transition-all text-sm flex items-center"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Ver
                  </button>
                  
                  <button
                    onClick={() => onQuickApprove(validation)}
                    disabled={isProcessing}
                    className="bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 transition-all text-sm flex items-center disabled:opacity-50"
                    title="Aprobar rápidamente"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => onQuickReject(validation)}
                    disabled={isProcessing}
                    className="bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 transition-all text-sm flex items-center disabled:opacity-50"
                    title="Rechazar con motivo"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PendingValidationsTable;