// api/upload.js
// Vercel Edge Function — proxy hacia Dify /v1/files/upload
// Recibe un archivo multipart del navegador y lo reenvía a Dify con la API key del servidor.

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.DIFY_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured: DIFY_API_KEY missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let formData;
  try {
    formData = await req.formData();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid multipart body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return new Response(JSON.stringify({ error: 'Missing file field' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Limitar tamaño (10 MB)
  const MAX = 10 * 1024 * 1024;
  if (file.size > MAX) {
    return new Response(JSON.stringify({ error: 'Archivo demasiado grande (máx 10 MB)' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Reenviar a Dify
  const newForm = new FormData();
  newForm.append('file', file, file.name);
  newForm.append('user', formData.get('user') || 'taxia-anon');

  const difyRes = await fetch('https://api.dify.ai/v1/files/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: newForm,
  });

  const text = await difyRes.text();

  if (!difyRes.ok) {
    return new Response(
      JSON.stringify({ error: 'Upstream upload error', status: difyRes.status, detail: text.slice(0, 500) }),
      { status: difyRes.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(text, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
