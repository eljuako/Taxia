// api/messages.js
// Vercel Edge Function — Trae los mensajes de una conversación específica desde Dify.
//
// GET /api/messages?conversation_id=xxx&user=xxx&limit=50

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.DIFY_API_KEY;
  if (!apiKey) {
    return json({ error: 'Server misconfigured: DIFY_API_KEY missing' }, 500);
  }

  const url = new URL(req.url);
  const conversationId = url.searchParams.get('conversation_id');
  const user = url.searchParams.get('user');
  const limit = url.searchParams.get('limit') || '50';
  const firstId = url.searchParams.get('first_id') || '';

  if (!conversationId || !user) {
    return json({ error: 'Missing conversation_id or user' }, 400);
  }

  const params = new URLSearchParams({
    conversation_id: conversationId,
    user,
    limit,
  });
  if (firstId) params.set('first_id', firstId);

  try {
    const res = await fetch(`https://api.dify.ai/v1/messages?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const t = await res.text();
      return json({ error: 'Upstream error', status: res.status, detail: t.slice(0, 300) }, res.status);
    }
    const data = await res.json();
    return json(data, 200);
  } catch (e) {
    return json({ error: 'Connection to Dify failed' }, 502);
  }
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
