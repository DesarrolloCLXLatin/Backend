// emailTemplates.js - Templates de email para evitar problemas con template literals

export const getConfirmationEmailHTML = () => {

const htmlTemplate = '<!DOCTYPE html>' +
'<html lang="es">' +
'<head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>¡Tus Entradas están Confirmadas!</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@700&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="https://maxst.icons8.com/vue-static/landings/line-awesome/font-awesome-line-awesome/css/all.min.css">' +
    '<!--[if mso]>' +
    '<noscript>' +
        '<xml>' +
            '<o:OfficeDocumentSettings>' +
                '<o:PixelsPerInch>96</o:PixelsPerInch>' +
            '</o:OfficeDocumentSettings>' +
        '</xml>' +
    '</noscript>' +
    '<![endif]-->' +
'</head>' +
'<body style="margin: 0; padding: 0; font-family: Arial, \'Helvetica Neue\', Helvetica, sans-serif; background-color: #000000ff;">' +
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #000000ff;">' +
        '<tr>' +
            '<td align="center" style="padding: 20px 0;">' +
                '<!-- Email Container -->' +
                '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">' +
                    '' +
                    '<!-- Header -->' +
                    '<tr>' +
                        '<td style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); background-color: #1a1a1a; padding: 40px 30px; text-align: center;">' +
                            '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">' +
                                '<tr>' +
                                    '<td align="center" style="padding-bottom: 20px;">' +
                                        '<img src="https://admin.clxnightrun.com/Logo-Email.gif" alt="Logo" width="200" style="display: block; border: 0; max-width: 100%; height: auto;">' +
                                    '</td>' +
                                '</tr>' +
                                '<tr>' +
                                    '<td align="center">' +
                                        '<h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; font-family: \'Verdana\', sans-serif;">CONFIRMACIÓN DE COMPRA</h1>' +
                                    '</td>' +
                                '</tr>' +
                            '</table>' +
                        '</td>' +
                    '</tr>' +
                    '' +
                    '<!-- Content -->' +
                    '<tr>' +
                        '<td style="padding: 40px 30px;">' +
                            '<!-- Greeting -->' +
                            '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">' +
                                '<tr>' +
                                    '<td style="padding-bottom: 20px;">' +
                                        '<h2 style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: bold;">¡Hola {{buyerName}}! 🎊</h2>' +
                                    '</td>' +
                                '</tr>' +
                                '' +
                                '<!-- Message -->' +
                                '<tr>' +
                                    '<td style="padding-bottom: 30px;">' +
                                        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border-left: 4px solid #f08772;">' +
                                            '<tr>' +
                                                '<td style="padding: 20px;">' +
                                                    '<p style="margin: 0; color: #4a5568; line-height: 1.6; font-size: 16px;">' +
                                                        '<strong>¡Excelentes noticias!</strong> Tu compra ha sido confirmada exitosamente. ' +
                                                        '{{#if isBox}}' +
                                                        'Has adquirido el <strong>Box {{boxCode}}</strong> completo para disfrutar del concierto con total comodidad y exclusividad.' +
                                                        '{{else}}' +
                                                        'Has adquirido <strong>{{ticketCount}} entrada(s)</strong> para el concierto.' +
                                                        '{{/if}}' +
                                                        'Prepárate para vivir una experiencia única e inolvidable.' +
                                                    '</p>' +
                                                '</td>' +
                                            '</tr>' +
                                        '</table>' +
                                    '</td>' +
                                '</tr>' +

                                '<!-- Ticket/Box Container -->' +
                                '{{#if isBox}}' +
                                '<tr>' +
                                    '<td style="padding-bottom: 30px;">' +
                                        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 8px;">' +
                                            '<tr>' +
                                                '<td style="padding: 25px;">' +
                                                    '<!-- Box Header -->' +
                                                    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-bottom: 2px dashed #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">' +
                                                        '<tr>' +
                                                            '<td align="left">' +
                                                                '<span style="background-color: #f08772; color: white; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase;">BOX PREMIUM VIP</span>' +
                                                            '</td>' +
                                                            '<td align="right">' +
                                                                '<span style="color: #1a1a1a; font-size: 20px; font-weight: bold;">{{boxCode}}</span>' +
                                                            '</td>' +
                                                        '</tr>' +
                                                    '</table>' +
                                                    '' +
                                                    '<!-- Box Details -->' +
                                                    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">' +
                                                        '<tr>' +
                                                            '<td width="50%" style="padding: 10px;">' +
                                                                '<div style="color: #718096; font-size: 11px; text-transform: uppercase; margin-bottom: 5px;">CAPACIDAD</div>' +
                                                                '<div style="color: #1a1a1a; font-size: 18px; font-weight: bold;">{{boxCapacity}} personas</div>' +
                                                            '</td>' +
                                                            '<td width="50%" style="padding: 10px;">' +
                                                                '<div style="color: #718096; font-size: 11px; text-transform: uppercase; margin-bottom: 5px;">NIVEL</div>' +
                                                                '<div style="color: #1a1a1a; font-size: 18px; font-weight: bold;">{{boxLevel}}</div>' +
                                                            '</td>' +
                                                        '</tr>' +
                                                        '<tr>' +
                                                            '<td width="50%" style="padding: 10px;">' +
                                                                '<div style="color: #718096; font-size: 11px; text-transform: uppercase; margin-bottom: 5px;">FECHA</div>' +
                                                                '<div style="color: #1a1a1a; font-size: 18px; font-weight: bold;">{{eventDate}}</div>' +
                                                            '</td>' +
                                                            '<td width="50%" style="padding: 10px;">' +
                                                                '<div style="color: #718096; font-size: 11px; text-transform: uppercase; margin-bottom: 5px;">HORA</div>' +
                                                                '<div style="color: #1a1a1a; font-size: 18px; font-weight: bold;">{{eventTime}}</div>' +
                                                            '</td>' +
                                                        '</tr>' +
                                                        '<tr>' +
                                                            '<td colspan="2" style="padding: 10px;">' +
                                                                '<div style="color: #718096; font-size: 11px; text-transform: uppercase; margin-bottom: 5px;">AMENIDADES INCLUIDAS</div>' +
                                                                '<div style="color: #1a1a1a; font-size: 16px; font-weight: bold;">{{amenities}}</div>' +
                                                            '</td>' +
                                                        '</tr>' +
                                                    '</table>' +
                                                '</td>' +
                                            '</tr>' +
                                        '</table>' +
                                    '</td>' +
                                '</tr>' +
                                '{{else}}' +
                                '{{#each tickets}}' +
                                '<tr>' +
                                    '<td style="padding-bottom: 30px;">' +
                                        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 8px;">' +
                                            '<tr>' +
                                                '<td style="padding: 25px;">' +
                                                    '<!-- Ticket Header -->' +
                                                    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-bottom: 2px dashed #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">' +
                                                        '<tr>' +
                                                            '<td align="left">' +
                                                                '<span style="background-color: #f08772; color: white; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase;">{{this.ticketType}}</span>' +
                                                            '</td>' +
                                                        '</tr>' +
                                                    '</table>' +
                                                    '' +
                                                    '<!-- Ticket Details -->' +
                                                    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">' +
                                                        '<tr>' +
                                                            '<td width="50%" style="padding: 10px;">' +
                                                                '<div style="color: #718096; font-size: 11px; text-transform: uppercase; margin-bottom: 5px;">ASIENTO</div>' +
                                                                '<div style="color: #1a1a1a; font-size: 18px; font-weight: bold;">{{this.seatNumber}}</div>' +
                                                            '</td>' +
                                                            '<td width="50%" style="padding: 10px;">' +
                                                                '<div style="color: #718096; font-size: 11px; text-transform: uppercase; margin-bottom: 5px;">ZONA</div>' +
                                                                '<div style="color: #1a1a1a; font-size: 18px; font-weight: bold;">{{this.zone}}</div>' +
                                                            '</td>' +
                                                        '</tr>' +
                                                        '<tr>' +
                                                            '<td width="50%" style="padding: 10px;">' +
                                                                '<div style="color: #718096; font-size: 11px; text-transform: uppercase; margin-bottom: 5px;">FECHA</div>' +
                                                                '<div style="color: #1a1a1a; font-size: 18px; font-weight: bold;">{{../eventDate}}</div>' +
                                                            '</td>' +
                                                            '<td width="50%" style="padding: 10px;">' +
                                                                '<div style="color: #718096; font-size: 11px; text-transform: uppercase; margin-bottom: 5px;">HORA</div>' +
                                                                '<div style="color: #1a1a1a; font-size: 18px; font-weight: bold;">{{../eventTime}}</div>' +
                                                            '</td>' +
                                                        '</tr>' +
                                                    '</table>' +
                                                    '' +
                                                    '<!-- QR and Barcode -->' +
                                                    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 20px;">' +
                                                        '<tr>' +
                                                            '<td align="center" style="background-color: #000000; padding: 20px; border-radius: 8px;">' +
                                                                '<table role="presentation" cellspacing="0" cellpadding="0" border="0">' +
                                                                    '<tr>' +
                                                                        '<td align="center" style="padding: 0 20px;">' +
                                                                            '<div style="color: #f08772; font-size: 12px; text-transform: uppercase; margin-bottom: 10px; font-weight: bold;"><span style="color: #f08772; font-size: 20px; font-weight: bold;">#{{this.ticketNumber}}</span></div>' +
                                                                            '<img src="cid:qr_{{@index}}" alt="QR Code" width="120" height="120" style="border: 2px solid #000000; padding: 8px; background-color: white; border-radius: 8px;">' +
                                                                        '</td>' +
                                                                    '</tr>' +
                                                                '</table>' +
                                                            '</td>' +
                                                        '</tr>' +
                                                    '</table>' +
                                                '</td>' +
                                            '</tr>' +
                                        '</table>' +
                                    '</td>' +
                                '</tr>' +
                                '{{/each}}' +
                                '{{/if}}' +

                                '<!-- Resumen de Compra -->' +
                                '<tr>' +
                                    '<td style="padding-bottom: 30px;">' +
                                        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border-radius: 8px;">' +
                                            '<tr>' +
                                                '<td style="padding: 20px;">' +
                                                    '<h3 style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 18px; font-weight: bold;">' +
                                                        '📋 Resumen de compra' +
                                                    '</h3>' +
                                                    '' +
                                                    '<!-- Tabla de resumen -->' +
                                                    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: white; border-radius: 6px;">' +
                                                        '<thead>' +
                                                            '<tr style="background-color: #e2e8f0;">' +
                                                                '<th style="padding: 10px; text-align: left; font-size: 12px; color: #4a5568; font-weight: 600; border-bottom: 1px solid #cbd5e0;">Descripción</th>' +
                                                                '<th style="padding: 10px; text-align: center; font-size: 12px; color: #4a5568; font-weight: 600; border-bottom: 1px solid #cbd5e0;">Cantidad</th>' +
                                                                '<th style="padding: 10px; text-align: right; font-size: 12px; color: #4a5568; font-weight: 600; border-bottom: 1px solid #cbd5e0;">P.Unit</th>' +
                                                                '<th style="padding: 10px; text-align: right; font-size: 12px; color: #4a5568; font-weight: 600; border-bottom: 1px solid #cbd5e0;">Total</th>' +
                                                            '</tr>' +
                                                        '</thead>' +
                                                        '<tbody>' +
                                                            '<tr>' +
                                                                '<td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0;">' +
                                                                    '<div style="font-weight: 600; color: #1a1a1a; font-size: 14px;">' +
                                                                        '{{#if isBox}}' +
                                                                        'BOX {{boxCode}}' +
                                                                        '{{else}}' +
                                                                        '{{zoneName}}' +
                                                                        '{{/if}}' +
                                                                    '</div>' +
                                                                    '<div style="font-size: 11px; color: #718096; margin-top: 2px;">' +
                                                                        '{{#if isBox}}' +
                                                                        'Box Premium VIP' +
                                                                        '{{else}}' +
                                                                        '{{#if seatNumbers}}' +
                                                                        'Asientos: {{seatNumbers}}' +
                                                                        '{{else}}' +
                                                                        'Entrada General' +
                                                                        '{{/if}}' +
                                                                        '{{/if}}' +
                                                                    '</div>' +
                                                                '</td>' +
                                                                '<td style="padding: 12px 10px; text-align: center; color: #4a5568; font-size: 14px; border-bottom: 1px solid #e2e8f0;">' +
                                                                    '{{ticketCount}}' +
                                                                '</td>' +
                                                                '<td style="padding: 12px 10px; text-align: right; color: #4a5568; font-size: 14px; border-bottom: 1px solid #e2e8f0;">' +
                                                                    '${{pricePerTicket}}' +
                                                                '</td>' +
                                                                '<td style="padding: 12px 10px; text-align: right; color: #1a1a1a; font-weight: 600; font-size: 14px; border-bottom: 1px solid #e2e8f0;">' +
                                                                    '${{subtotal}}' +
                                                                '</td>' +
                                                            '</tr>' +
                                                            '' +
                                                            '{{#if serviceFee}}' +
                                                            '<tr>' +
                                                                '<td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0;">' +
                                                                    '<div style="font-weight: 600; color: #1a1a1a; font-size: 14px;">' +
                                                                        'Servicio Web' +
                                                                    '</div>' +
                                                                    '<div style="font-size: 11px; color: #718096; margin-top: 2px;">' +
                                                                        'Cargo por procesamiento' +
                                                                    '</div>' +
                                                                '</td>' +
                                                                '<td style="padding: 12px 10px; text-align: center; color: #4a5568; font-size: 14px; border-bottom: 1px solid #e2e8f0;">' +
                                                                    '1' +
                                                                '</td>' +
                                                                '<td style="padding: 12px 10px; text-align: right; color: #4a5568; font-size: 14px; border-bottom: 1px solid #e2e8f0;">' +
                                                                    '${{serviceFee}}' +
                                                                '</td>' +
                                                                '<td style="padding: 12px 10px; text-align: right; color: #1a1a1a; font-weight: 600; font-size: 14px; border-bottom: 1px solid #e2e8f0;">' +
                                                                    '${{serviceFee}}' +
                                                                '</td>' +
                                                            '</tr>' +
                                                            '{{/if}}' +
                                                        '</tbody>' +
                                                        '<tfoot>' +
                                                            '<tr style="background-color: #f8f9fa;">' +
                                                                '<td colspan="3" style="padding: 15px 10px; text-align: right; font-weight: bold; color: #1a1a1a; font-size: 16px;">' +
                                                                    'Total:' +
                                                                '</td>' +
                                                                '<td style="padding: 15px 10px; text-align: right;">' +
                                                                    '<div style="font-size: 20px; font-weight: bold; color: #f08772;">' +
                                                                        '${{totalAmount}}' +
                                                                    '</div>' +
                                                                    '{{#if amountBs}}' +
                                                                    '<div style="font-size: 12px; color: #718096; margin-top: 2px;">' +
                                                                        '≈ Bs. {{amountBs}}' +
                                                                    '</div>' +
                                                                    '{{/if}}' +
                                                                '</td>' +
                                                            '</tr>' +
                                                        '</tfoot>' +
                                                    '</table>' +
                                                '</td>' +
                                            '</tr>' +
                                        '</table>' +
                                    '</td>' +
                                '</tr>' +

                                '<!-- NUEVO: Voucher de Pago (para pago móvil) -->' +
                                '{{#if showVoucher}}' +
                                '<tr>' +
                                    '<td style="padding-bottom: 30px;">' +
                                        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #1a1a1a; border-radius: 8px;">' +
                                            '<tr>' +
                                                '<td style="padding: 20px;">' +
                                                    '<h3 style="margin: 0 0 15px 0; color: #ffffff; font-size: 18px; font-weight: bold;">' +
                                                        '📱 Información del pago' +
                                                    '</h3>' +
                                                    '' +
                                                    '<!-- Voucher -->' +
                                                    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #2d2d2d; border-radius: 6px;">' +
                                                        '<tr>' +
                                                            '<td style="padding: 15px;">' +
                                                                '<div style="text-align: center; padding-bottom: 10px; border-bottom: 1px solid #4a5568;">' +
                                                                    '<p style="margin: 0; color: #9ca3af; font-size: 11px; text-transform: uppercase;">Voucher electrónico</p>' +
                                                                    '<p style="margin: 5px 0 0 0; color: #ffffff; font-size: 16px; font-weight: bold;">' +
                                                                        '{{companyName}}' +
                                                                    '</p>' +
                                                                '</div>' +
                                                                '' +
                                                                '<table role="presentation" cellspacing="0" cellpadding="5" border="0" width="100%" style="margin-top: 15px;">' +
                                                                    '<tr>' +
                                                                        '<td style="color: #9ca3af; font-size: 12px;">RIF:</td>' +
                                                                        '<td style="color: #ffffff; font-size: 12px; text-align: right;">{{commerceRif}}</td>' +
                                                                    '</tr>' +
                                                                    '<tr>' +
                                                                        '<td style="color: #9ca3af; font-size: 12px;">BANCO:</td>' +
                                                                        '<td style="color: #ffffff; font-size: 12px; text-align: right;">{{commerceBankName}}</td>' +
                                                                    '</tr>' +
                                                                    '<tr>' +
                                                                        '<td style="color: #9ca3af; font-size: 12px;">TELÉFONO:</td>' +
                                                                        '<td style="color: #ffffff; font-size: 12px; text-align: right;">{{commercePhone}}</td>' +
                                                                    '</tr>' +
                                                                    '{{#if authId}}' +
                                                                    '<tr>' +
                                                                        '<td style="color: #9ca3af; font-size: 12px;">AUTORIZACIÓN:</td>' +
                                                                        '<td style="color: #ffffff; font-size: 12px; text-align: right;">{{authId}}</td>' +
                                                                    '</tr>' +
                                                                    '{{/if}}' +
                                                                    '{{#if paymentReference}}' +
                                                                    '<tr>' +
                                                                        '<td style="color: #9ca3af; font-size: 12px;">REFERENCIA:</td>' +
                                                                        '<td style="color: #ffffff; font-size: 12px; text-align: right;">{{paymentReference}}</td>' +
                                                                    '</tr>' +
                                                                    '{{/if}}' +
                                                                    '{{#if terminal}}' +
                                                                    '<tr>' +
                                                                        '<td style="color: #9ca3af; font-size: 12px;">TERMINAL:</td>' +
                                                                        '<td style="color: #ffffff; font-size: 12px; text-align: right;">{{terminal}}</td>' +
                                                                    '</tr>' +
                                                                    '{{/if}}' +
                                                                    '{{#if seqnum}}' +
                                                                    '<tr>' +
                                                                        '<td style="color: #9ca3af; font-size: 12px;">SECUENCIA:</td>' +
                                                                        '<td style="color: #ffffff; font-size: 12px; text-align: right;">{{seqnum}}</td>' +
                                                                    '</tr>' +
                                                                    '{{/if}}' +
                                                                    '<tr>' +
                                                                        '<td style="color: #9ca3af; font-size: 12px;">FECHA:</td>' +
                                                                        '<td style="color: #ffffff; font-size: 12px; text-align: right;">{{purchaseDate}} {{purchaseTime}}</td>' +
                                                                    '</tr>' +
                                                                    '<tr>' +
                                                                        '<td colspan="2" style="padding-top: 10px; border-top: 1px solid #4a5568;">' +
                                                                            '<div style="text-align: center;">' +
                                                                                '<p style="margin: 0; color: #9ca3af; font-size: 11px;">MONTO PAGADO</p>' +
                                                                                '<p style="margin: 5px 0 0 0; color: #f08772; font-size: 20px; font-weight: bold;">' +
                                                                                    'Bs. {{amountBs}}' +
                                                                                '</p>' +
                                                                            '</div>' +
                                                                        '</td>' +
                                                                    '</tr>' +
                                                                '</table>' +
                                                            '</td>' +
                                                        '</tr>' +
                                                    '</table>' +
                                                '</td>' +
                                            '</tr>' +
                                        '</table>' +
                                    '</td>' +
                                '</tr>' +
                                '{{/if}}' +
                                '' +
                                '<!-- Instructions -->' +
                                '<tr>' +
                                    '<td style="padding-bottom: 30px;">' +
                                        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fff5f3; border-left: 4px solid #f08772; border-radius: 0 8px 8px 0;">' +
                                            '<tr>' +
                                                '<td style="padding: 25px;">' +
                                                    '<h3 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 20px;">📌 Instrucciones Importantes</h3>' +
                                                    '' +
                                                    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">' +
                                                        '<tr>' +
                                                            '<td style="padding: 8px 0;">' +
                                                                '<table role="presentation" cellspacing="0" cellpadding="0" border="0">' +
                                                                    '<tr>' +
                                                                        '<td valign="top" style="color: #f08772; font-size: 16px; padding-right: 10px;">✓</td>' +
                                                                        '<td style="color: #4a5568; font-size: 15px; line-height: 1.6;">Presenta este correo o los códigos QR en la entrada del evento</td>' +
                                                                    '</tr>' +
                                                                '</table>' +
                                                            '</td>' +
                                                        '</tr>' +
                                                        '<tr>' +
                                                            '<td style="padding: 8px 0;">' +
                                                                '<table role="presentation" cellspacing="0" cellpadding="0" border="0">' +
                                                                    '<tr>' +
                                                                        '<td valign="top" style="color: #f08772; font-size: 16px; padding-right: 10px;">✓</td>' +
                                                                        '<td style="color: #4a5568; font-size: 15px; line-height: 1.6;">Las puertas abren 1 hora antes del inicio del concierto</td>' +
                                                                    '</tr>' +
                                                                '</table>' +
                                                            '</td>' +
                                                        '</tr>' +
                                                        '<tr>' +
                                                            '<td style="padding: 8px 0;">' +
                                                                '<table role="presentation" cellspacing="0" cellpadding="0" border="0">' +
                                                                    '<tr>' +
                                                                        '<td valign="top" style="color: #f08772; font-size: 16px; padding-right: 10px;">✓</td>' +
                                                                        '<td style="color: #4a5568; font-size: 15px; line-height: 1.6;">No olvides traer tu documento de identidad</td>' +
                                                                    '</tr>' +
                                                                '</table>' +
                                                            '</td>' +
                                                        '</tr>' +
                                                        '{{#if isBox}}' +
                                                        '<tr>' +
                                                            '<td style="padding: 8px 0;">' +
                                                                '<table role="presentation" cellspacing="0" cellpadding="0" border="0">' +
                                                                    '<tr>' +
                                                                        '<td valign="top" style="color: #f08772; font-size: 16px; padding-right: 10px;">✓</td>' +
                                                                        '<td style="color: #4a5568; font-size: 15px; line-height: 1.6;">Como titular del Box, coordina con tus invitados la hora de llegada</td>' +
                                                                    '</tr>' +
                                                                '</table>' +
                                                            '</td>' +
                                                        '</tr>' +
                                                        '<tr>' +
                                                            '<td style="padding: 8px 0;">' +
                                                                '<table role="presentation" cellspacing="0" cellpadding="0" border="0">' +
                                                                    '<tr>' +
                                                                        '<td valign="top" style="color: #f08772; font-size: 16px; padding-right: 10px;">✓</td>' +
                                                                        '<td style="color: #4a5568; font-size: 15px; line-height: 1.6;">El Box incluye servicio preferencial y acceso VIP</td>' +
                                                                    '</tr>' +
                                                                '</table>' +
                                                            '</td>' +
                                                        '</tr>' +
                                                        '{{/if}}' +
                                                        '<tr>' +
                                                            '<td style="padding: 8px 0;">' +
                                                                '<table role="presentation" cellspacing="0" cellpadding="0" border="0">' +
                                                                    '<tr>' +
                                                                        '<td valign="top" style="color: #f08772; font-size: 16px; padding-right: 10px;">✓</td>' +
                                                                        '<td style="color: #4a5568; font-size: 15px; line-height: 1.6;">Guarda este correo, es tu comprobante de compra</td>' +
                                                                    '</tr>' +
                                                                '</table>' +
                                                            '</td>' +
                                                        '</tr>' +
                                                        '<tr>' +
                                                            '<td style="padding: 8px 0;">' +
                                                                '<table role="presentation" cellspacing="0" cellpadding="0" border="0">' +
                                                                    '<tr>' +
                                                                        '<td valign="top" style="color: #f08772; font-size: 16px; padding-right: 10px;">✓</td>' +
                                                                        '<td style="color: #4a5568; font-size: 15px; line-height: 1.6;">Se recomienda llegar con anticipación para evitar congestiones</td>' +
                                                                    '</tr>' +
                                                                '</table>' +
                                                            '</td>' +
                                                        '</tr>' +
                                                    '</table>' +
                                                '</td>' +
                                            '</tr>' +
                                        '</table>' +
                                    '</td>' +
                                '</tr>' +
                                '' +
                                '<!-- CTA Button -->' +
                                '<tr>' +
                                    '<td align="center" style="padding-bottom: 30px;">' +
                                        '<table role="presentation" cellspacing="0" cellpadding="0" border="0">' +
                                            '<tr>' +
                                                '<td style="background-color: #f08772; border-radius: 50px;">' +
                                                    '<a href="{{downloadUrl}}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">' +
                                                        'Descargar Entradas PDF' +
                                                    '</a>' +
                                                '</td>' +
                                            '</tr>' +
                                        '</table>' +
                                    '</td>' +
                                '</tr>' +
                                '' +
                                '<!-- Contact Section -->' +
                                '<tr>' +
                                    '<td align="center" style="padding: 30px; background-color: #f8f9fa; border-radius: 8px;">' +
                                        '<p style="margin: 0; color: #718096; font-size: 15px; line-height: 1.6;">' +
                                            '¿Tienes alguna pregunta o necesitas asistencia?<br>' +
                                            'No dudes en contactarnos en<br>' +
                                            '<a href="mailto:{{supportEmail}}" style="color: #f08772; text-decoration: none; font-weight: bold;">{{supportEmail}}</a>' +
                                        '</p>' +
                                    '</td>' +
                                '</tr>' +
                            '</table>' +
                        '</td>' +
                    '</tr>' +
                    '' +
                    '<!-- Footer -->' +
                    '<tr>' +
                        '<td style="background-color: #1a1a1a; padding: 40px 30px; text-align: center;">' +
                            '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">' +
                                '<tr>' +
                                    '<td align="center" style="padding-bottom: 20px;">' +
                                        '<p style="margin: 0; color: #ffffff; font-size: 24px;">🎵 ¡Nos vemos en el concierto! 🎵</p>' +
                                    '</td>' +
                                '</tr>' +
                                '' +
                                '<!-- Footer Links -->' +
                                '<tr>' +
                                    '<td align="center" style="padding-bottom: 20px;">' +
                                        '<table role="presentation" cellspacing="0" cellpadding="0" border="0">' +
                                            '<tr>' +
                                                '<td style="padding: 0 10px;">' +
                                                    '<a href="{{websiteUrl}}" style="color: #a0a0a0; text-decoration: none; font-size: 14px;">Sitio Web</a>' +
                                                '</td>' +
                                                '<td style="color: #606060;">|</td>' +
                                                '<td style="padding: 0 10px;">' +
                                                    '<a href="{{termsUrl}}" style="color: #a0a0a0; text-decoration: none; font-size: 14px;">Términos</a>' +
                                                '</td>' +
                                                '<td style="color: #606060;">|</td>' +
                                                '<td style="padding: 0 10px;">' +
                                                    '<a href="{{privacyUrl}}" style="color: #a0a0a0; text-decoration: none; font-size: 14px;">Privacidad</a>' +
                                                '</td>' +
                                                '<td style="color: #606060;">|</td>' +
                                                '<td style="padding: 0 10px;">' +
                                                    '<a href="{{faqUrl}}" style="color: #a0a0a0; text-decoration: none; font-size: 14px;">FAQ</a>' +
                                                '</td>' +
                                            '</tr>' +
                                        '</table>' +
                                    '</td>' +
                                '</tr>' +
                                '' +
                                '<!-- Social Icons -->' +
                                '<tr>' +
                                    '<td align="center" style="padding-bottom: 20px;">' +
                                        '<table role="presentation" cellspacing="0" cellpadding="0" border="0">' +
                                            '<tr>' +
                                                '<td style="padding: 0 5px;">' +
                                                    '<a href="#" style="text-decoration: none; font-size: 24px;"><i class="fab fa-facebook-square" style="font-size:32px;color:white"></i></a>' +
                                                '</td>' +
                                                '<td style="padding: 0 5px;">' +
                                                    '<a href="#" style="text-decoration: none; font-size: 24px;"><i class="fab fa-instagram" style="font-size:32px;color:white"></i></a>' +
                                                '</td>' +
                                                '<td style="padding: 0 5px;">' +
                                                    '<a href="#" style="text-decoration: none; font-size: 24px;"><i class="fab fa-youtube" style="font-size:32px;color:white"></i></a>' +
                                                '</td>' +
                                            '</tr>' +
                                        '</table>' +
                                    '</td>' +
                                '</tr>' +
                                '' +
                                '<!-- Copyright -->' +
                                '<tr>' +
                                    '<td align="center" style="padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">' +
                                        '<p style="margin: 0; color: #606060; font-size: 13px;">' +
                                            '© {{year}} {{companyName}}. Todos los derechos reservados.<br>' +
                                            'Este correo fue enviado a {{buyerEmail}}' +
                                        '</p>' +
                                    '</td>' +
                                '</tr>' +
                            '</table>' +
                        '</td>' +
                    '</tr>' +
                '</table>' +
            '</td>' +
        '</tr>' +
    '</table>' +
'</body>' +
'</html>';

return htmlTemplate;
};

export const getPendingVerificationHTML = () => {
  return [
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<title>Verificación de Pago en Proceso</title>',
    '</head>',
    '<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">',
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px;">',
    '<tr>',
    '<td align="center">',
    '<table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); max-width: 100%;">',
    
    '<!-- Header personalizado -->',
    '<tr>',
    '<td style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); background-color: #1a1a1a; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">',
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">',
    '<tr>',
    '<td align="center" style="padding-bottom: 20px;">',
    '<img src="https://admin.clxnightrun.com/Logo-Email.gif" alt="CLX Night Run Logo" width="200" style="display: block; border: 0; max-width: 100%; height: auto;">',
    '</td>',
    '</tr>',
    '<tr>',
    '<td align="center">',
    '<h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; font-family: Verdana, Arial, sans-serif; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);">⏳ Verificación en proceso</h1>',
    '<div style="height: 3px; width: 80px; background-color: #ff6b6b; margin: 15px auto 0 auto; border-radius: 2px;"></div>',
    '</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    
    '<!-- Contenido principal -->',
    '<tr>',
    '<td style="padding: 40px 30px;">',
    '<h2 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 24px; font-weight: 600; font-family: Arial, sans-serif;">¡Hola {{buyerName}}! 👋</h2>',
    '<p style="color: #34495e; line-height: 1.6; font-size: 16px; margin: 0 0 25px 0; font-family: Arial, sans-serif;">Hemos recibido tu solicitud de compra de <strong style="color: #e74c3c;">{{ticketCount}} entrada(s)</strong> y estamos verificando tu pago con el máximo cuidado.</p>',
    
    '<!-- Información del pago -->',
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fff3cd; border-left: 4px solid #f39c12; margin: 25px 0; border-radius: 6px;">',
    '<tr>',
    '<td style="padding: 20px;">',
    '<h3 style="margin: 0 0 15px 0; color: #d68910; font-size: 18px; font-family: Arial, sans-serif;">📋 Información del pago</h3>',
    '<table width="100%" cellpadding="5" cellspacing="0" border="0" style="font-size: 14px; color: #2c3e50; font-family: Arial, sans-serif;">',
    '<tr>',
    '<td width="30%" style="font-weight: bold; vertical-align: top;">Método:</td>',
    '<td style="vertical-align: top;">{{paymentMethod}}</td>',
    '</tr>',
    '<tr>',
    '<td style="font-weight: bold; vertical-align: top;">Referencia:</td>',
    '<td style="vertical-align: top; font-family: \'Courier New\', monospace; background-color: #ecf0f1; padding: 4px 8px; border-radius: 4px; display: inline-block;">{{paymentReference}}</td>',
    '</tr>',
    '<tr>',
    '<td style="font-weight: bold; vertical-align: top;">Monto:</td>',
    '<td style="vertical-align: top; color: #27ae60; font-weight: bold; font-size: 16px;">${{totalAmount}} USD{{#if amountBs}} / Bs. {{amountBs}}{{/if}}</td>',
    '</tr>',
    '<tr>',
    '<td style="font-weight: bold; vertical-align: top;">Fecha:</td>',
    '<td style="vertical-align: top;">{{requestDate}}</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
    
    '<!-- Tiempo estimado -->',
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f08772; margin: 25px 0; border-radius: 6px;">',
    '<tr>',
    '<td style="padding: 20px; text-align: center;">',
    '<p style="color: #000000; margin: 0; font-size: 16px; font-weight: 600; font-family: Arial, sans-serif;">⏱️ Tiempo estimado de verificación: <strong>1 a 2 días habiles</strong></p>',
    '</td>',
    '</tr>',
    '</table>',
    
    '<p style="color: #34495e; line-height: 1.6; font-size: 16px; margin: 25px 0; font-family: Arial, sans-serif;">Te enviaremos un correo de confirmación con tus entradas una vez que el pago haya sido <strong style="color: #27ae60;">verificado exitosamente</strong>.</p>',
    
    '<!-- Contacto -->',
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #e8f5e8; border: 1px solid #c3e6c3; margin: 25px 0; border-radius: 6px;">',
    '<tr>',
    '<td style="padding: 15px; text-align: center;">',
    '<p style="color: #2d5a2d; margin: 0; font-size: 14px; font-family: Arial, sans-serif;">💬 ¿Tienes alguna pregunta? Contáctanos en <a href="mailto:{{supportEmail}}" style="color: #27ae60; text-decoration: none; font-weight: bold;">{{supportEmail}}</a></p>',
    '</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    
    '<!-- Footer -->',
    '<tr>',
    '<td style="background-color: #2c3e50; padding: 25px; text-align: center; border-radius: 0 0 8px 8px;">',
    '<p style="color: #ecf0f1; margin: 0 0 10px 0; font-size: 14px; font-family: Arial, sans-serif;">© {{year}} <strong>{{companyName}}</strong>. Todos los derechos reservados.</p>',
    '<p style="color: #74b9ff; margin: 0; font-size: 12px; font-family: Arial, sans-serif;">🔒 Transacción segura y verificada</p>',
    '</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
    '</body>',
    '</html>'
  ].join('\n');
};

export const getRejectionHTML = () => {
  return [
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<title>Actualización sobre tu Compra</title>',
    '</head>',
    '<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">',
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px;">',
    '<tr>',
    '<td align="center">',
    '<table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); max-width: 100%;">',
    
    '<!-- Header personalizado -->',
    '<tr>',
    '<td style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); background-color: #1a1a1a; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">',
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">',
    '<tr>',
    '<td align="center" style="padding-bottom: 20px;">',
    '<img src="https://admin.clxnightrun.com/Logo-Email.gif" alt="CLX Night Run Logo" width="200" style="display: block; border: 0; max-width: 100%; height: auto;">',
    '</td>',
    '</tr>',
    '<tr>',
    '<td align="center">',
    '<h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; font-family: Verdana, Arial, sans-serif; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);">❌ Actualización sobre tu compra</h1>',
    '<div style="height: 3px; width: 80px; background-color: #e74c3c; margin: 15px auto 0 auto; border-radius: 2px;"></div>',
    '</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    
    '<!-- Contenido principal -->',
    '<tr>',
    '<td style="padding: 40px 30px;">',
    '<h2 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 24px; font-weight: 600; font-family: Arial, sans-serif;">Hola {{buyerName}} 😔</h2>',
    '<p style="color: #34495e; line-height: 1.6; font-size: 16px; margin: 0 0 25px 0; font-family: Arial, sans-serif;">Lamentamos informarte que <strong style="color: #e74c3c;">no hemos podido procesar tu compra</strong> en esta ocasión.</p>',
    
    '<!-- Detalles del rechazo -->',
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8d7da; border-left: 4px solid #dc3545; margin: 25px 0; border-radius: 6px;">',
    '<tr>',
    '<td style="padding: 20px;">',
    '<h3 style="margin: 0 0 15px 0; color: #721c24; font-size: 18px; font-family: Arial, sans-serif;">📋 Detalles del intento de pago</h3>',
    '<table width="100%" cellpadding="5" cellspacing="0" border="0" style="font-size: 14px; color: #721c24; font-family: Arial, sans-serif;">',
    '<tr>',
    '<td width="30%" style="font-weight: bold; vertical-align: top;">Referencia:</td>',
    '<td style="vertical-align: top; font-family: \'Courier New\', monospace; background-color: #f5c6cb; padding: 4px 8px; border-radius: 4px; display: inline-block;">{{paymentReference}}</td>',
    '</tr>',
    '<tr>',
    '<td style="font-weight: bold; vertical-align: top;">Método:</td>',
    '<td style="vertical-align: top;">{{paymentMethod}}</td>',
    '</tr>',
    '<tr>',
    '<td style="font-weight: bold; vertical-align: top;">Monto:</td>',
    '<td style="vertical-align: top; font-weight: bold; font-size: 16px;">${{totalAmount}} USD{{#if amountBs}} / Bs. {{amountBs}}{{/if}}</td>',
    '</tr>',
    '<tr>',
    '<td style="font-weight: bold; vertical-align: top;">Fecha:</td>',
    '<td style="vertical-align: top;">{{requestDate}}</td>',
    '</tr>',
    '</table>',
    '<hr style="border: none; border-top: 1px solid #dc3545; margin: 15px 0;">',
    '<p style="margin: 10px 0 0 0; font-weight: bold; color: #721c24; font-family: Arial, sans-serif;">🚫 Motivo del rechazo:</p>',
    '<p style="margin: 5px 0 0 0; color: #721c24; font-family: Arial, sans-serif; font-size: 15px;">{{rejectionReason}}</p>',
    '</td>',
    '</tr>',
    '</table>',
    
    '<!-- Instrucciones para reintentar -->',
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #d1ecf1; border-left: 4px solid #17a2b8; margin: 25px 0; border-radius: 6px;">',
    '<tr>',
    '<td style="padding: 20px;">',
    '<h3 style="margin: 0 0 15px 0; color: #0c5460; font-size: 18px; font-family: Arial, sans-serif;">💡 Para intentar nuevamente, asegúrate de:</h3>',
    '<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; color: #0c5460;">',
    '<tr>',
    '<td style="vertical-align: top; padding: 5px 0; width: 20px;">✓</td>',
    '<td style="vertical-align: top; padding: 5px 0;">Verificar que los datos del pago sean correctos</td>',
    '</tr>',
    '<tr>',
    '<td style="vertical-align: top; padding: 5px 0; width: 20px;">✓</td>',
    '<td style="vertical-align: top; padding: 5px 0;">Confirmar que el monto sea exacto</td>',
    '</tr>',
    '<tr>',
    '<td style="vertical-align: top; padding: 5px 0; width: 20px;">✓</td>',
    '<td style="vertical-align: top; padding: 5px 0;">Usar una referencia de pago válida y reciente</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
    
    '<!-- Botón de acción -->',
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">',
    '<tr>',
    '<td align="center">',
    '<table cellpadding="0" cellspacing="0" border="0">',
    '<tr>',
    '<td style="background-color: #28a745; border-radius: 6px; padding: 2px;">',
    '<a href="{{purchaseUrl}}" style="display: inline-block; background-color: #28a745; color: #ffffff; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; text-decoration: none; padding: 14px 30px; border-radius: 6px;">🔄 Intentar Nuevamente</a>',
    '</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
    
    '<!-- Contacto -->',
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #e8f5e8; border: 1px solid #c3e6c3; margin: 25px 0; border-radius: 6px;">',
    '<tr>',
    '<td style="padding: 15px; text-align: center;">',
    '<p style="color: #2d5a2d; margin: 0; font-size: 14px; font-family: Arial, sans-serif;">💬 ¿Necesitas asistencia? Contáctanos en <a href="mailto:{{supportEmail}}" style="color: #27ae60; text-decoration: none; font-weight: bold;">{{supportEmail}}</a></p>',
    '</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    
    '<!-- Footer -->',
    '<tr>',
    '<td style="background-color: #2c3e50; padding: 25px; text-align: center; border-radius: 0 0 8px 8px;">',
    '<p style="color: #ecf0f1; margin: 0 0 10px 0; font-size: 14px; font-family: Arial, sans-serif;">© {{year}} <strong>{{companyName}}</strong>. Todos los derechos reservados.</p>',
    '<p style="color: #74b9ff; margin: 0; font-size: 12px; font-family: Arial, sans-serif;">🔒 Transacción segura y verificada</p>',
    '</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
    '</body>',
    '</html>'
  ].join('\n');
};

export const getRunnerConfirmationHTML = () => {
  const htmlTemplate = '<!DOCTYPE html>' +
  '<html lang="es">' +
  '<head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>Confirmación de Inscripción - CLX Night Run 2025</title>' +
      '<style type="text/css">' +
          'body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }' +
          'table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }' +
          'img { -ms-interpolation-mode: bicubic; border: 0; outline: none; }' +
          '@media screen and (max-width: 600px) {' +
              '.container { width: 100% !important; }' +
              '.responsive-table { width: 100% !important; }' +
              '.padding { padding: 10px 5% !important; }' +
          '}' +
      '</style>' +
  '</head>' +
  '<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">' +
      '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">' +
          '<tr>' +
              '<td align="center" style="padding: 40px 0;">' +
                  '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="container" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">' +
                      
                      '<!-- Header -->' +
                      '<tr>' +
                          '<td style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 40px 30px; text-align: center;">' +
                              '<img src="https://admin.clxnightrun.com/Logo-Email.gif" alt="CLX Night Run" width="200" style="display: block; margin: 0 auto 20px; max-width: 100%; height: auto;">' +
                              '<h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">INSCRIPCIÓN CONFIRMADA</h1>' +
                              '<div style="width: 60px; height: 3px; background-color: #FF6B35; margin: 15px auto 0;"></div>' +
                          '</td>' +
                      '</tr>' +
                      
                      '<!-- Contenido -->' +
                      '<tr>' +
                          '<td style="padding: 40px 30px;">' +
                              
                              '<!-- Saludo -->' +
                              '<h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 22px;">Hola {{registrantName}}</h2>' +
                              
                              '<!-- Mensaje de confirmación -->' +
                              '<div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; border-radius: 4px; margin-bottom: 30px;">' +
                                  '<p style="margin: 0; color: #166534; font-size: 15px; line-height: 1.5;">' +
                                      '<strong>Excelente!</strong> Tu inscripción para la CLX Night Run 2025 ha sido confirmada. ' +
                                      '{{#if isGroup}}Has registrado a <strong>{{totalRunners}} corredor(es)</strong>.{{else}}Tu registro individual está completo.{{/if}}' +
                                  '</p>' +
                              '</div>' +
                              
                              '<!-- Info del evento -->' +
                              '<div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin-bottom: 30px;">' +
                                  '<h3 style="margin: 0 0 15px; color: #FF6B35; font-size: 16px;">DETALLES DEL EVENTO</h3>' +
                                  '<table width="100%" cellpadding="5">' +
                                      '<tr><td style="color: #9ca3af; font-size: 12px;">CÓDIGO</td><td style="color: #ffffff; font-size: 16px; font-weight: bold;">{{groupCode}}</td></tr>' +
                                      '<tr><td style="color: #9ca3af; font-size: 12px;">FECHA</td><td style="color: #ffffff; font-size: 16px;">{{eventDate}}</td></tr>' +
                                      '<tr><td style="color: #9ca3af; font-size: 12px;">HORA</td><td style="color: #ffffff; font-size: 16px;">{{eventTime}}</td></tr>' +
                                      '<tr><td style="color: #9ca3af; font-size: 12px;">LUGAR</td><td style="color: #ffffff; font-size: 16px;">{{eventLocation}}</td></tr>' +
                                  '</table>' +
                              '</div>' +
                              
                              '<!-- Lista de corredores -->' +
                              '<h3 style="margin: 0 0 20px; color: #1a1a1a; font-size: 18px;">Corredores Registrados</h3>' +
                              '{{#each runners}}' +
                              '<div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 15px; background-color: #fafafa;">' +
                                  '<div style="margin-bottom: 15px;">' +
                                      '<span style="background-color: #FF6B35; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">CORREDOR {{index_1}}</span>' +
                                      '{{#if this.runnerNumber}}' +
                                      '<span style="background-color: #22c55e; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-left: 8px;">DORSAL #{{this.runnerNumber}}</span>' +
                                      '{{/if}}' +
                                  '</div>' +
                                  '<table width="100%" cellpadding="5">' +
                                      '<tr>' +
                                          '<td width="50%"><span style="color: #6b7280; font-size: 11px;">NOMBRE</span><br><strong style="color: #1a1a1a;">{{this.fullName}}</strong></td>' +
                                          '<td width="50%"><span style="color: #6b7280; font-size: 11px;">IDENTIFICACIÓN</span><br><strong style="color: #1a1a1a;">{{this.identificationType}}-{{this.identification}}</strong></td>' +
                                      '</tr>' +
                                      '<tr>' +
                                          '<td><span style="color: #6b7280; font-size: 11px;">GÉNERO/TALLA</span><br><strong style="color: #1a1a1a;">{{this.genderLabel}} / {{this.shirtSize}}</strong></td>' +
                                          '<td><span style="color: #6b7280; font-size: 11px;">EDAD</span><br><strong style="color: #1a1a1a;">{{this.age}} años</strong></td>' +
                                      '</tr>' +
                                      '{{#if this.email}}' +
                                      '<tr>' +
                                          '<td colspan="2"><span style="color: #6b7280; font-size: 11px;">EMAIL</span><br><strong style="color: #1a1a1a;">{{this.email}}</strong></td>' +
                                      '</tr>' +
                                      '{{/if}}' +
                                  '</table>' +
                                  '{{#if this.runnerNumber}}' +
                                  '<div style="text-align: center; margin-top: 20px; padding: 20px; background-color: #ffffff; border-radius: 8px;">' +
                                      '<img src="cid:qr_runner_{{@index}}" alt="QR Code" width="150" height="150" style="display: block; margin: 0 auto;">' +
                                      '<p style="margin: 10px 0 0; color: #FF6B35; font-size: 18px; font-weight: bold;">DORSAL #{{this.runnerNumber}}</p>' +
                                      '<p style="margin: 5px 0 0; color: #6b7280; font-size: 12px;">Presenta este código el día del evento</p>' +
                                  '</div>' +
                                  '{{/if}}' +
                              '</div>' +
                              '{{/each}}' +
                              
                              '<!-- Resumen de pago -->' +
                              '<div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 30px 0;">' +
                                  '<h3 style="margin: 0 0 15px; color: #1a1a1a; font-size: 16px;">Resumen de Pago</h3>' +
                                  '<table width="100%" cellpadding="8" style="font-size: 14px;">' +
                                      '<tr style="border-bottom: 1px solid #e5e7eb;">' +
                                          '<td style="color: #6b7280;">Método de pago</td>' +
                                          '<td style="text-align: right; color: #1a1a1a; font-weight: bold;">{{paymentMethodLabel}}</td>' +
                                      '</tr>' +
                                      '{{#if paymentReference}}' +
                                      '<tr style="border-bottom: 1px solid #e5e7eb;">' +
                                          '<td style="color: #6b7280;">Referencia</td>' +
                                          '<td style="text-align: right; color: #1a1a1a; font-weight: bold; font-family: monospace;">{{paymentReference}}</td>' +
                                      '</tr>' +
                                      '{{/if}}' +
                                      '{{#if authorizationCode}}' +
                                      '<tr style="border-bottom: 1px solid #e5e7eb;">' +
                                          '<td style="color: #6b7280;">Autorización</td>' +
                                          '<td style="text-align: right; color: #1a1a1a; font-weight: bold;">{{authorizationCode}}</td>' +
                                      '</tr>' +
                                      '{{/if}}' +
                                      '<tr style="border-bottom: 1px solid #e5e7eb;">' +
                                          '<td style="color: #6b7280;">Corredores</td>' +
                                          '<td style="text-align: right; color: #1a1a1a; font-weight: bold;">{{totalRunners}} x ${{pricePerRunner}}</td>' +
                                      '</tr>' +
                                      '<tr>' +
                                          '<td style="font-size: 16px; font-weight: bold; color: #1a1a1a; padding-top: 12px;">Total</td>' +
                                          '<td style="text-align: right; padding-top: 12px;">' +
                                              '<div style="color: #FF6B35; font-size: 20px; font-weight: bold;">${{totalAmount}} USD</div>' +
                                              '{{#if totalAmountBs}}<div style="color: #6b7280; font-size: 12px; margin-top: 4px;">Bs. {{totalAmountBs}}</div>{{/if}}' +
                                          '</td>' +
                                      '</tr>' +
                                  '</table>' +
                              '</div>' +
                              
                              '{{#if hasPaymentVoucher}}' +
                              '<!-- Voucher de pago móvil -->' +
                              '<div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin-bottom: 30px;">' +
                                  '<h3 style="margin: 0 0 15px; color: #FF6B35; font-size: 16px;">Comprobante de Pago Móvil</h3>' +
                                  '<div style="background-color: #000000; border-radius: 4px; padding: 15px; font-family: monospace; font-size: 11px; line-height: 1.4; color: #22c55e; white-space: pre-wrap; word-wrap: break-word;">{{paymentVoucher}}</div>' +
                              '</div>' +
                              '{{/if}}' +
                              
                              '<!-- Instrucciones -->' +
                              '<div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 20px; border-radius: 4px; margin-bottom: 30px;">' +
                                  '<h3 style="margin: 0 0 15px; color: #ea580c; font-size: 16px;">Información Importante</h3>' +
                                  '<ul style="margin: 0; padding-left: 20px; color: #9a3412; font-size: 14px; line-height: 1.6;">' +
                                      '<li><strong>Retiro del Kit:</strong> {{kitPickupInfo}}</li>' +
                                      '<li>Presenta tu cédula y este correo</li>' +
                                      '<li>La carrera inicia a las {{eventTime}}</li>' +
                                      '{{#if hasNumbers}}<li>Los dorsales serán entregados con el kit</li>{{/if}}' +
                                      '<li>Guarda este correo como comprobante</li>' +
                                  '</ul>' +
                              '</div>' +
                              
                              '{{#if groupQR}}' +
                              '<!-- QR del grupo -->' +
                              '<div style="text-align: center; background-color: #f9fafb; border-radius: 8px; padding: 20px;">' +
                                  '<h3 style="margin: 0 0 15px; color: #1a1a1a; font-size: 16px;">Código QR del Grupo</h3>' +
                                  '<img src="cid:qr_group" alt="QR Grupo" width="200" height="200">' +
                                  '<p style="margin: 10px 0 0; color: #6b7280; font-size: 12px;">{{groupCode}}</p>' +
                              '</div>' +
                              '{{/if}}' +
                              
                          '</td>' +
                      '</tr>' +
                      
                      '<!-- Footer -->' +
                      '<tr>' +
                          '<td style="background-color: #1a1a1a; padding: 30px; text-align: center;">' +
                              '<p style="margin: 0 0 20px; color: #ffffff; font-size: 20px; font-weight: bold;">¡Nos vemos en la línea de salida!</p>' +
                              '<p style="margin: 0 0 20px; color: #9ca3af; font-size: 14px; line-height: 1.5;">' +
                                  '¿Tienes preguntas?<br>' +
                                  '<a href="mailto:{{supportEmail}}" style="color: #FF6B35; text-decoration: none;">{{supportEmail}}</a>' +
                              '</p>' +
                              '<p style="margin: 0; color: #6b7280; font-size: 12px; padding-top: 20px; border-top: 1px solid #374151;">' +
                                  '© {{year}} {{companyName}}. Todos los derechos reservados.<br>' +
                                  'Este correo fue enviado a {{registrantEmail}}' +
                              '</p>' +
                          '</td>' +
                      '</tr>' +
                      
                  '</table>' +
              '</td>' +
          '</tr>' +
      '</table>' +
  '</body>' +
  '</html>';
  
  return htmlTemplate;
};