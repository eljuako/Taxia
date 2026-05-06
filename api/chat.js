// api/chat.js
// Vercel Edge Function — proxy hacia Dify que esconde la API key
// La key vive en process.env.DIFY_API_KEY (configurar en Vercel Dashboard → Settings → Environment Variables)

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // Solo aceptamos POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const apiKey = process.env.DIFY_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server misconfigured: DIFY_API_KEY missing' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validación mínima de input
  const { query, conversation_id, user, inputs } = body || {};
  if (!query || typeof query !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid "query" field' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Llamada a Dify con la key del servidor
  const difyResponse = await fetch('https://api.dify.ai/v1/chat-messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: inputs || {},
      query,
      response_mode: 'streaming',
      conversation_id: conversation_id || '',
      user: user || 'taxia-anon',
    }),
  });

  // Si Dify falla, devolvemos el código y mensaje sin filtrar la key
  if (!difyResponse.ok) {
    const text = await difyResponse.text().catch(() => '');
    return new Response(
      JSON.stringify({ error: 'Upstream error', status: difyResponse.status, detail: text.slice(0, 500) }),
      { status: difyResponse.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Pipear el stream SSE directo al cliente
  return new Response(difyResponse.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
