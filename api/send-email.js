/**
 * api/send-email.js — Vercel Serverless Function Proxy para Resend API
 * Se ejecuta automáticamente en Vercel cuando la app llama a /api/send-email.
 * Evita bloqueos de CORS en producción y mantiene la API Key segura.
 */
export default async function handler(req, res) {
  // Configuración de cabeceras CORS para Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido. Usa POST.' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const bodyPayload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(bodyPayload)
    });

    const data = await resendResponse.json().catch(() => ({}));
    return res.status(resendResponse.status).json(data);
  } catch (error) {
    console.error('[Vercel Serverless Proxy Error]:', error);
    return res.status(500).json({ message: 'Error en la función Serverless de Vercel: ' + error.message });
  }
}
