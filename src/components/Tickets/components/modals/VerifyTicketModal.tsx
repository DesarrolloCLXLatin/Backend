import React, { useState } from 'react';
import { QrCode, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface VerifyTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (ticket: any) => void;
  token: string;
  userRole?: string;
}

const VerifyTicketModal: React.FC<VerifyTicketModalProps> = ({ 
  isOpen, 
  onClose, 
  onVerified,
  token,
  userRole
}) => {
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleVerify = async () => {
    if (!verifyCode.trim()) {
      toast.error('Ingrese un código para verificar');
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading('Verificando entrada...');
    
    try {
      const response = await fetch('/api/tickets/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          code: verifyCode,
          verify_location: userRole === 'tienda' ? 'tienda' : 'entrada'
        })
      });

      toast.dismiss(loadingToast);

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          setVerifyCode('');
          onClose();
          onVerified(data.ticket);
          
          if (data.warning) {
            toast.warning(data.warning);
          } else {
            toast.success('✅ Entrada válida');
          }
        } else {
          toast.error(data.message || data.warning || 'Entrada no válida');
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Código no válido o entrada no encontrada');
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Error verifying ticket:', error);
      toast.error('Error al verificar entrada');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <QrCode className="w-5 h-5 mr-2" />
            Verificar Entrada
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código de Entrada
            </label>
            <input
              type="text"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleVerify()}
              placeholder="Ej: TK-2024-XXXX"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Ingrese el código del ticket o escanee el QR
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleVerify}
              disabled={loading || !verifyCode.trim()}
              className="flex-1 bg-gradient-to-r from-orange-600 to-[#f08772] text-white px-4 py-2 rounded-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verificando...' : 'Verificar'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyTicketModal;