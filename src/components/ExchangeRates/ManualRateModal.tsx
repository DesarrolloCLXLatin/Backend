import React, { useState } from 'react';
import { X, AlertCircle, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface ManualRateModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ManualRateModal: React.FC<ManualRateModalProps> = ({ onClose, onSuccess }) => {
  const [rate, setRate] = useState('');
  const [source, setSource] = useState('MANUAL');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const rateValue = parseFloat(rate);
    if (!rateValue || rateValue <= 0) {
      toast.error('Por favor ingresa una tasa válida');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/exchange-rates/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ rate: rateValue, source })
      });

      if (!response.ok) {
        throw new Error('Error al establecer la tasa');
      }

      toast.success('Tasa establecida correctamente');
      onSuccess();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al establecer la tasa');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Establecer Tasa Manualmente
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <div className="flex">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Advertencia</p>
              <p>Establecer una tasa manual sobrescribirá la tasa actual y afectará todas las transacciones.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tasa USD/VES
            </label>
            <input
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Ej: 36.50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fuente
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="MANUAL">Manual</option>
              <option value="BCV">BCV (Ajuste manual)</option>
              <option value="CUSTOM">Personalizada</option>
            </select>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">
              Fecha: <span className="font-medium">{new Date().toLocaleDateString('es-ES')}</span>
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Preview: <span className="font-medium">{rate || '0'} Bs/USD</span>
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {submitting ? 'Guardando...' : 'Guardar Tasa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualRateModal;