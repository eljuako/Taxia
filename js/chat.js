// chat.js
let difyConvId = sessionStorage.getItem('taxia_conv_id') || '';
let iaSending = false;

function escapeHtml(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatBotText(text) {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  const openThink = t.search(/<think>/i);
  if (openThink !== -1) {
    t = t.slice(0, openThink).trim();
    if (!t) return '<em style="color:var(--text-muted);font-size:.85rem">⏳ Analizando tu consulta...</em>';
  }
  t = t.trim();
  if (!t) return '';
  return t
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function iaAppendMsg(role, html, id) {
  const container = document.getElementById('ia-messages');
  const isUser = role === 'user';
  const profile = window.auth.getUserProfile();
  const initial = isUser ? (profile?.full_name?.[0] || 'U').toUpperCase() : 'IA';
  
  const div = document.createElement('div');
  div.className = `chat-message msg-${role}`;
  if (id) div.id = id;
  div.innerHTML = `
    <div class="msg-avatar">${initial}</div>
    <div class="msg-content">${html}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function iaShowTyping() {
  const id = 'typing-' + Date.now();
  iaAppendMsg('bot', `<div class="typing-indicator"><span></span><span></span><span></span></div>`, id);
  return id;
}

function iaUpdateBubble(id, html) {
  const el = document.getElementById(id)?.querySelector('.msg-content');
  if (el) el.innerHTML = html;
  const c = document.getElementById('ia-messages');
  if (c) c.scrollTop = c.scrollHeight;
}

async function sendChatMessage() {
  if (iaSending) return;
  const inp = document.getElementById('chat-input');
  const msg = inp?.value.trim();
  if (!msg) return;
  
  const canQuery = await window.auth.incrementQueryCount();
  if (!canQuery) {
    window.app.showModal('upgrade');
    return;
  }

  iaSending = true;
  iaAppendMsg('user', escapeHtml(msg));
  inp.value = '';
  inp.style.height = 'auto';
  inp.disabled = true;
  
  const typingId = iaShowTyping();
  const botMsgId = 'bot-' + Date.now();
  
  const abortCtrl = new AbortController();
  const abortTimer = setTimeout(() => abortCtrl.abort(), 180000);

  try {
    const res = await fetch(`${CONFIG.DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.DIFY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {},
        query: msg,
        response_mode: 'streaming',
        conversation_id: difyConvId || '',
        user: 'taxia-user-' + (window.auth.getCurrentUser()?.id?.slice(0,8) || 'anon')
      }),
      signal: abortCtrl.signal
    });

    if (!res.ok) throw new Error('API Error');

    document.getElementById(typingId)?.remove();
    iaAppendMsg('bot', '', botMsgId);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if ((data.event === 'message' || data.event === 'agent_message') && data.answer) {
            fullText += data.answer;
            iaUpdateBubble(botMsgId, formatBotText(fullText) + '<span class="cursor-blink">▍</span>');
          }
          if (data.event === 'message_end' && data.conversation_id) {
            difyConvId = data.conversation_id;
            sessionStorage.setItem('taxia_conv_id', difyConvId);
          }
        } catch(e) {}
      }
    }
    
    iaUpdateBubble(botMsgId, formatBotText(fullText));
    
  } catch(err) {
    document.getElementById(typingId)?.remove();
    iaAppendMsg('bot', `❌ Error: ${err.message}`);
  } finally {
    clearTimeout(abortTimer);
    iaSending = false;
    inp.disabled = false;
    inp.focus();
  }
}

window.chat = { sendChatMessage };
