import React from 'react';
import { X, Mail, Send, Eye } from 'lucide-react';
import { ConcertTicket } from '../../../../types';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: ConcertTicket;
  emailType: 'confirmation' | 'rejection' | 'verification';
  onSend?: () => void;
}

const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  isOpen,
  onClose,
  ticket,
  emailType,
  onSend
}) => {
  if (!isOpen) return null;

  const getEmailContent = () => {
    switch (emailType) {
      case 'confirmation':
        return {
          subject: `✅ Confirmación de Entrada - ${ticket.ticket_number}`,
          preview: 'Su pago ha sido confirmado exitosamente',
          body: `
            <h2>¡Gracias por su compra!</h2>
            <p>Estimado/a ${ticket.buyer_name},</p>
            <p>Su pago ha sido confirmado exitosamente y su entrada está lista.</p>
            
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Detalles de su entrada:</h3>
              <ul>
                <li><strong>Número de Ticket:</strong> ${ticket.ticket_number}</li>
                <li><strong>Evento:</strong> Concierto Wynwood Park</li>
                <li><strong>Fecha:</strong> 08 de Noviembre, 2025</li>
                <li><strong>Precio:</strong> $${ticket.ticket_price || '35.00'} USD</li>
              </ul>
            </div>
            
            <p><strong>Importante:</strong> Presente este email o el código QR adjunto en la entrada.</p>
          `
        };
      
      case 'rejection':
        return {
          subject: `❌ Pago Rechazado - ${ticket.ticket_number}`,
          preview: 'Su pago no pudo ser verificado',
          body: `
            <h2>Información sobre su pago</h2>
            <p>Estimado/a ${ticket.buyer_name},</p>
            <p>Lamentamos informarle que su pago no pudo ser verificado.</p>
            
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Motivo:</strong> El pago no pudo ser verificado en nuestros registros bancarios.</p>
            </div>
            
            <p>Por favor, contacte con nosotros para más información o realice una nueva compra.</p>
          `
        };
      
      case 'verification':
        return {
          subject: `⏳ Verificación de Pago Pendiente - ${ticket.ticket_number}`,
          preview: 'Su pago está siendo verificado',
          body: `
            <h2>Pago en proceso de verificación</h2>
            <p>Estimado/a ${ticket.buyer_name},</p>
            <p>Hemos recibido su orden y estamos verificando su pago.</p>
            
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Información de su orden:</h3>
              <ul>
                <li><strong>Número de Orden:</strong> ${ticket.ticket_number}</li>
                <li><strong>Método de Pago:</strong> ${ticket.payment_method}</li>
                <li><strong>Monto:</strong> $${ticket.ticket_price || '35.00'} USD</li>
              </ul>
            </div>
            
            <p>Le notificaremos por email una vez que su pago sea confirmado.</p>
          `
        };
    }
  };

  const emailContent = getEmailContent();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Mail className="w-5 h-5 mr-2" />
            Vista Previa del Email
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Header del email */}
          <div className="mb-4 pb-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Para:</span>
              <span className="text-sm font-medium">{ticket.buyer_email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Asunto:</span>
              <span className="text-sm font-medium">{emailContent.subject}</span>
            </div>
          </div>

          {/* Preview text */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800">
              <Eye className="w-4 h-4 inline mr-1" />
              Vista previa: {emailContent.preview}
            </p>
          </div>

          {/* Contenido del email */}
          <div className="bg-gray-50 rounded-lg p-6">
            <div dangerouslySetInnerHTML={{ __html: emailContent.body }} />
          </div>

          {/* Footer del email */}
          <div className="mt-6 pt-4 border-t text-center text-sm text-gray-500">
            <p>Este es un email automático. Por favor no responda a este mensaje.</p>
            <p className="mt-2">© 2025 Wynwood Park Concert. Todos los derechos reservados.</p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="bg-gray-50 px-6 py-4 border-t flex justify-end space-x-3">
          {onSend && (
            <button
              onClick={onSend}
              className="px-4 py-2 bg-gradient-to-r from-orange-600 to-[#f08772] text-white rounded-md hover:shadow-lg transition-all flex items-center"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar Email
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailPreviewModal;