// utils/iframeCommunication.js
// Este archivo debe incluirse tanto en el iframe como en el sitio padre

export class IframeCommunicator {
  constructor(options = {}) {
    this.targetOrigin = options.targetOrigin || '*';
    this.isIframe = window.self !== window.top;
    this.handlers = new Map();
    
    // Escuchar mensajes
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  // Registrar handler para un tipo de mensaje
  on(type, handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type).push(handler);
  }

  // Quitar handler
  off(type, handler) {
    if (this.handlers.has(type)) {
      const handlers = this.handlers.get(type);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Enviar mensaje
  send(type, data = {}) {
    const message = {
      type,
      timestamp: Date.now(),
      ...data
    };

    if (this.isIframe) {
      // Enviar al padre
      window.parent.postMessage(message, this.targetOrigin);
    } else {
      // Enviar al iframe (necesita referencia)
      const iframe = document.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(message, this.targetOrigin);
      }
    }
  }

  // Manejar mensajes entrantes
  handleMessage(event) {
    // Validar origen si es necesario
    if (this.targetOrigin !== '*' && event.origin !== this.targetOrigin) {
      return;
    }

    const { type } = event.data;
    if (type && this.handlers.has(type)) {
      this.handlers.get(type).forEach(handler => {
        handler(event.data, event);
      });
    }
  }
}

// Tipos de mensajes predefinidos
export const MESSAGE_TYPES = {
  // Del iframe al padre
  READY: 'iframe_ready',
  RESIZE: 'iframe_resize',
  PAYMENT_INITIATED: 'payment_initiated',
  PAYMENT_COMPLETED: 'payment_completed',
  PAYMENT_ERROR: 'payment_error',
  CLOSE_REQUESTED: 'close_requested',
  
  // Del padre al iframe
  UPDATE_CONFIG: 'update_config',
  RESET_FORM: 'reset_form',
  GET_STATUS: 'get_status'
};

// Helpers específicos para el iframe
export class IframeHelper extends IframeCommunicator {
  constructor(options = {}) {
    super(options);
    
    // Notificar que el iframe está listo
    setTimeout(() => {
      this.send(MESSAGE_TYPES.READY, {
        height: document.body.scrollHeight
      });
    }, 100);
    
    // Observar cambios de tamaño
    this.setupResizeObserver();
  }

  setupResizeObserver() {
    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          this.send(MESSAGE_TYPES.RESIZE, {
            height: entry.target.scrollHeight,
            width: entry.target.scrollWidth
          });
        }
      });
      
      resizeObserver.observe(document.body);
    }
  }

  // Notificar inicio de pago
  notifyPaymentInitiated(transactionData) {
    this.send(MESSAGE_TYPES.PAYMENT_INITIATED, {
      transactionId: transactionData.transactionId,
      amount: transactionData.paymentDetails.amount,
      tickets: transactionData.tickets.length
    });
  }

  // Notificar pago completado
  notifyPaymentCompleted(paymentData) {
    this.send(MESSAGE_TYPES.PAYMENT_COMPLETED, {
      transactionId: paymentData.transactionId,
      reference: paymentData.reference,
      tickets: paymentData.tickets,
      downloadUrl: paymentData.downloadUrl,
      voucher: paymentData.voucher
    });
  }

  // Notificar error
  notifyError(error) {
    this.send(MESSAGE_TYPES.PAYMENT_ERROR, {
      message: error.message || 'Error desconocido',
      code: error.code
    });
  }

  // Solicitar cierre
  requestClose() {
    this.send(MESSAGE_TYPES.CLOSE_REQUESTED);
  }
}

// Helpers específicos para el sitio padre
export class ParentHelper extends IframeCommunicator {
  constructor(iframeElement, options = {}) {
    super(options);
    this.iframe = iframeElement;
    
    // Handlers por defecto
    this.on(MESSAGE_TYPES.READY, this.handleIframeReady.bind(this));
    this.on(MESSAGE_TYPES.RESIZE, this.handleIframeResize.bind(this));
  }

  handleIframeReady(data) {
    console.log('Iframe ready:', data);
    if (this.onReady) {
      this.onReady(data);
    }
  }

  handleIframeResize(data) {
    if (this.iframe && data.height) {
      this.iframe.style.height = `${data.height + 20}px`;
    }
  }

  // Actualizar configuración del iframe
  updateConfig(config) {
    this.send(MESSAGE_TYPES.UPDATE_CONFIG, config);
  }

  // Resetear formulario
  resetForm() {
    this.send(MESSAGE_TYPES.RESET_FORM);
  }

  // Obtener estado
  getStatus() {
    this.send(MESSAGE_TYPES.GET_STATUS);
  }
}

// Ejemplo de uso en el iframe (React)
/*
import { IframeHelper, MESSAGE_TYPES } from './utils/iframeCommunication';

const iframeComm = new IframeHelper({
  targetOrigin: process.env.REACT_APP_PARENT_ORIGIN || '*'
});

// En el componente
const handlePaymentSuccess = (data) => {
  iframeComm.notifyPaymentCompleted(data);
};

// Escuchar mensajes del padre
iframeComm.on(MESSAGE_TYPES.RESET_FORM, () => {
  setFormData(initialFormData);
});
*/

// Ejemplo de uso en el sitio padre
/*
import { ParentHelper, MESSAGE_TYPES } from './iframeCommunication';

const iframe = document.getElementById('ticketIframe');
const parentComm = new ParentHelper(iframe, {
  targetOrigin: 'https://tu-dominio.com'
});

// Configurar handlers
parentComm.on(MESSAGE_TYPES.PAYMENT_COMPLETED, (data) => {
  console.log('Pago completado:', data);
  // Mostrar mensaje de éxito, redirigir, etc.
});

parentComm.on(MESSAGE_TYPES.PAYMENT_ERROR, (data) => {
  console.error('Error en el pago:', data);
  // Mostrar mensaje de error
});

// Callback cuando el iframe está listo
parentComm.onReady = (data) => {
  console.log('Iframe cargado y listo');
};
*/