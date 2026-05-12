// js/history.js
// Historial de conversaciones — conecta el sidebar con /api/conversations y /api/messages.
// Permite listar, abrir, renombrar y borrar conversaciones pasadas.

(function () {
  'use strict';

  let _conversations = [];
  let _activeConvId = null;
  let _loading = false;

  // El user ID que se manda a Dify debe coincidir con el que usa chat.js
  // (chat.js usa: 'taxia-user-' + currentUser.id.slice(0, 8))
  function getDifyUserId() {
    const u = window.auth?.getCurrentUser?.();
    if (!u?.id) return null;
    return 'taxia-user-' + u.id.slice(0, 8);
  }

  // ─────────── API CALLS ───────────

  async function fetchConversations() {
    const user = getDifyUserId();
    if (!user) return { data: [] };
    const res = await fetch(`/api/conversations?user=${encodeURIComponent(user)}&limit=30`);
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.json();
  }

  async function fetchMessages(conversationId) {
    const user = getDifyUserId();
    if (!user) throw new Error('No user');
    const res = await fetch(
      `/api/messages?conversation_id=${encodeURIComponent(conversationId)}&user=${encodeURIComponent(user)}&limit=50`
    );
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.json();
  }

  async function apiDeleteConversation(conversationId) {
    const user = getDifyUserId();
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', conversationId, user }),
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.json();
  }

  async function apiRenameConversation(conversationId, name) {
    const user = getDifyUserId();
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rename', conversationId, user, name }),
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.json();
  }

  // ─────────── HELPERS DE UI ───────────

  function escapeHtml(t) {
    return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fmtDate(ts) {
    if (!ts) return '';
    // Dify devuelve updated_at como epoch en SEGUNDOS
    const ms = ts < 10_000_000_000 ? ts * 1000 : ts;
    const d = new Date(ms);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
    }
    const sameYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleDateString('es-DO', sameYear
      ? { day: '2-digit', month: 'short' }
      : { day: '2-digit', month: 'short', year: '2-digit' });
  }

  function renderList() {
    const ul = document.getElementById('history-list');
    if (!ul) return;

    if (_loading) {
      ul.innerHTML = '<li class="history-empty">Cargando…</li>';
      return;
    }

    if (!_conversations.length) {
      ul.innerHTML = '<li class="history-empty">Sin conversaciones todavía.</li>';
      return;
    }

    ul.innerHTML = _conversations.map(c => {
      const isActive = c.id === _activeConvId;
      const name = c.name && c.name.trim() ? c.name : 'Conversación sin título';
      return `
        <li class="history-item ${isActive ? 'active' : ''}" data-id="${c.id}" title="${escapeHtml(name)}">
          <button class="history-item-main" data-action="open" data-id="${c.id}">
            <span class="history-item-title">${escapeHtml(name)}</span>
            <span class="history-item-date">${fmtDate(c.updated_at)}</span>
          </button>
          <div class="history-item-actions">
            <button class="history-action-btn" data-action="rename" data-id="${c.id}" title="Renombrar">✎</button>
            <button class="history-action-btn danger" data-action="delete" data-id="${c.id}" title="Eliminar">🗑</button>
          </div>
        </li>
      `;
    }).join('');
  }

  // ─────────── ACCIONES ───────────

  async function refresh() {
    _loading = true;
    renderList();
    try {
      const data = await fetchConversations();
      _conversations = Array.isArray(data?.data) ? data.data : [];
      // Sincronizar la conversación activa con la del chat actual
      _activeConvId = window.chat?.getConversationId?.() || null;
    } catch (e) {
      console.warn('No se pudo cargar el historial:', e);
      _conversations = [];
    } finally {
      _loading = false;
      renderList();
    }
  }

  async function openConversation(convId) {
    if (!convId) return;
    try {
      // Indicador rápido
      const ul = document.getElementById('history-list');
      const item = ul?.querySelector(`[data-id="${convId}"]`);
      if (item) item.classList.add('loading');

      const data = await fetchMessages(convId);
      const messages = Array.isArray(data?.data) ? data.data : [];

      window.chat.setConversationId(convId);
      window.chat.renderHistoryMessages(messages);
      _activeConvId = convId;
      renderList();

      // En móvil, cerrar el sidebar al abrir
      if (window.innerWidth <= 768) {
        document.querySelector('.app-sidebar')?.classList.remove('open');
      }
    } catch (e) {
      window.app?.showToast?.('No se pudo cargar la conversación.', 'error');
      console.error(e);
    } finally {
      const ul = document.getElementById('history-list');
      ul?.querySelector(`[data-id="${convId}"]`)?.classList.remove('loading');
    }
  }

  function newConversation() {
    window.chat.newConversation();
    _activeConvId = null;
    renderList();
  }

  async function renameConversation(convId) {
    const current = _conversations.find(c => c.id === convId);
    const proposed = prompt('Nuevo nombre para la conversación:', current?.name || '');
    if (proposed === null) return;
    const name = proposed.trim();
    try {
      await apiRenameConversation(convId, name);
      window.app?.showToast?.('Conversación renombrada.', 'success', 2000);
      await refresh();
    } catch (e) {
      window.app?.showToast?.('No se pudo renombrar.', 'error');
    }
  }

  async function deleteConversation(convId) {
    if (!confirm('¿Eliminar esta conversación? Esta acción no se puede deshacer.')) return;
    try {
      await apiDeleteConversation(convId);
      // Si era la activa, limpiar el chat
      if (_activeConvId === convId) {
        newConversation();
      }
      window.app?.showToast?.('Conversación eliminada.', 'success', 2000);
      await refresh();
    } catch (e) {
      window.app?.showToast?.('No se pudo eliminar.', 'error');
    }
  }

  // ─────────── DELEGACIÓN DE EVENTOS ───────────

  function attachListeners() {
    const ul = document.getElementById('history-list');
    if (!ul || ul.dataset.bound === '1') return;
    ul.dataset.bound = '1';
    ul.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (!id) return;
      if (action === 'open') openConversation(id);
      else if (action === 'rename') renameConversation(id);
      else if (action === 'delete') deleteConversation(id);
    });

    const newBtn = document.getElementById('btn-new-conversation');
    if (newBtn && newBtn.dataset.bound !== '1') {
      newBtn.dataset.bound = '1';
      newBtn.addEventListener('click', () => {
        newConversation();
        window.app?.showToast?.('Nueva conversación lista.', 'info', 1500);
      });
    }

    const refreshBtn = document.getElementById('btn-refresh-history');
    if (refreshBtn && refreshBtn.dataset.bound !== '1') {
      refreshBtn.dataset.bound = '1';
      refreshBtn.addEventListener('click', () => refresh());
    }
  }

  // ─────────── INIT ───────────

  // Llamado por app.js cuando el usuario inicia sesión
  async function init() {
    attachListeners();
    await refresh();
  }

  window.history_ui = { init, refresh, newConversation };
})();
