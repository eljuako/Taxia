// api/extract.js
// Vercel Edge Function — Extracción estructurada de datos para llenar formularios fiscales.
// Modo 1: Recibe un fileId (subido previamente con /api/upload) y pide a Dify que lo analice.
// Modo 2: Recibe una "conversation" (texto del chat reciente) y pide a Dify que extraiga los números.
// En ambos casos devuelve un JSON con { values: { fieldId: number, ... } }.

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.DIFY_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured: DIFY_API_KEY missing' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try { body = await req.json(); }
  catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { formKey, formTitle, fileId, conversation, fields, user } = body || {};
  if (!formKey || !Array.isArray(fields) || fields.length === 0) {
    return new Response(JSON.stringify({ error: 'Missing formKey or fields list' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── Construir el prompt para extracción estructurada ───
  const fieldsList = fields.map(f => `- ${f.id}: ${f.label}`).join('\n');

  const promptBase = `Eres un asistente de extracción de datos fiscales para República Dominicana.
Tu tarea: extraer valores numéricos en pesos dominicanos (RD$) y mapearlos a los campos del formulario "${formTitle || formKey}".

CAMPOS DEL FORMULARIO:
${fieldsList}

INSTRUCCIONES:
1. Analiza el contenido proporcionado (documento adjunto o conversación de chat).
2. Identifica cualquier monto en RD$ que corresponda a uno de los campos listados.
3. Devuelve EXCLUSIVAMENTE un objeto JSON válido con la estructura: {"values": {"id_del_campo": numero, ...}}
4. Solo incluye los campos para los que SÍ encontraste un valor claro.
5. Los valores deben ser números (sin formato de moneda, sin comas, sin símbolos).
6. Si no encuentras ningún dato, devuelve {"values": {}}.
7. NO agregues explicaciones, solo el JSON.

Ejemplo de respuesta correcta:
{"values": {"it1-vt-18": 150000, "it1-itbis-pagado": 5400}}`;

  let query = '';
  let payloadFiles = undefined;

  if (fileId) {
    query = promptBase + '\n\nAnaliza el documento adjunto y extrae los datos.';
    payloadFiles = [{
      type: 'image',         // Dify acepta image/document — ajustar según tipo de file
      transfer_method: 'local_file',
      upload_file_id: fileId,
    }];
  } else if (conversation) {
    query = promptBase + `\n\nCONVERSACIÓN RECIENTE A ANALIZAR:\n${conversation}\n\nExtrae los datos.`;
  } else {
    return new Response(JSON.stringify({ error: 'Missing fileId or conversation' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── Llamar a Dify (modo blocking, no streaming, queremos un JSON completo) ───
  const difyPayload = {
    inputs: {},
    query,
    response_mode: 'blocking',
    conversation_id: '',
    user: user || 'taxia-extract-anon',
  };
  if (payloadFiles) difyPayload.files = payloadFiles;

  let difyResponse;
  try {
    difyResponse = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(difyPayload),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Connection to Dify failed' }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!difyResponse.ok) {
    const detail = await difyResponse.text().catch(() => '');
    return new Response(
      JSON.stringify({ error: 'Upstream extraction error', status: difyResponse.status, detail: detail.slice(0, 300) }),
      { status: difyResponse.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const difyData = await difyResponse.json();
  const answer = difyData.answer || '';

  // ─── Parsear el JSON que devolvió el modelo ───
  let values = {};
  try {
    // El modelo puede devolver el JSON envuelto en bloques markdown, lo limpiamos.
    let jsonStr = answer.trim();
    // Quitar bloques ```json ... ```
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    // Buscar el primer { y el último } por si hay texto extra
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1);

    const parsed = JSON.parse(jsonStr);
    values = parsed.values || parsed;
  } catch (e) {
    // Si falló el parseo, devolvemos values vacío (no es un error fatal del servidor)
    return new Response(
      JSON.stringify({ values: {}, warning: 'No se pudo parsear la respuesta del modelo', raw: answer.slice(0, 500) }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ─── Filtrar solo los campos válidos del formulario ───
  const validIds = new Set(fields.map(f => f.id));
  const filtered = {};
  for (const [k, v] of Object.entries(values)) {
    if (validIds.has(k) && (typeof v === 'number' || (typeof v === 'string' && !isNaN(parseFloat(v))))) {
      filtered[k] = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
    }
  }

  return new Response(JSON.stringify({ values: filtered, count: Object.keys(filtered).length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
