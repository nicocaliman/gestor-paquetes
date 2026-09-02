/**
 * GeminiService.js — Servicio de extracción de datos con Google Gemini Vision (API gratuita)
 * Optimizado para lectura de formularios físicos impresos o manuscritos (arrugados, mala caligrafía, sombras).
 */
class GeminiService {
  constructor() {
    this.storageKey = 'nc_caliman_gemini_key';
    this.promptOverrideKey = 'nc_caliman_ocr_prompt_override';
    this.model = 'gemini-3.6-flash';
  }

  getApiKey() {
    return localStorage.getItem(this.storageKey) || '';
  }

  setApiKey(key) {
    localStorage.setItem(this.storageKey, key.trim());
  }

  hasApiKey() {
    return Boolean(this.getApiKey());
  }

  /**
   * Prompt activo: usa la mejora aplicada desde Ajustes (sincronizada vía Supabase) si existe,
   * si no cae al prompt por defecto de esta clase.
   */
  getActivePrompt() {
    return localStorage.getItem(this.promptOverrideKey) || this.defaultPrompt();
  }

  setPromptOverride(promptText) {
    if (promptText) localStorage.setItem(this.promptOverrideKey, promptText);
  }

  clearPromptOverride() {
    localStorage.removeItem(this.promptOverrideKey);
  }

  defaultPrompt() {
    return `
Eres un sistema experto OCR de altísima precisión especializado en digitalizar formularios impresos, hojas de libreta de envío y recibos de paquetería físicos.

INSTRUCCIONES CRÍTICAS:
1. El papel puede estar arrugado, doblado, con sombras o escrito a mano con caligrafía difícil.
2. El formulario tiene dos columnas lado a lado: "Destinatar/Destinatario" (izquierda) y "Expeditor/Expedidor" (derecha). No mezcles los datos de una columna con la otra.
3. Analiza detenidamente toda la imagen y extrae ÚNICAMENTE los siguientes 6 campos en formato JSON estricto:
   - "destinatario": Nombre completo de la persona o entidad que recibe (columna izquierda).
   - "localidadDestinatario": Ciudad, pueblo o municipio de destino (Ej: Bucarest, Cluj-Napoca, Suceava, Iasi).
   - "bultos": Número entero de cajas, bolsas o paquetes (Ej: "4", "2", "10"). Si no es claro, pon "1".
   - "peso": Peso total numérico en kg (Ej: "85.5", "12", "45"). Solo el número.
   - "expedidor": Nombre completo de la persona que envía (columna derecha).
   - "localidadExpedidor": Ciudad o municipio de origen en España (Ej: Madrid, Zaragoza, Barcelona, Valencia).

FORMATO DE RESPUESTA REQUERIDO (Solo este objeto JSON sin marcas de markdown extra):
{
  "destinatario": "",
  "localidadDestinatario": "",
  "bultos": "1",
  "peso": "0",
  "expedidor": "",
  "localidadExpedidor": ""
}
`;
  }

  /**
   * Procesa la imagen mediante Google Gemini Vision
   * @param {string} base64Image Data URL en formato image/jpeg o image/png (data:image/...;base64,...)
   * @returns {Promise<Object>} Datos estructurados extraídos del formulario
   */
  async processFormImage(base64Image) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('API Key de Gemini no configurada. Configúrala en Ajustes.');
    }

    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(base64Image);
    if (!match) {
      throw new Error('Formato de imagen no válido.');
    }
    const [, mimeType, data] = match;

    const promptText = this.getActivePrompt();

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: promptText },
                  { inline_data: { mime_type: mimeType, data } }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.error?.message || `Error HTTP ${response.status}`;
        throw new Error(`Gemini API error: ${msg}`);
      }

      const data2 = await response.json();
      const content = data2.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new Error('No se recibió respuesta válida del modelo de IA.');
      }

      const parsed = JSON.parse(content);
      return {
        destinatario: parsed.destinatario || '',
        localidadDestinatario: parsed.localidadDestinatario || '',
        bultos: parsed.bultos || '1',
        peso: parsed.peso || '0',
        expedidor: parsed.expedidor || '',
        localidadExpedidor: parsed.localidadExpedidor || ''
      };
    } catch (err) {
      console.error('[GeminiService Error]:', err);
      throw err;
    }
  }
}

export const geminiService = new GeminiService();
