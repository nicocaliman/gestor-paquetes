/**
 * EmailService.js — Servicio de envío transaccional de informes y liquidaciones vía Resend API.
 * Estándar de nivel empresarial: HTML ejecutivo con resumen de totales + Archivo CSV adjunto.
 */
class EmailService {
  constructor() {
    this.apiKeyStorageKey = 'nc_caliman_resend_key';
    this.defaultEmailStorageKey = 'nc_caliman_default_email';
  }

  getApiKey() {
    return localStorage.getItem(this.apiKeyStorageKey) || '';
  }

  setApiKey(key) {
    localStorage.setItem(this.apiKeyStorageKey, key.trim());
  }

  getDefaultEmail() {
    return localStorage.getItem(this.defaultEmailStorageKey) || '';
  }

  setDefaultEmail(email) {
    localStorage.setItem(this.defaultEmailStorageKey, email.trim());
  }

  hasApiKey() {
    return Boolean(this.getApiKey());
  }

  /**
   * Envía la liquidación de paquetes por correo electrónico vía Resend API
   * @param {Object} options
   * @param {string} options.toEmail Dirección de correo destino
   * @param {Array<Object>} options.packages Lista de paquetes en liquidación
   * @param {number} options.totalMoney Total recaudado en €
   * @param {number} options.totalWeight Total peso en kg
   * @param {number} options.totalBultos Total de bultos
   * @param {string} [options.pdfBase64] Cadena en Base64 del archivo Albarán PDF
   * @param {string} [options.pdfFilename] Nombre del archivo PDF
   * @param {string} [options.customSubject] Asunto personalizado
   * @returns {Promise<Object>} Respuesta de la API de Resend
   */
  async sendLiquidationReport({ toEmail, packages = [], totalMoney = 0, totalWeight = 0, totalBultos = 0, pdfBase64 = null, pdfFilename = null, customSubject = null }) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('API Key de Resend no configurada. Configúrala en el panel de Ajustes.');
    }

    if (!toEmail || !toEmail.includes('@')) {
      throw new Error('Dirección de correo electrónico no válida.');
    }

    const now = new Date();
    const currentDate = now.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const dateStamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const defaultPdfName = pdfFilename || `Albaran_Caliman_LIQ_${dateStamp}.pdf`;

    // 1. Generar Filas HTML de Paquetes
    const tableRowsHtml = packages.map((pkg, idx) => `
      <tr style="border-bottom: 1px solid #E2E8F0; font-size: 13px; background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
        <td style="padding: 10px 12px; color: #64748B; font-weight: 700;">#${idx + 1}</td>
        <td style="padding: 10px 12px; color: #0F172A; font-weight: 700;">${pkg.destinatario || '-'}</td>
        <td style="padding: 10px 12px; color: #475569;">${pkg.localidadDestinatario || '-'}</td>
        <td style="padding: 10px 12px; color: #4F46E5; font-weight: 800; text-align: center;">${pkg.bultos || '1'}</td>
        <td style="padding: 10px 12px; color: #0284C7; font-weight: 800; text-align: center;">${pkg.weight || '0'} kg</td>
        <td style="padding: 10px 12px; color: #475569;">${pkg.expedidor || '-'} (${pkg.localidadExpedidor || '-'})</td>
        <td style="padding: 10px 12px; color: #059669; font-weight: 900; text-align: right;">${Number(pkg.price || 0).toFixed(2)} €</td>
      </tr>
    `).join('');

    // 2. Plantilla HTML Ejecutiva Unificada y Profesional (Estudio Caliman)
    const htmlBody = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Albarán Oficial de Liquidación — NC Caliman Logistics</title>
    </head>
    <body style="margin:0; padding:0; background-color:#F1F5F9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#0F172A; -webkit-font-smoothing:antialiased;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F1F5F9; padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="640px" border="0" cellspacing="0" cellpadding="0" style="max-width:640px; background-color:#FFFFFF; border-radius:16px; border:1px solid #E2E8F0; overflow:hidden; box-shadow:0 12px 30px rgba(15,23,42,0.08);">
              
              <!-- Encabezado Corporativo Oficial -->
              <tr>
                <td style="background:#0F172A; padding:28px 32px; border-bottom:3px solid #6366F1;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td>
                        <div style="font-size:20px; font-weight:900; color:#FFFFFF; letter-spacing:-0.03em;">🚚 NC CALIMAN LOGISTICS</div>
                        <div style="font-size:12px; color:#94A3B8; font-weight:600; margin-top:3px; text-transform:uppercase; letter-spacing:0.04em;">Albarán Oficial de Liquidación de Transporte</div>
                      </td>
                      <td align="right">
                        <span style="font-size:11px; background:rgba(255,255,255,0.1); color:#FFFFFF; border:1px solid rgba(255,255,255,0.2); padding:5px 12px; border-radius:10px; font-weight:700; display:inline-block;">${currentDate}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Mensaje Explicativo Claro -->
              <tr>
                <td style="padding:28px 32px 16px 32px; font-size:14px; color:#334155; line-height:1.6;">
                  <p style="margin:0 0 10px 0; font-size:15px; font-weight:700; color:#0F172A;">Hola,</p>
                  <p style="margin:0 0 16px 0;">Te enviamos la liquidación de transporte y reparto de paquetería correspondiente a hoy, <strong>${currentDate}</strong>.</p>
                  <p style="margin:0;">En este mensaje adjuntamos el <strong>Albarán Oficial de Liquidación en PDF</strong> (documento A4 completo de transporte) y la <strong>Hoja de datos en CSV</strong> para gestión contable.</p>
                </td>
              </tr>

              <!-- Tarjetas de Métricas de Ruta -->
              <tr>
                <td style="padding:0 32px 24px 32px;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td width="31%" style="background:#F8FAFC; border-radius:12px; border:1px solid #E2E8F0; padding:16px 12px; text-align:center;">
                        <span style="font-size:10px; color:#64748B; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; display:block;">Total Recaudado</span>
                        <span style="font-size:20px; color:#059669; font-weight:900; display:block; margin-top:4px; font-family:monospace;">${Number(totalMoney).toFixed(2)} €</span>
                      </td>
                      <td width="3.5%"></td>
                      <td width="31%" style="background:#F8FAFC; border-radius:12px; border:1px solid #E2E8F0; padding:16px 12px; text-align:center;">
                        <span style="font-size:10px; color:#64748B; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; display:block;">Peso Total Carga</span>
                        <span style="font-size:20px; color:#0284C7; font-weight:900; display:block; margin-top:4px; font-family:monospace;">${Number(totalWeight).toFixed(1)} kg</span>
                      </td>
                      <td width="3.5%"></td>
                      <td width="31%" style="background:#F8FAFC; border-radius:12px; border:1px solid #E2E8F0; padding:16px 12px; text-align:center;">
                        <span style="font-size:10px; color:#64748B; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; display:block;">Total Bultos</span>
                        <span style="font-size:20px; color:#4F46E5; font-weight:900; display:block; margin-top:4px;">${totalBultos} u.</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Desglose de Paquetes -->
              <tr>
                <td style="padding:0 32px 26px 32px;">
                  <div style="font-size:13px; color:#0F172A; margin-bottom:12px; font-weight:800;">Desglose de Expediciones en Liquidación (${packages.length}):</div>
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#FFFFFF; border-radius:10px; overflow:hidden; border:1px solid #E2E8F0;">
                    <thead>
                      <tr style="background:#0F172A; font-size:11px; color:#FFFFFF; text-transform:uppercase; letter-spacing:0.04em;">
                        <th style="padding:10px 10px; text-align:left;">#</th>
                        <th style="padding:10px 10px; text-align:left;">Destinatario</th>
                        <th style="padding:10px 10px; text-align:left;">Localidad</th>
                        <th style="padding:10px 10px; text-align:center;">Bultos</th>
                        <th style="padding:10px 10px; text-align:center;">Peso</th>
                        <th style="padding:10px 10px; text-align:left;">Expedidor</th>
                        <th style="padding:10px 10px; text-align:right;">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${tableRowsHtml}
                    </tbody>
                  </table>
                </td>
              </tr>

              <!-- Bloque de Archivos Adjuntos -->
              <tr>
                <td style="padding:0 32px 28px 32px;">
                  <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-left:4px solid #6366F1; border-radius:10px; padding:16px 20px;">
                    <div style="font-size:13px; color:#0F172A; font-weight:800; margin-bottom:6px;">📎 Archivos Adjuntos a este Correo:</div>
                    <div style="font-size:12px; color:#334155; line-height:1.6;">
                      • <strong>${defaultPdfName}</strong>: Documento de Albarán Oficial de Liquidación en PDF (Formato A4 idéntico al de impresión).<br/>
                      • <strong>liquidaciones_caliman_${dateStamp}.csv</strong>: Hoja de cálculo desglosada para contabilidad.
                    </div>
                  </div>
                </td>
              </tr>

              <!-- Pie de Página -->
              <tr>
                <td style="background:#F8FAFC; padding:18px 32px; text-align:center; font-size:11px; color:#64748B; border-top:1px solid #E2E8F0;">
                  © 2026 NC Caliman Logistics — Control Oficial de Expediciones y Liquidación de Paquetería.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    // 3. Texto plano alternativo para clientes de correo
    const textBody = `
NC CALIMAN LOGISTICS — ALBARÁN OFICIAL DE LIQUIDACIÓN
Fecha: ${currentDate}

Hola,
Adjuntamos a este correo el Albarán Oficial de Liquidación en PDF (documento A4 completo de transporte) y la Hoja de datos en CSV para contabilidad.

RESUMEN GENERAL:
- Total Recaudado: ${Number(totalMoney).toFixed(2)} €
- Peso Total Carga: ${Number(totalWeight).toFixed(1)} kg
- Total Bultos: ${totalBultos} u.
- Expediciones en Liquidación: ${packages.length}

ARCHIVOS ADJUNTOS:
1. ${defaultPdfName} (Albarán Oficial de Liquidación en PDF)
2. liquidaciones_caliman_${dateStamp}.csv (Hoja de datos para contabilidad)

© 2026 NC Caliman Logistics
`.trim();

    // 4. Generar CSV adjunto en Base64
    const csvHeader = "Destinatario,Localidad Destinatario,Bultos,Peso (kg),Expedidor,Localidad Expedidor,Precio (€)\n";
    const csvBody = packages.map(p => 
      `"${p.destinatario || ''}","${p.localidadDestinatario || ''}","${p.bultos || '1'}","${p.weight || '0'}","${p.expedidor || ''}","${p.localidadExpedidor || ''}","${p.price || 0}"`
    ).join("\n");
    
    const csvContent = csvHeader + csvBody;
    const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)));

    // 5. Construir Array de Adjuntos
    const attachments = [
      {
        filename: `liquidaciones_caliman_${dateStamp}.csv`,
        content: csvBase64
      }
    ];

    if (pdfBase64) {
      attachments.unshift({
        filename: defaultPdfName,
        content: pdfBase64
      });
    }

    const timeString = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
    const mailSubject = customSubject || `📦 Albarán de Liquidación Caliman — ${packages.length} envíos (${Number(totalMoney).toFixed(2)} €) [${timeString}]`;

    // 6. Llamada HTTP a la API de Resend (con fallback CORS para navegador)
    try {
      const recipientEmails = Array.isArray(toEmail) ? toEmail : [toEmail];

      const payload = JSON.stringify({
        from: 'Caliman Gestor Paquetes <onboarding@resend.dev>',
        to: recipientEmails,
        subject: mailSubject,
        html: htmlBody,
        text: textBody,
        attachments: attachments
      });

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };

      let response;
      try {
        // Intentar primero a través del servidor proxy local (/api/send-email)
        response = await fetch('/api/send-email', {
          method: 'POST',
          headers: headers,
          body: payload
        });

        if (!response.ok && response.status === 404) {
          // Si el servidor local no tiene la ruta /api/send-email, intentar directamente
          response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: headers,
            body: payload
          });
        }
      } catch (proxyErr) {
        console.warn('[Local Proxy fetch failed, attempting direct fetch to Resend]:', proxyErr);
        response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: headers,
          body: payload
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let msg = errorData.message || errorData.name || `HTTP ${response.status}`;
        if (typeof msg === 'string' && msg.toLowerCase().includes('testing emails')) {
          msg = 'En modo prueba gratuito de Resend (onboarding@resend.dev), solo puedes enviar correos a la misma dirección de email con la que creaste la cuenta en Resend.com. Para enviar a otros correos, registra un dominio en Resend.';
        }
        throw new Error(msg);
      }

      return await response.json();
    } catch (err) {
      console.error('[EmailService Error]:', err);
      throw err;
    }
  }
}

export const emailService = new EmailService();
