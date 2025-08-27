import React from 'react';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  CreditCard, 
  MapPin, 
  Calendar, 
  DollarSign,
  FileText,
  QrCode,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  Smartphone,
  Building,
  Zap,
  ShoppingCart,
  Package,
  Users,
  Ticket,
  MailCheck,
  MailX,
  Receipt
} from 'lucide-react';

interface ConcertTicket {
  id: string;
  ticket_number: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string;
  buyer_identification?: string;
  payment_method: string;
  payment_status: 'pendiente' | 'confirmado' | 'rechazado';
  ticket_status: 'vendido' | 'canjeado' | 'cancelado';
  zone_name?: string;
  ticket_price?: number;
  price?: number;
  quantity?: number;
  total_price?: number;
  created_at: string;
  redeemed_at?: string;
  email_sent?: boolean;
  email_sent_at?: string;
  receipt_sent?: boolean;
  is_box_purchase?: boolean;
  box_full_purchase?: boolean;
  box_code?: string;
  voucher_data?: any;
  payment_reference?: string;
  notes?: string;
}

interface TicketDetailsModalProps {
  ticket: ConcertTicket;
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
}

const TicketDetailsModal: React.FC<TicketDetailsModalProps> = ({ 
  ticket, 
  isOpen, 
  onClose,
  userRole = 'user'
}) => {
  if (!isOpen || !ticket) return null;

  // Funciones helper
  const getPaymentMethodIcon = (method: string) => {
    switch(method) {
      case 'pago_movil': return <Smartphone className="w-5 h-5" />;
      case 'zelle': return <Zap className="w-5 h-5" />;
      case 'transferencia': 
      case 'transferencia_nacional': return <Building className="w-5 h-5" />;
      case 'paypal': return <CreditCard className="w-5 h-5" />;
      case 'tienda': return <ShoppingCart className="w-5 h-5" />;
      default: return <CreditCard className="w-5 h-5" />;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: { [key: string]: string } = {
      'tienda': 'Tienda',
      'zelle': 'Zelle',
      'transferencia': 'Transferencia',
      'transferencia_nacional': 'Transferencia Nacional',
      'paypal': 'PayPal',
      'pago_movil': 'Pago Móvil P2C'
    };
    return labels[method] || method;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmado':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rechazado':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rechazado':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getEmailStatus = () => {
    if (ticket.payment_method === 'pago_movil' && ticket.payment_status === 'confirmado') {
      return {
        icon: <MailCheck className="w-4 h-4 text-green-600" />,
        text: 'Confirmación enviada',
        color: 'text-green-600'
      };
    }

    const emailSent = ticket.email_sent || ticket.receipt_sent || ticket.email_sent_at;
    
    if (ticket.payment_status === 'pendiente' && emailSent) {
      return {
        icon: <Clock className="w-4 h-4 text-yellow-600" />,
        text: 'Verificación enviada',
        color: 'text-yellow-600'
      };
    }
    
    if (ticket.payment_status === 'confirmado' && emailSent) {
      return {
        icon: <MailCheck className="w-4 h-4 text-green-600" />,
        text: 'Confirmación enviada',
        color: 'text-green-600'
      };
    }
    
    if (ticket.payment_status === 'rechazado' && emailSent) {
      return {
        icon: <MailX className="w-4 h-4 text-red-600" />,
        text: 'Rechazo enviado',
        color: 'text-red-600'
      };
    }

    return {
      icon: <Mail className="w-4 h-4 text-gray-400" />,
      text: 'Sin enviar',
      color: 'text-gray-400'
    };
  };

  const emailStatus = getEmailStatus();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-orange-600 to-[#f08772] text-white rounded-t-lg">
          <div className="flex items-center">
            <Ticket className="w-6 h-6 mr-3" />
            <div>
              <h2 className="text-xl font-bold">Resumen de Compra</h2>
              <p className="text-white/90 text-sm">Concierto 2025 - 15 de Marzo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-6">
          {/* Información del ticket */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <QrCode className="w-5 h-5 text-orange-600 mr-2" />
                <h3 className="font-semibold text-gray-900">Información del Ticket</h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(ticket.payment_status)}`}>
                {getStatusIcon(ticket.payment_status)}
                <span className="ml-1 capitalize">{ticket.payment_status}</span>
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Número de Ticket</p>
                <p className="font-mono font-semibold text-lg">{ticket.ticket_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Fecha de Compra</p>
                <p className="font-medium">{formatDate(ticket.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Zona</p>
                <p className="font-medium">{ticket.zone_name || 'Zona General'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Cantidad</p>
                <p className="font-medium">{ticket.quantity || 1} entrada(s)</p>
              </div>
            </div>

            {/* Información de Box si aplica */}
            {ticket.is_box_purchase && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center">
                  <Package className="w-5 h-5 text-orange-600 mr-2" />
                  <div>
                    <p className="font-medium text-orange-800">
                      {ticket.box_full_purchase ? 'Box Completo' : 'Puestos en Box'}
                    </p>
                    <p className="text-sm text-orange-700">
                      {ticket.box_code} - {ticket.box_full_purchase ? '8 puestos' : `${ticket.quantity} puesto(s)`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Información del comprador */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center mb-4">
              <User className="w-5 h-5 text-orange-600 mr-2" />
              <h3 className="font-semibold text-gray-900">Datos del Comprador</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center">
                <User className="w-4 h-4 text-gray-400 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">Nombre</p>
                  <p className="font-medium">{ticket.buyer_name}</p>
                </div>
              </div>
              <div className="flex items-center">
                <Mail className="w-4 h-4 text-gray-400 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{ticket.buyer_email}</p>
                </div>
              </div>
              {ticket.buyer_phone && (
                <div className="flex items-center">
                  <Phone className="w-4 h-4 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Teléfono</p>
                    <p className="font-medium">{ticket.buyer_phone}</p>
                  </div>
                </div>
              )}
              {ticket.buyer_identification && (
                <div className="flex items-center">
                  <FileText className="w-4 h-4 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Identificación</p>
                    <p className="font-medium">{ticket.buyer_identification}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Información de pago */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center mb-4">
              <CreditCard className="w-5 h-5 text-orange-600 mr-2" />
              <h3 className="font-semibold text-gray-900">Información de Pago</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center">
                {getPaymentMethodIcon(ticket.payment_method)}
                <div className="ml-2">
                  <p className="text-sm text-gray-600">Método de Pago</p>
                  <p className="font-medium">{getPaymentMethodLabel(ticket.payment_method)}</p>
                </div>
              </div>
              <div className="flex items-center">
                <DollarSign className="w-4 h-4 text-gray-400 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">Monto Total</p>
                  <p className="font-medium text-lg">
                    {formatCurrency(ticket.total_price || ticket.ticket_price || ticket.price || 35)}
                  </p>
                </div>
              </div>
              {ticket.payment_reference && (
                <div className="flex items-center">
                  <Receipt className="w-4 h-4 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Referencia</p>
                    <p className="font-mono font-medium">{ticket.payment_reference}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center">
                {emailStatus.icon}
                <div className="ml-2">
                  <p className="text-sm text-gray-600">Estado del Email</p>
                  <p className={`font-medium ${emailStatus.color}`}>{emailStatus.text}</p>
                </div>
              </div>
            </div>

            {ticket.notes && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-1">Notas</p>
                <p className="text-sm bg-white p-2 rounded border">{ticket.notes}</p>
              </div>
            )}
          </div>

          {/* Voucher de Pago Móvil */}
          {ticket.payment_method === 'pago_movil' && ticket.voucher_data && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center mb-4">
                <Receipt className="w-5 h-5 text-orange-600 mr-2" />
                <h3 className="font-semibold text-gray-900">Voucher de Pago</h3>
              </div>
              <div className="bg-white border rounded-lg p-4 font-mono text-sm">
                <pre className="whitespace-pre-wrap text-xs">
                  {typeof ticket.voucher_data === 'string' 
                    ? ticket.voucher_data 
                    : JSON.stringify(ticket.voucher_data, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Estado del ticket */}
          {ticket.ticket_status === 'canjeado' && ticket.redeemed_at && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-orange-600 mr-2" />
                <div>
                  <p className="font-medium text-orange-800">Ticket Canjeado</p>
                  <p className="text-sm text-orange-700">
                    Canjeado el {formatDate(ticket.redeemed_at)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              ID: {ticket.id}
            </div>
            <div className="flex space-x-3">
              {userRole === 'admin' && (
                <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                  <Download className="w-4 h-4 mr-1 inline" />
                  Descargar PDF
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsModal;