// components/RunnerForm.tsx
import React from 'react';
import { UseFormRegister, FieldErrors, UseFormWatch } from 'react-hook-form';
import { User, Trash2 } from 'lucide-react';
import { FormData, InventoryItem } from '../types';
import { FormField } from '../../shared/FormField';
import { SHIRT_SIZES } from '../constants';

interface RunnerFormProps {
  index: number;
  register: UseFormRegister<FormData>;
  errors: FieldErrors<FormData>;
  watch: UseFormWatch<FormData>;
  onRemove: () => void;
  canRemove: boolean;
  getAvailableStock: (size: string, gender: string) => number;
  inventory: InventoryItem[];
}

export const RunnerForm: React.FC<RunnerFormProps> = ({
  index,
  register,
  errors,
  watch,
  onRemove,
  canRemove,
  getAvailableStock,
  inventory
}) => {
  const runnerErrors = errors.runners?.[index];
  const gender = watch(`runners.${index}.gender`);

  return (
    <div className="p-4 bg-orange-50 rounded-md space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-orange-400 flex items-center">
          <User className="w-4 h-4 mr-1 text-orange-400" />
          Corredor {index + 1}
        </h4>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-red-600 hover:text-red-800 transition-colors"
            aria-label={`Eliminar corredor ${index + 1}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          label="Nombre Completo"
          error={runnerErrors?.full_name}
          required
        >
          <input
            {...register(`runners.${index}.full_name`)}
            type="text"
            className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Nombre y Apellido"
          />
        </FormField>

        <FormField
          label="Identificación"
          error={runnerErrors?.identification}
          required
        >
          <div className="flex space-x-2">
            <select
              {...register(`runners.${index}.identification_type`)}
              className="w-20 px-2 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="V">V</option>
              <option value="E">E</option>
            </select>
            <input
              {...register(`runners.${index}.identification`)}
              type="text"
              className="flex-1 px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="12345678"
            />
          </div>
        </FormField>

        <FormField
          label="Fecha de Nacimiento"
          error={runnerErrors?.birth_date}
          required
        >
          <input
            {...register(`runners.${index}.birth_date`, {
              required: 'La fecha de nacimiento es requerida',
              validate: {
                age: (value) => {
                  if (!value) return 'La fecha de nacimiento es requerida';
                  
                  const birthDate = new Date(value);
                  const today = new Date();
                  let age = today.getFullYear() - birthDate.getFullYear();
                  const monthDiff = today.getMonth() - birthDate.getMonth();
                  
                  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                  }
                  
                  if (age < 12) return 'El participante debe tener al menos 12 años';
                  if (age > 100) return 'Por favor verifica la fecha de nacimiento';
                  return true;
                }
              }
            })}
            type="date"
            max={new Date(new Date().setFullYear(new Date().getFullYear() - 12)).toISOString().split('T')[0]}
            className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </FormField>

        <FormField
          label="Género"
          error={runnerErrors?.gender}
          required
        >
          <div className="flex space-x-4 mt-2">
            <label className="flex items-center text-orange-400">
              <input
                {...register(`runners.${index}.gender`)}
                type="radio"
                value="M"
                className="mr-2 text-orange-400 focus:ring-orange-500"
              />
              Masculino
            </label>
            <label className="flex items-center text-orange-400">
              <input
                {...register(`runners.${index}.gender`)}
                type="radio"
                value="F"
                className="mr-2 text-orange-400 focus:ring-orange-500"
              />
              Femenino
            </label>
          </div>
        </FormField>

        <FormField
          label="Email"
          error={runnerErrors?.email}
          required
        >
          <input
            {...register(`runners.${index}.email`)}
            type="email"
            className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="corredor@email.com"
          />
        </FormField>

        <FormField
          label="Teléfono"
          error={runnerErrors?.phone}
          required
        >
          <input
            {...register(`runners.${index}.phone`)}
            type="tel"
            className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="0414 123 4567"
          />
        </FormField>

        <FormField
          label="Talla de Camiseta"
          error={runnerErrors?.shirt_size}
          required
        >
          <select
            {...register(`runners.${index}.shirt_size`)}
            className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Seleccionar talla</option>
            {SHIRT_SIZES.map(size => {
              const available = getAvailableStock(size, gender);
              const showStock = Array.isArray(inventory) && inventory.length > 0;
              return (
                <option 
                  key={size} 
                  value={size} 
                  disabled={showStock && available <= 0}
                >
                  {size} {showStock && gender ? (
                    available <= 0 ? '(Agotado)' : 
                    available <= 10 ? `(Últimas ${available})` : 
                    `(${available} disponibles)`
                  ) : ''}
                </option>
              );
            })}
          </select>
        </FormField>
      </div>
    </div>
  );
};