// components/RunnersSection.tsx
import React from 'react';
import { UseFormRegister, FieldErrors, UseFormWatch, UseFieldArrayAppend, UseFieldArrayRemove, FieldArrayWithId } from 'react-hook-form';
import { Users, Plus, AlertCircle, Trophy, Zap, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FormData, InventoryItem, Runner } from '../types';
import { RunnerForm } from './RunnerForm';
import { MAX_RUNNERS_PER_GROUP } from '../constants';

interface RunnersSectionProps {
  fields: FieldArrayWithId<FormData, "runners", "id">[];
  register: UseFormRegister<FormData>;
  errors: FieldErrors<FormData>;
  watch: UseFormWatch<FormData>;
  append: UseFieldArrayAppend<FormData, "runners">;
  remove: UseFieldArrayRemove;
  getAvailableStock: (size: string, gender: string) => number;
  inventory: InventoryItem[];
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.8, 
    y: -20,
    transition: { duration: 0.2 }
  }
};

export const RunnersSection: React.FC<RunnersSectionProps> = ({
  fields,
  register,
  errors,
  watch,
  append,
  remove,
  getAvailableStock,
  inventory
}) => {
  const canAddRunner = fields.length < MAX_RUNNERS_PER_GROUP;

  const handleAddRunner = () => {
    if (canAddRunner) {
      append({
        identification_type: 'V',
        gender: 'M',
        full_name: '',
        identification: '',
        birth_date: '',
        email: '',
        phone: '',
        shirt_size: ''
      });
    }
  };

  const progressPercentage = (fields.length / MAX_RUNNERS_PER_GROUP) * 100;

  return (
    <div className="space-y-6">
      {/* Header animado con gradiente */}
      <motion.div 
        className="relative overflow-hidden bg-gradient-to-br from-orange-900/20 to-red-900/20 backdrop-blur-sm p-6 rounded-xl border border-orange-700/50"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Efecto de brillo animado */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-400/10 to-transparent"
          animate={{ x: [-200, 200] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
        />
        
        <div className="relative flex items-start space-x-4">
          <motion.div
            animate={{ 
              rotate: [0, 10, -10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className="flex-shrink-0"
          >
            <div className="relative">
              <Users className="w-8 h-8 text-orange-500" />
              <motion.div
                className="absolute -top-1 -right-1"
                animate={{ scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
              </motion.div>
            </div>
          </motion.div>
          
          <div className="flex-1">
            <h3 className="text-xl font-bold text-orange-300 mb-1">
              Paso 1: Datos de los Corredores
            </h3>
            <p className="text-sm text-orange-200/80 leading-relaxed">
              Ingrese la información de cada corredor que participará en la carrera.
              Puede registrar hasta {MAX_RUNNERS_PER_GROUP} corredores en un solo grupo.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Estado vacío mejorado */}
      <AnimatePresence mode="wait">
        {fields.length === 0 && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
          >
            <EmptyState onAdd={handleAddRunner} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista de corredores con animaciones */}
      <AnimatePresence>
        {fields.length > 0 && (
          <motion.div className="space-y-6">
            <div className="space-y-4">
              <AnimatePresence>
                {fields.map((field, index) => (
                  <motion.div
                    key={field.id}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                    className="relative"
                  >
                    {/* Número del corredor animado */}
                    <motion.div 
                      className="absolute -left-4 -top-4 z-20"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 200, delay: index * 0.1 }}
                    >
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full ml-4 bg-gradient-to-br from-orange-500 to-red-600 text-white text-sm font-bold shadow-xl flex items-center justify-center">
                          {index + 1}
                        </div>
                        <motion.div
                          className="absolute inset-0 rounded-full bg-orange-400 opacity-30"
                          animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      </div>
                    </motion.div>
                    
                    <div className="pl-6">
                      <RunnerForm
                        index={index}
                        register={register}
                        errors={errors}
                        watch={watch}
                        onRemove={() => remove(index)}
                        canRemove={fields.length > 1}
                        getAvailableStock={getAvailableStock}
                        inventory={inventory}
                      />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

               {/* Barra de progreso animada */}
                <motion.div 
                  className="bg-gray-800/50 backdrop-blur-sm p-4 rounded-lg border border-gray-700"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-300">
                        Corredores registrados:
                      </span>
                      <motion.span 
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        key={fields.length}
                      >
                        <Trophy className="w-3 h-3 mr-1" />
                        {fields.length} / {MAX_RUNNERS_PER_GROUP}
                      </motion.span>
                    </div>
                    {canAddRunner && (
                      <motion.div 
                        className="flex justify-center pt-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        <AddRunnerButton onClick={handleAddRunner} variant="primary" />
                      </motion.div>
                    )}
                  </div>
                  
                  {/* Barra de progreso */}
                  <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercentage}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"
                        animate={{ x: [-100, 100] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </motion.div>
                  </div>
                </motion.div>

            {/* Botón para agregar más corredores */}
            {/*{canAddRunner && (
              <motion.div 
                className="flex justify-center pt-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <AddRunnerButton onClick={handleAddRunner} variant="primary" />
              </motion.div>
            )}*/}

            {/* Mensaje cuando se alcanza el límite */}
            {!canAddRunner && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-gradient-to-br from-yellow-900/20 to-amber-900/20 backdrop-blur-sm border border-yellow-700/50 rounded-lg p-4"
              >
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-300">
                    <p className="font-semibold mb-1">Límite alcanzado</p>
                    <p className="text-yellow-300/80">
                      Has alcanzado el número máximo de corredores permitidos por grupo ({MAX_RUNNERS_PER_GROUP}).
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Información importante con animación */}
      <AnimatePresence>
        {fields.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.4 }}
            className="mt-8 bg-gradient-to-br from-blue-900/20 to-purple-900/20 backdrop-blur-sm border border-blue-700/50 rounded-xl p-5"
          >
            <div className="flex items-start space-x-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <Zap className="w-6 h-6 text-blue-400" />
              </motion.div>
              <div>
                <h4 className="text-sm font-bold text-blue-300 mb-2">Información importante:</h4>
                <ul className="text-sm text-blue-200/80 space-y-1.5">
                  <motion.li 
                    className="flex items-start"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <span className="text-blue-400 mr-2">•</span>
                    Todos los corredores deben tener al menos 12 años de edad
                  </motion.li>
                  <motion.li 
                    className="flex items-start"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <span className="text-blue-400 mr-2">•</span>
                    Verifique la disponibilidad de las tallas antes de continuar
                  </motion.li>
                  <motion.li 
                    className="flex items-start"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 }}
                  >
                    <span className="text-blue-400 mr-2">•</span>
                    Cada corredor recibirá un correo con su información de registro
                  </motion.li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface AddRunnerButtonProps {
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

const AddRunnerButton: React.FC<AddRunnerButtonProps> = ({ 
  onClick, 
  variant = 'primary' 
}) => {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`
        relative group flex items-center font-semibold rounded-lg transition-all duration-300 overflow-hidden
        ${variant === 'primary' 
          ? 'px-8 py-4 text-base bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-xl hover:shadow-2xl' 
          : 'px-5 py-2.5 text-sm bg-gray-800 text-orange-400 hover:bg-gray-700 border border-orange-500/50'}
      `}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        className={`absolute inset-0 ${variant === 'primary' ? 'bg-gradient-to-r from-orange-700 to-red-700' : 'bg-orange-900/20'}`}
        initial={{ x: "-100%" }}
        whileHover={{ x: 0 }}
        transition={{ duration: 0.3 }}
      />
      <span className="relative flex items-center">
        <Plus className={variant === 'primary' ? 'w-5 h-5 mr-2' : 'w-4 h-4 mr-1.5'} />
        Agregar Corredor
      </span>
    </motion.button>
  );
};

const EmptyState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <motion.div 
    className="relative overflow-hidden text-center py-16 bg-gradient-to-br from-orange-900/10 to-red-900/10 backdrop-blur-sm rounded-2xl border-2 border-dashed border-orange-700/50"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
  >
    {/* Partículas de fondo animadas */}
    <div className="absolute inset-0 overflow-hidden">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-orange-500/20 rounded-full"
          animate={{
            x: [Math.random() * 400 - 200, Math.random() * 400 - 200],
            y: [Math.random() * 400 - 200, Math.random() * 400 - 200],
          }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            repeatType: "reverse",
          }}
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
        />
      ))}
    </div>

    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 100 }}
      className="relative"
    >
      <div className="relative inline-block">
        <Users className="w-20 h-20 mx-auto text-orange-500 mb-4" />
        <motion.div
          className="absolute -top-2 -right-2"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <Star className="w-6 h-6 text-yellow-400 fill-current" />
        </motion.div>
      </div>
    </motion.div>
    
    <motion.h3 
      className="text-xl font-bold text-orange-300 mb-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      Comienza agregando corredores
    </motion.h3>
    
    <motion.p 
      className="text-gray-400 mb-8 max-w-sm mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      Agrega a todos los participantes que deseas registrar para la CLX Night Run 2025
    </motion.p>
    
    <motion.button
      type="button"
      onClick={onAdd}
      className="relative group inline-flex items-center px-8 py-4 bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold rounded-xl shadow-2xl hover:shadow-orange-500/25 transition-all duration-300 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-orange-700 to-red-700"
        initial={{ x: "-100%" }}
        whileHover={{ x: 0 }}
        transition={{ duration: 0.3 }}
      />
      <span className="relative flex items-center">
        <Plus className="w-6 h-6 mr-2" />
        Agregar el primer corredor
      </span>
    </motion.button>
  </motion.div>
);