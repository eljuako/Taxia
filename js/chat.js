// js/chat.js
// Llama a /api/chat (Vercel Edge Function) que esconde la API key de Dify.
// Soporta adjuntar imágenes vía /api/upload.

let difyConvId = sessionStorage.getItem('taxia_conv_id') || '';
let iaSending = false;

// Estado del adjunto pendiente
let pendingAttachment = null; // { file, uploadFileId, dataUrl }

function escapeHtml(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function iaAppendMsg(role, html, id, imgDataUrl) {
  const container = document.getElementById('ia-messages');
  const isUser = role === 'user';
  const profile = window.auth.getUserProfile();
  const initial = isUser ? (profile?.full_name?.[0] || 'U').toUpperCase() : 'IA';

  const div = document.createElement('div');
  div.className = `chat-message msg-${role}`;
  if (id) div.id = id;
  const imgHtml = imgDataUrl ? `<img class="msg-image" src="${imgDataUrl}" alt="Imagen adjunta">` : '';
  div.innerHTML = `
    <div class="msg-avatar">${initial}</div>
    <div class="msg-content">${imgHtml}${html}</div>
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

// ─────────── ADJUNTOS ───────────
function showPreview(file, dataUrl, statusText, stateClass) {
  const preview = document.getElementById('chat-attachment-preview');
  const img = document.getElementById('chat-preview-img');
  const name = document.getElementById('chat-preview-name');
  const status = document.getElementById('chat-preview-status');
  if (!preview) return;
  img.src = dataUrl || '';
  name.textContent = file ? file.name : '';
  status.textContent = statusText || '';
  preview.className = 'chat-attachment-preview' + (stateClass ? ' ' + stateClass : '');
  preview.style.display = 'flex';
}

function hidePreview() {
  const preview = document.getElementById('chat-attachment-preview');
  if (preview) preview.style.display = 'none';
}

function handleFileSelect(event) {
  const file = event.target.files?.[0];
  event.target.value = ''; // permitir reseleccionar el mismo archivo
  if (!file) return;

  // Validaciones cliente
  if (!file.type.startsWith('image/')) {
    window.app.showToast('Solo se permiten imágenes (JPG, PNG, WEBP, GIF).', 'error');
    return;
  }
  const MAX = 10 * 1024 * 1024;
  if (file.size > MAX) {
    window.app.showToast('La imagen es demasiado grande (máx 10 MB).', 'error');
    return;
  }

  // Leer dataURL para preview
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    pendingAttachment = { file, uploadFileId: null, dataUrl };
    showPreview(file, dataUrl, 'Subiendo imagen...', 'uploading');

    // Subir al backend que la pasa a Dify
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('user', 'taxia-user-' + (window.auth.getCurrentUser()?.id?.slice(0, 8) || 'anon'));

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

      pendingAttachment.uploadFileId = data.id;
      showPreview(file, dataUrl, '✓ Lista para enviar');
    } catch (err) {
      pendingAttachment = null;
      showPreview(file, dataUrl, 'Error: ' + (err.message || 'no se pudo subir'), 'error');
      window.app.showToast('No se pudo subir la imagen: ' + err.message, 'error');
      setTimeout(hidePreview, 3000);
    }
  };
  reader.readAsDataURL(file);
}

function removeAttachment() {
  pendingAttachment = null;
  hidePreview();
}

// ─────────── ENVIAR MENSAJE ───────────
async function sendChatMessage() {
  if (iaSending) return;
  const inp = document.getElementById('chat-input');
  const msg = inp?.value.trim();

  // Permitir enviar si hay imagen aunque no haya texto
  const hasAttachment = pendingAttachment && pendingAttachment.uploadFileId;
  if (!msg && !hasAttachment) return;

  // Si hay adjunto pero todavía está subiendo
  if (pendingAttachment && !pendingAttachment.uploadFileId) {
    window.app.showToast('Espera que termine de subir la imagen.', 'info');
    return;
  }

  const canQuery = await window.auth.incrementQueryCount();
  if (!canQuery) {
    window.app.showModal('upgrade');
    return;
  }

  iaSending = true;
  const userImgUrl = pendingAttachment?.dataUrl || null;
  const fileIdToSend = pendingAttachment?.uploadFileId || null;

  iaAppendMsg('user', escapeHtml(msg || '(imagen adjunta)'), null, userImgUrl);
  inp.value = '';
  inp.style.height = 'auto';
  inp.disabled = true;
  removeAttachment();

  const typingId = iaShowTyping();
  const botMsgId = 'bot-' + Date.now();

  const abortCtrl = new AbortController();
  const abortTimer = setTimeout(() => abortCtrl.abort(), 180000);

  try {
    const payload = {
      inputs: {},
      query: msg || 'Analiza esta imagen',
      conversation_id: difyConvId || '',
      user: 'taxia-user-' + (window.auth.getCurrentUser()?.id?.slice(0, 8) || 'anon'),
    };
    if (fileIdToSend) {
      payload.files = [{
        type: 'image',
        transfer_method: 'local_file',
        upload_file_id: fileIdToSend,
      }];
    }

    const res = await fetch(CONFIG.CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: abortCtrl.signal,
    });

    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json())?.error || ''; } catch (e) {}
      throw new Error(detail || `API Error (${res.status})`);
    }

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
        } catch (e) {}
      }
    }

    iaUpdateBubble(botMsgId, formatBotText(fullText));

  } catch (err) {
    document.getElementById(typingId)?.remove();
    iaAppendMsg('bot', `❌ Error: ${err.message}`);
  } finally {
    clearTimeout(abortTimer);
    iaSending = false;
    inp.disabled = false;
    inp.focus();
  }
}

window.chat = { sendChatMessage, handleFileSelect, removeAttachment };
