// src/components/Tickets/utils/ticketHelpers.ts

import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Smartphone, 
  Zap, 
  Building, 
  CreditCard, 
  ShoppingCart,
  MailCheck,
  Mail,
  MailX,
  type LucideIcon
} from 'lucide-react';
import { ConcertTicket } from '../../../types';

// ============================================
// PAYMENT METHOD HELPERS
// ============================================

export const getPaymentMethodIcon = (method: string): LucideIcon => {
  const icons: Record<string, LucideIcon> = {
    'pago_movil': Smartphone,
    'zelle': Zap,
    'transferencia': Building,
    'transferencia_nacional': Building,
    'paypal': CreditCard,
    'tienda': ShoppingCart
  };
  
  return icons[method] || CreditCard;
};

export const getPaymentMethodLabel = (method: string): string => {
  const labels: Record<string, string> = {
    'tienda': 'Tienda',
    'zelle': 'Zelle',
    'transferencia': 'Transferencia',
    'transferencia_nacional': 'Transferencia Nacional',
    'paypal': 'PayPal',
    'pago_movil': 'Pago Móvil P2C'
  };
  return labels[method] || method;
};

export const getMethodColor = (method: string): string => {
  switch (method) {
    case 'tienda':
      return 'bg-orange-100 text-orange-800';
    case 'zelle':
      return 'bg-blue-100 text-blue-800';
    case 'transferencia':
    case 'transferencia_nacional':
      return 'bg-indigo-100 text-indigo-800';
    case 'paypal':
      return 'bg-orange-100 text-orange-800';
    case 'pago_movil':
      return 'bg-[#f08772] text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// ============================================
// STATUS ICON HELPERS (LUCIDE ICONS)
// ============================================

// Type definition for status icon data
export type StatusIconData = {
  icon: LucideIcon;
  className: string;
};

// Returns Lucide icon data for payment status
export const getStatusIconData = (status: string): StatusIconData => {
  switch (status) {
    case 'confirmado':
      return { 
        icon: CheckCircle, 
        className: 'w-4 h-4 text-green-600' 
      };
    case 'rechazado':
      return { 
        icon: XCircle, 
        className: 'w-4 h-4 text-red-600' 
      };
    default:
      return { 
        icon: Clock, 
        className: 'w-4 h-4 text-yellow-600' 
      };
  }
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'confirmado':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'rechazado':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }
};

export const getTicketStatusColor = (status: string): string => {
  switch (status) {
    case 'canjeado':
      return 'bg-orange-100 text-orange-800';
    case 'cancelado':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// ============================================
// EMAIL STATUS HELPERS
// ============================================

export type EmailStatusData = {
  icon: LucideIcon;
  className: string;
  text: string;
  color: string;
};

export const getEmailStatusData = (ticket: ConcertTicket): EmailStatusData => {
  const getStatusInfo = () => {
    if (ticket.payment_method === 'pago_movil' && ticket.payment_status === 'confirmado') {
      return { 
        icon: MailCheck,
        className: 'w-4 h-4 text-green-600',
        text: 'Confirmación enviada',
        color: 'text-green-600'
      };
    }

    const emailSent = ticket.email_sent || ticket.receipt_sent || ticket.email_sent_at;

    if (ticket.payment_status === 'pendiente') {
      if (emailSent) {
        return { 
          icon: Clock,
          className: 'w-4 h-4 text-yellow-600',
          text: 'Verificación enviada',
          color: 'text-yellow-600'
        };
      }
      return { 
        icon: Mail,
        className: 'w-4 h-4 text-gray-400',
        text: 'Pendiente envío',
        color: 'text-gray-400'
      };
    }

    if (ticket.payment_status === 'confirmado') {
      if (emailSent || ticket.receipt_sent) {
        return { 
          icon: MailCheck,
          className: 'w-4 h-4 text-green-600',
          text: 'Confirmación enviada',
          color: 'text-green-600'
        };
      }
      return { 
        icon: Mail,
        className: 'w-4 h-4 text-orange-500',
        text: 'Falta enviar confirmación',
        color: 'text-orange-500'
      };
    }

    if (ticket.payment_status === 'rechazado') {
      if (emailSent) {
        return { 
          icon: MailX,
          className: 'w-4 h-4 text-red-600',
          text: 'Rechazo enviado',
          color: 'text-red-600'
        };
      }
      return { 
        icon: Mail,
        className: 'w-4 h-4 text-red-400',
        text: 'Falta enviar rechazo',
        color: 'text-red-400'
      };
    }

    return { 
      icon: Mail,
      className: 'w-4 h-4 text-gray-400',
      text: 'Sin enviar',
      color: 'text-gray-400'
    };
  };

  return getStatusInfo();
};

export const calculateEmailStats = (tickets: ConcertTicket[]) => {
  const today = new Date().toDateString();
  
  const todayTickets = tickets.filter(ticket => {
    const ticketDate = new Date(ticket.created_at).toDateString();
    return ticketDate === today;
  });

  return {
    sent_today: todayTickets.filter(ticket => 
      ticket.email_sent || 
      ticket.receipt_sent || 
      (ticket.payment_method === 'pago_movil' && ticket.payment_status === 'confirmado')
    ).length,

    pending_verification: tickets.filter(ticket => 
      ticket.payment_status === 'pendiente' && 
      (ticket.email_sent || ticket.receipt_sent)
    ).length,

    confirmed: tickets.filter(ticket => 
      ticket.payment_status === 'confirmado' && 
      (ticket.receipt_sent || ticket.email_sent || ticket.payment_method === 'pago_movil')
    ).length,

    rejected: tickets.filter(ticket => 
      ticket.payment_status === 'rechazado' && ticket.email_sent
    ).length,

    p2c_confirmed_today: todayTickets.filter(ticket => 
      ticket.payment_method === 'pago_movil' && ticket.payment_status === 'confirmado'
    ).length,

    manual_pending_today: todayTickets.filter(ticket => 
      ['transferencia_nacional', 'zelle', 'paypal'].includes(ticket.payment_method) && 
      ticket.payment_status === 'pendiente'
    ).length
  };
};

export const getEmailStatus = (ticket: any) => {
  // Si el ticket no tiene emails, retornar estado por defecto
  if (!ticket.emails || ticket.emails.length === 0) {
    return {
      status: 'no_emails',
      label: 'Sin emails',
      color: 'gray',
      icon: '📭'
    };
  }

  // Obtener el último email
  const lastEmail = ticket.emails[ticket.emails.length - 1];
  
  // Determinar el estado basado en el último email
  if (lastEmail.type === 'received' || lastEmail.direction === 'inbound') {
    return {
      status: 'pending_response',
      label: 'Esperando respuesta',
      color: 'yellow',
      icon: '📨',
      lastEmailFrom: lastEmail.from,
      lastEmailDate: lastEmail.date || lastEmail.createdAt
    };
  }
  
  if (lastEmail.type === 'sent' || lastEmail.direction === 'outbound') {
    return {
      status: 'responded',
      label: 'Respondido',
      color: 'green',
      icon: '✉️',
      lastEmailTo: lastEmail.to,
      lastEmailDate: lastEmail.date || lastEmail.createdAt
    };
  }

  // Estado por defecto si no se puede determinar
  return {
    status: 'unknown',
    label: 'Estado desconocido',
    color: 'gray',
    icon: '📧'
  };
};

export const getTimeSinceLastEmail = (ticket: any): string => {
  if (!ticket.emails || ticket.emails.length === 0) {
    return 'Sin actividad';
  }

  const lastEmail = ticket.emails[ticket.emails.length - 1];
  const lastEmailDate = new Date(lastEmail.date || lastEmail.createdAt);
  const now = new Date();
  const diffMs = now.getTime() - lastEmailDate.getTime();
  
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `Hace ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
  } else if (diffHours < 24) {
    return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
  } else {
    return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
  }
};

export const getEmailStats = (ticket: any) => {
  if (!ticket.emails || ticket.emails.length === 0) {
    return {
      totalEmails: 0,
      sentEmails: 0,
      receivedEmails: 0,
      avgResponseTime: null
    };
  }

  const sentEmails = ticket.emails.filter((email: any) => 
    email.type === 'sent' || email.direction === 'outbound'
  ).length;
  
  const receivedEmails = ticket.emails.filter((email: any) => 
    email.type === 'received' || email.direction === 'inbound'
  ).length;

  return {
    totalEmails: ticket.emails.length,
    sentEmails,
    receivedEmails,
    avgResponseTime: calculateAvgResponseTime(ticket.emails)
  };
};

const calculateAvgResponseTime = (emails: any[]): string | null => {
  if (emails.length < 2) return null;

  const responseTimes: number[] = [];
  
  for (let i = 1; i < emails.length; i++) {
    const prevEmail = emails[i - 1];
    const currEmail = emails[i];
    
    // Solo calcular si hay un cambio de dirección (respuesta)
    if (prevEmail.direction !== currEmail.direction) {
      const prevDate = new Date(prevEmail.date || prevEmail.createdAt);
      const currDate = new Date(currEmail.date || currEmail.createdAt);
      const diffMs = currDate.getTime() - prevDate.getTime();
      responseTimes.push(diffMs);
    }
  }

  if (responseTimes.length === 0) return null;

  const avgMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const avgHours = Math.floor(avgMs / 3600000);
  const avgMins = Math.floor((avgMs % 3600000) / 60000);

  if (avgHours > 0) {
    return `${avgHours}h ${avgMins}m`;
  } else {
    return `${avgMins}m`;
  }
};

export const getEmailPriority = (ticket: any): 'high' | 'medium' | 'low' => {
  const emailStatus = getEmailStatus(ticket);
  const timeSince = getTimeSinceLastEmail(ticket);
  
  // Alta prioridad si está esperando respuesta hace más de 24 horas
  if (emailStatus.status === 'pending_response') {
    const lastEmailDate = emailStatus.lastEmailDate;
    if (lastEmailDate) {
      const hoursSince = (Date.now() - new Date(lastEmailDate).getTime()) / 3600000;
      if (hoursSince > 24) return 'high';
      if (hoursSince > 8) return 'medium';
    }
  }
  
  return 'low';
};

// ============================================
// EMOJI STATUS ICONS (Alternative System)
// ============================================

// Interface for emoji icon data
export interface EmojiStatusIconData {
  icon: string;
  color: string;
  bgColor?: string;
}

// Returns emoji as string
export const getStatusIcon = (status: string): string => {
  const statusIcons: Record<string, string> = {
    // Estados principales del ticket
    'open': '🔵',
    'pending': '🟡',
    'in_progress': '🔄',
    'resolved': '✅',
    'closed': '🔒',
    'cancelled': '❌',
    'on_hold': '⏸️',
    'waiting': '⏳',
    'blocked': '🚫',
    
    // Estados de prioridad
    'urgent': '🔴',
    'high': '🟠',
    'medium': '🟡',
    'low': '🟢',
    
    // Estados de email
    'responded': '✉️',
    'pending_response': '📨',
    'no_emails': '📭',
    'new_message': '💬',
    
    // Estados de asignación
    'assigned': '👤',
    'unassigned': '👥',
    'escalated': '⬆️',
    
    // Estados de revisión
    'reviewing': '👀',
    'approved': '✔️',
    'rejected': '✖️',
    'needs_info': '❓',
    
    // Estados de sistema
    'automated': '🤖',
    'manual': '✋',
    'scheduled': '📅',
    'expired': '⌛',
    
    // Default
    'unknown': '❔',
    'default': '📋'
  };

  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_');
  return statusIcons[normalizedStatus] || statusIcons['default'];
};

// Returns object with emoji icon and colors
export const getEmojiStatusIconData = (status: string): EmojiStatusIconData => {
  const statusData: Record<string, EmojiStatusIconData> = {
    'open': { 
      icon: '🔵', 
      color: '#3B82F6',
      bgColor: '#EFF6FF'
    },
    'pending': { 
      icon: '🟡', 
      color: '#F59E0B',
      bgColor: '#FEF3C7'
    },
    'in_progress': { 
      icon: '🔄', 
      color: '#8B5CF6',
      bgColor: '#EDE9FE'
    },
    'resolved': { 
      icon: '✅', 
      color: '#10B981',
      bgColor: '#D1FAE5'
    },
    'closed': { 
      icon: '🔒', 
      color: '#6B7280',
      bgColor: '#F3F4F6'
    },
    'cancelled': { 
      icon: '❌', 
      color: '#EF4444',
      bgColor: '#FEE2E2'
    },
    'on_hold': { 
      icon: '⏸️', 
      color: '#F97316',
      bgColor: '#FED7AA'
    },
    'waiting': { 
      icon: '⏳', 
      color: '#FBBF24',
      bgColor: '#FEF3C7'
    },
    'blocked': { 
      icon: '🚫', 
      color: '#DC2626',
      bgColor: '#FECACA'
    },
    'urgent': { 
      icon: '🔴', 
      color: '#DC2626',
      bgColor: '#FEE2E2'
    },
    'high': { 
      icon: '🟠', 
      color: '#EA580C',
      bgColor: '#FED7AA'
    },
    'medium': { 
      icon: '🟡', 
      color: '#F59E0B',
      bgColor: '#FEF3C7'
    },
    'low': { 
      icon: '🟢', 
      color: '#16A34A',
      bgColor: '#DCFCE7'
    },
    'default': { 
      icon: '📋', 
      color: '#9CA3AF',
      bgColor: '#F9FAFB'
    }
  };

  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_');
  return statusData[normalizedStatus] || statusData['default'];
};

export const getStatusIconHTML = (status: string): string => {
  const iconData = getEmojiStatusIconData(status);
  return `<span style="color: ${iconData.color};">${iconData.icon}</span>`;
};

export const getStatusClassName = (status: string): string => {
  const statusClasses: Record<string, string> = {
    'open': 'text-blue-600 bg-blue-100',
    'pending': 'text-yellow-600 bg-yellow-100',
    'in_progress': 'text-purple-600 bg-purple-100',
    'resolved': 'text-green-600 bg-green-100',
    'closed': 'text-gray-600 bg-gray-100',
    'cancelled': 'text-red-600 bg-red-100',
    'on_hold': 'text-orange-600 bg-orange-100',
    'urgent': 'text-red-700 bg-red-100',
    'high': 'text-orange-700 bg-orange-100',
    'medium': 'text-yellow-700 bg-yellow-100',
    'low': 'text-green-700 bg-green-100',
    'default': 'text-gray-500 bg-gray-50'
  };
  
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_');
  return statusClasses[normalizedStatus] || statusClasses['default'];
};

export const getStatusLabel = (status: string): string => {
  const statusLabels: Record<string, string> = {
    'open': 'Abierto',
    'pending': 'Pendiente',
    'in_progress': 'En Progreso',
    'resolved': 'Resuelto',
    'closed': 'Cerrado',
    'cancelled': 'Cancelado',
    'on_hold': 'En Espera',
    'waiting': 'Esperando',
    'blocked': 'Bloqueado',
    'urgent': 'Urgente',
    'high': 'Alta',
    'medium': 'Media',
    'low': 'Baja',
    'assigned': 'Asignado',
    'unassigned': 'Sin Asignar',
    'escalated': 'Escalado',
    'reviewing': 'En Revisión',
    'approved': 'Aprobado',
    'rejected': 'Rechazado',
    'needs_info': 'Necesita Información',
    'default': 'Sin Estado'
  };
  
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_');
  return statusLabels[normalizedStatus] || status;
};

// ============================================
// SVG PATH HELPERS
// ============================================

export const getStatusSvgPath = (status: string): { viewBox: string; path: string; fill?: string; stroke?: string } => {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_');
  
  const svgPaths: Record<string, { viewBox: string; path: string; fill?: string; stroke?: string }> = {
    'open': {
      viewBox: '0 0 20 20',
      path: 'M10 2a8 8 0 100 16 8 8 0 000-16z',
      fill: '#3B82F6'
    },
    'pending': {
      viewBox: '0 0 20 20',
      path: 'M10 2a8 8 0 100 16 8 8 0 000-16z',
      fill: '#F59E0B'
    },
    'resolved': {
      viewBox: '0 0 24 24',
      path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      stroke: 'currentColor',
      fill: 'none'
    },
    'closed': {
      viewBox: '0 0 24 24',
      path: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      stroke: 'currentColor',
      fill: 'none'
    },
    'default': {
      viewBox: '0 0 24 24',
      path: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      stroke: 'currentColor',
      fill: 'none'
    }
  };
  
  return svgPaths[normalizedStatus] || svgPaths['default'];
};

// ============================================
// STATUS UTILITY FUNCTIONS
// ============================================

export const isFinalStatus = (status: string): boolean => {
  const finalStatuses = ['resolved', 'closed', 'cancelled', 'rejected'];
  return finalStatuses.includes(status.toLowerCase());
};

export const requiresAction = (status: string): boolean => {
  const actionStatuses = ['open', 'pending', 'waiting', 'needs_info', 'pending_response'];
  return actionStatuses.includes(status.toLowerCase());
};

export const getNextPossibleStatuses = (currentStatus: string): string[] => {
  const statusTransitions: Record<string, string[]> = {
    'open': ['in_progress', 'pending', 'on_hold', 'resolved', 'cancelled'],
    'pending': ['in_progress', 'on_hold', 'resolved', 'cancelled'],
    'in_progress': ['pending', 'on_hold', 'resolved', 'closed', 'cancelled'],
    'on_hold': ['in_progress', 'pending', 'resolved', 'cancelled'],
    'resolved': ['closed', 'open'],
    'closed': ['open'],
    'cancelled': ['open']
  };
  
  const normalizedStatus = currentStatus.toLowerCase().replace(/\s+/g, '_');
  return statusTransitions[normalizedStatus] || ['open'];
};