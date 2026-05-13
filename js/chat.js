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
  const initial = isUser ? (profile?.full_name?.[0] || 'U').toUpperCase() : 'N';

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
  event.target.value = '';
  if (!file) return;

  // Defense-in-depth: si el feature flag está apagado, ignorar adjuntos aunque
  // alguien fuerce el input (ej: devtools). El botón ya está oculto en HTML.
  if (!window.CONFIG?.FILE_UPLOAD_ENABLED) {
    window.app.showToast('La carga de archivos no está disponible en esta versión.', 'info');
    return;
  }

  if (!file.type.startsWith('image/')) {
    window.app.showToast('Solo se permiten imágenes (JPG, PNG, WEBP, GIF).', 'error');
    return;
  }
  const MAX = 10 * 1024 * 1024;
  if (file.size > MAX) {
    window.app.showToast('La imagen es demasiado grande (máx 10 MB).', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    pendingAttachment = { file, uploadFileId: null, dataUrl };
    showPreview(file, dataUrl, 'Subiendo imagen...', 'uploading');

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

// ─────────── HELPERS DE ESTADO UI ───────────
function setSendingState(sending) {
  iaSending = sending;
  const inp = document.getElementById('chat-input');
  const sendBtn = document.querySelector('.btn-send');
  if (inp) inp.disabled = sending;
  if (sendBtn) {
    sendBtn.classList.toggle('sending', sending);
    sendBtn.style.opacity = sending ? '0.6' : '1';
    sendBtn.style.pointerEvents = sending ? 'none' : 'auto';
  }
}

// Lee del stream con timeout de inactividad (anti-bloqueo)
function readWithIdleTimeout(reader, idleMs) {
  return Promise.race([
    reader.read(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Stream sin actividad por mucho tiempo')), idleMs)
    ),
  ]);
}

// ─────────── ENVIAR MENSAJE ───────────
async function sendChatMessage() {
  // GUARD #1: si ya hay un envío en curso, ignorar
  if (iaSending) return;

  const inp = document.getElementById('chat-input');
  const msg = inp?.value.trim();
  const hasAttachment = pendingAttachment && pendingAttachment.uploadFileId;

  // GUARD #2: nada que enviar
  if (!msg && !hasAttachment) return;

  // GUARD #3: imagen aún subiendo
  if (pendingAttachment && !pendingAttachment.uploadFileId) {
    window.app.showToast('Espera que termine de subir la imagen.', 'info');
    return;
  }

  // 🔒 LOCK INMEDIATO — antes de cualquier await
  setSendingState(true);

  let typingId = null;
  const botMsgId = 'bot-' + Date.now();
  const userImgUrl = pendingAttachment?.dataUrl || null;
  const fileIdToSend = pendingAttachment?.uploadFileId || null;

  // Mostrar el mensaje del usuario inmediatamente (UX)
  iaAppendMsg('user', escapeHtml(msg || '(imagen adjunta)'), null, userImgUrl);
  inp.value = '';
  inp.style.height = 'auto';
  removeAttachment();

  try {
    // Validar cuota — con timeout para no quedarse colgado si Supabase tarda
    const quotaCheck = Promise.race([
      window.auth.incrementQueryCount(),
      new Promise((resolve) => setTimeout(() => resolve(true), 8000)), // 8s timeout, asume OK
    ]);
    const canQuery = await quotaCheck;
    if (canQuery === false) {
      window.app.showModal('upgrade');
      return; // finally desbloquea
    }

    typingId = iaShowTyping();

    const abortCtrl = new AbortController();
    const abortTimer = setTimeout(() => abortCtrl.abort(), 180000); // 3 min total

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
        throw new Error(detail || `Error del servidor (${res.status})`);
      }
      if (!res.body) throw new Error('Respuesta sin contenido');

      document.getElementById(typingId)?.remove();
      typingId = null;
      iaAppendMsg('bot', '', botMsgId);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      // Stream con timeout de inactividad — si Dify no envía nada en 60s, se aborta
      while (true) {
        const { done, value } = await readWithIdleTimeout(reader, 60000);
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
              const wasNew = !difyConvId;
              difyConvId = data.conversation_id;
              sessionStorage.setItem('taxia_conv_id', difyConvId);
              // Si era una conversación nueva, refrescar el historial del sidebar
              if (wasNew && window.history_ui?.refresh) {
                window.history_ui.refresh().catch(() => {});
              }
            }
          } catch (e) { /* línea SSE inválida — ignorar */ }
        }
      }

      iaUpdateBubble(botMsgId, formatBotText(fullText) || '<em style="color:var(--text-muted);">(Sin respuesta)</em>');

    } catch (err) {
      if (typingId) document.getElementById(typingId)?.remove();
      const errMsg = err.name === 'AbortError'
        ? 'Tiempo agotado. Intenta de nuevo.'
        : (err.message || 'Error desconocido');
      iaAppendMsg('bot', `❌ Error: ${errMsg}`);
    } finally {
      clearTimeout(abortTimer);
    }
  } finally {
    // 🔓 SIEMPRE desbloquear, sin importar qué pase
    setSendingState(false);
    if (inp) inp.focus();
  }
}

// ─────────── HELPERS PARA HISTORIAL DE CONVERSACIONES ───────────

// Devuelve el ID de conversación activo (vacío si es una nueva)
function getConversationId() {
  return difyConvId || '';
}

// Setea el ID de conversación (lo usa history.js al seleccionar una conversación pasada)
function setConversationId(id) {
  difyConvId = id || '';
  if (difyConvId) {
    sessionStorage.setItem('taxia_conv_id', difyConvId);
  } else {
    sessionStorage.removeItem('taxia_conv_id');
  }
}

// Limpia el chat actual y resetea el conversation_id (nueva conversación)
function newConversation() {
  setConversationId('');
  const container = document.getElementById('ia-messages');
  if (!container) return;
  // Conservar solo el mensaje de bienvenida del bot (el primero)
  container.innerHTML = `
    <div class="chat-message msg-bot">
      <div class="msg-avatar">N</div>
      <div class="msg-content">
        <strong>¡Hola! Soy NormaIA</strong>, tu asistente tributario dominicano. 🇩🇴<br><br>
        ¿En qué puedo ayudarte hoy?
      </div>
    </div>
  `;
  removeAttachment();
}

// Renderiza los mensajes de una conversación cargada desde Dify.
// `messages` viene en orden cronológico ascendente (vienen así desde /api/messages).
function renderHistoryMessages(messages) {
  const container = document.getElementById('ia-messages');
  if (!container) return;
  container.innerHTML = '';

  if (!messages || messages.length === 0) {
    container.innerHTML = `
      <div class="chat-message msg-bot">
        <div class="msg-avatar">N</div>
        <div class="msg-content"><em>Esta conversación está vacía.</em></div>
      </div>
    `;
    return;
  }

  for (const m of messages) {
    // En Dify cada item de /messages tiene `query` (usuario) y `answer` (bot)
    if (m.query) {
      iaAppendMsg('user', escapeHtml(m.query));
    }
    if (m.answer) {
      iaAppendMsg('bot', formatBotText(m.answer));
    }
  }
  container.scrollTop = container.scrollHeight;
}

window.chat = {
  sendChatMessage,
  handleFileSelect,
  removeAttachment,
  // Helpers para historial
  getConversationId,
  setConversationId,
  newConversation,
  renderHistoryMessages,
};
