// shared/ErrorMessage.tsx
import React from 'react';
import { AlertCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

type ErrorType = 'error' | 'warning' | 'info' | 'critical';

interface ErrorMessageProps {
  message: string | string[];
  type?: ErrorType;
  title?: string;
  onClose?: () => void;
  className?: string;
  showIcon?: boolean;
  inline?: boolean;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  type = 'error',
  title,
  onClose,
  className = '',
  showIcon = true,
  inline = false
}) => {
  const messages = Array.isArray(message) ? message : [message];

  const config = {
    error: {
      icon: <AlertCircle className="w-5 h-5" />,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900'
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5" />,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-600',
      titleColor: 'text-yellow-900'
    },
    info: {
      icon: <Info className="w-5 h-5" />,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-900'
    },
    critical: {
      icon: <XCircle className="w-5 h-5" />,
      bgColor: 'bg-red-100',
      borderColor: 'border-red-300',
      textColor: 'text-red-900',
      iconColor: 'text-red-700',
      titleColor: 'text-red-900'
    }
  };

  const styles = config[type];

  if (inline) {
    return (
      <div className={`flex items-center ${styles.textColor} ${className}`}>
        {showIcon && (
          <span className={`${styles.iconColor} mr-1`}>
            {React.cloneElement(styles.icon, { className: 'w-4 h-4' })}
          </span>
        )}
        <span className="text-sm">{messages[0]}</span>
      </div>
    );
  }

  return (
    <div
      className={`
        ${styles.bgColor} 
        ${styles.borderColor} 
        border rounded-md p-4 
        ${className}
      `}
      role="alert"
    >
      <div className="flex">
        {showIcon && (
          <div className={`flex-shrink-0 ${styles.iconColor}`}>
            {styles.icon}
          </div>
        )}
        
        <div className={`${showIcon ? 'ml-3' : ''} flex-1`}>
          {title && (
            <h3 className={`text-sm font-medium ${styles.titleColor} mb-1`}>
              {title}
            </h3>
          )}
          
          {messages.length === 1 ? (
            <p className={`text-sm ${styles.textColor}`}>{messages[0]}</p>
          ) : (
            <ul className={`list-disc list-inside text-sm ${styles.textColor} space-y-1`}>
              {messages.map((msg, index) => (
                <li key={index}>{msg}</li>
              ))}
            </ul>
          )}
        </div>
        
        {onClose && (
          <div className="ml-auto pl-3">
            <button
              onClick={onClose}
              className={`
                inline-flex rounded-md p-1.5 
                ${styles.textColor} 
                hover:${styles.bgColor} 
                focus:outline-none focus:ring-2 focus:ring-offset-2 
                focus:ring-${type === 'warning' ? 'yellow' : type === 'info' ? 'blue' : 'red'}-500
              `}
              aria-label="Cerrar mensaje"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Componente para mostrar múltiples errores
interface ErrorListProps {
  errors: Array<{ field: string; message: string }>;
  title?: string;
  onClose?: () => void;
}

export const ErrorList: React.FC<ErrorListProps> = ({ 
  errors, 
  title = 'Se encontraron los siguientes errores:',
  onClose 
}) => {
  if (errors.length === 0) return null;

  return (
    <ErrorMessage
      type="error"
      title={title}
      message={errors.map(e => e.message)}
      onClose={onClose}
    />
  );
};

// Componente para errores de campo específico
interface FieldErrorMessageProps {
  error?: { message?: string };
  className?: string;
}

export const FieldErrorMessage: React.FC<FieldErrorMessageProps> = ({ 
  error, 
  className = 'mt-1' 
}) => {
  if (!error?.message) return null;

  return (
    <ErrorMessage
      message={error.message}
      type="error"
      inline
      showIcon
      className={className}
    />
  );
};

// Componente para mensajes de estado general
interface StatusMessageProps {
  status: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({ 
  status, 
  message, 
  onClose,
  autoClose = false,
  autoCloseDelay = 5000
}) => {
  React.useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [autoClose, autoCloseDelay, onClose]);

  const typeMap = {
    success: 'info',
    error: 'error',
    warning: 'warning',
    info: 'info'
  } as const;

  return (
    <ErrorMessage
      type={typeMap[status]}
      message={message}
      onClose={onClose}
    />
  );
};