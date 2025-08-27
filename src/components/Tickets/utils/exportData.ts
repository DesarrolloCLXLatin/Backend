import { ConcertTicket } from '../../../types';

export const exportToCSV = (tickets: ConcertTicket[], filename: string = 'tickets') => {
  // Preparar headers
  const headers = [
    'Número de Ticket',
    'Nombre del Comprador',
    'Email',
    'Teléfono',
    'Método de Pago',
    'Estado del Pago',
    'Precio',
    'Referencia',
    'Fecha de Compra',
    'Estado del Ticket',
    'Canjeado'
  ];

  // Preparar filas
  const rows = tickets.map(ticket => [
    ticket.ticket_number,
    ticket.buyer_name,
    ticket.buyer_email,
    ticket.buyer_phone || '',
    ticket.payment_method,
    ticket.payment_status,
    ticket.ticket_price || ticket.price || '35.00',
    ticket.payment_reference || '',
    new Date(ticket.created_at).toLocaleDateString(),
    ticket.ticket_status,
    ticket.ticket_status === 'canjeado' ? 'Sí' : 'No'
  ]);

  // Convertir a CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Crear blob y descargar
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToJSON = (tickets: ConcertTicket[], filename: string = 'tickets') => {
  const jsonContent = JSON.stringify(tickets, null, 2);
  
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.json`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const printTickets = (tickets: ConcertTicket[]) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Entradas - ${new Date().toLocaleDateString()}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
        @media print {
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Lista de Entradas</h1>
        <p>Fecha: ${new Date().toLocaleDateString()}</p>
      </div>
      <p>Total de entradas: ${tickets.length}</p>
      <table>
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Comprador</th>
            <th>Email</th>
            <th>Método de Pago</th>
            <th>Estado</th>
            <th>Precio</th>
          </tr>
        </thead>
        <tbody>
          ${tickets.map(ticket => `
            <tr>
              <td>${ticket.ticket_number}</td>
              <td>${ticket.buyer_name}</td>
              <td>${ticket.buyer_email}</td>
              <td>${ticket.payment_method}</td>
              <td>${ticket.payment_status}</td>
              <td>$${ticket.ticket_price || ticket.price || '35.00'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
