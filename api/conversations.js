// api/conversations.js
// Vercel Edge Function — Lista conversaciones de un usuario en Dify y permite borrar/renombrar.
//
// GET  /api/conversations?user=xxx&limit=20         → lista conversaciones
// POST /api/conversations  body: { action, conversationId, user, name? }
//   - action: 'delete' | 'rename'

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const apiKey = process.env.DIFY_API_KEY;
  if (!apiKey) {
    return json({ error: 'Server misconfigured: DIFY_API_KEY missing' }, 500);
  }

  // ─── GET — Listar conversaciones ───
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const user = url.searchParams.get('user');
    const limit = url.searchParams.get('limit') || '20';
    const lastId = url.searchParams.get('last_id') || '';

    if (!user) return json({ error: 'Missing user param' }, 400);

    const params = new URLSearchParams({
      user,
      limit,
      sort_by: '-updated_at',
    });
    if (lastId) params.set('last_id', lastId);

    try {
      const res = await fetch(`https://api.dify.ai/v1/conversations?${params}`, {
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

  // ─── POST — Borrar o renombrar ───
  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch (e) {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    const { action, conversationId, user, name } = body || {};
    if (!action || !conversationId || !user) {
      return json({ error: 'Missing action, conversationId or user' }, 400);
    }

    if (action === 'delete') {
      try {
        const res = await fetch(`https://api.dify.ai/v1/conversations/${conversationId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user }),
        });
        if (!res.ok) {
          const t = await res.text();
          return json({ error: 'Delete failed', detail: t.slice(0, 300) }, res.status);
        }
        return json({ success: true }, 200);
      } catch (e) {
        return json({ error: 'Connection failed' }, 502);
      }
    }

    if (action === 'rename') {
      try {
        const res = await fetch(`https://api.dify.ai/v1/conversations/${conversationId}/name`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name || '',
            auto_generate: !name,
            user,
          }),
        });
        if (!res.ok) {
          const t = await res.text();
          return json({ error: 'Rename failed', detail: t.slice(0, 300) }, res.status);
        }
        const data = await res.json();
        return json(data, 200);
      } catch (e) {
        return json({ error: 'Connection failed' }, 502);
      }
    }

    return json({ error: 'Invalid action' }, 400);
  }

  return json({ error: 'Method not allowed' }, 405);
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
