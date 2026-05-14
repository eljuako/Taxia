// app.js

// Herramientas disponibles por plan
const PLAN_TOOLS = {
  libre:   ['itbis', 'rst'],
  pro:     ['itbis', 'rst', 'ir1', 'ir2', 'ir17'],
  pro_max: ['itbis', 'rst', 'ir1', 'ir2', 'ir17'],
};

const app = {
  init() {
    window.auth.initSupabase();
    this.setupListeners();
    this.applyPlanLocks('libre');
    // Mostrar paperclip solo si FILE_UPLOAD_ENABLED está activado
    const attachBtn = document.getElementById('btn-attach');
    if (attachBtn && window.CONFIG?.FILE_UPLOAD_ENABLED) {
      attachBtn.style.display = '';
    }
    // Si llegamos desde /registro.html con ?login=1, abrir el modal de login
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === '1') {
      setTimeout(() => this.showModal('login'), 300);
    }
    // Si el email fue recién confirmado desde el enlace del correo
    if (params.get('confirmed') === '1') {
      setTimeout(() => {
        // Si Supabase auto-logueó (caso normal), el listener mostrará la app sola.
        // Si NO hay sesión activa, abrimos el modal de login con un toast.
        const isLogged = document.getElementById('app-console').style.display === 'flex';
        if (!isLogged) {
          this.showModal('login');
          this.setFormFeedback('login', '✓ Tu correo fue confirmado exitosamente. Ahora inicia sesión.', 'success');
        } else {
          this.showToast('✓ Correo confirmado. ¡Bienvenido a NormaIA!', 'success');
        }
        // Limpiar URL para que el mensaje no se repita al recargar
        window.history.replaceState({}, '', window.location.pathname);
      }, 800);
    }
  },

  setupListeners() {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.currentTarget.dataset.tab) {
          this.switchTab(e.currentTarget.dataset.tab);
        }
      });
    });

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          window.chat.sendChatMessage();
        }
      });
      // Auto-resize del textarea (crece hasta 150px)
      chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
      });
    }

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });

    // Enter en inputs del modal de login → dispara handleLogin
    ['login-email', 'login-pass'].forEach(id => {
      const inp = document.getElementById(id);
      if (inp) {
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.handleLogin();
          }
        });
      }
    });

    // ESC cierra cualquier modal abierto
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      }
    });
  },

  switchTab(tab) {
    document.querySelectorAll('.nav-item[data-tab]').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
  },

  showModal(id) {
    // El registro vive en su propia página
    if (id === 'register') {
      window.location.href = 'registro.html';
      return;
    }
    const el = document.getElementById(`modal-${id}`);
    if (el) el.classList.add('open');
    if (id === 'login') this.setFormFeedback('login', '');

    // Si abrimos el modal de upgrade, renderizar los botones PayPal.
    // El skeleton ya está visible (HTML estático), así que el usuario ve algo
    // inmediatamente. PayPal renderiza en requestAnimationFrame (siguiente paint).
    if (id === 'upgrade' && window.payments?.initUpgradeButtons) {
      window.payments.initUpgradeButtons();
    }
  },

  closeModal(id) {
    const el = document.getElementById(`modal-${id}`);
    if (el) el.classList.remove('open');
  },

  showLoggedIn() {
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('app-console').style.display = 'flex';
    // Cargar el historial de conversaciones del usuario (best-effort, no bloqueante)
    if (window.history_ui?.init) {
      window.history_ui.init().catch(() => {});
    }
  },

  showLoggedOut() {
    document.getElementById('landing-page').style.display = 'block';
    document.getElementById('app-console').style.display = 'none';
  },

  // ─────────── TOAST ───────────
  showToast(message, type = 'info', duration = 4000) {
    const cont = document.getElementById('toast-container');
    if (!cont) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    toast.innerHTML = `<div class="icon">${icons[type] || 'ℹ'}</div><div>${message}</div>`;
    cont.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fadeout');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // ─────────── FORM FEEDBACK ───────────
  setFormFeedback(form, message, type) {
    const el = document.getElementById(`${form}-feedback`);
    if (!el) return;
    if (!message) {
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    el.className = `form-feedback ${type || ''}`;
    el.textContent = message;
    el.style.display = 'block';
  },

  // ─────────── LOGIN HANDLER ───────────
  async handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value;
    const btn = document.getElementById('btn-login-submit');

    if (!email || !pass) {
      this.setFormFeedback('login', 'Completa email y contraseña.', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Entrando...';
    this.setFormFeedback('login', '');

    try {
      await window.auth.doLogin(email, pass);
      this.showToast('¡Bienvenido a NormaIA!', 'success');
      this.closeModal('login');
    } catch (err) {
      this.setFormFeedback('login', err.message || 'Error al iniciar sesión.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  },

  // ─────────── PLAN LOCKS ───────────
  applyPlanLocks(plan) {
    const allowed = PLAN_TOOLS[plan] || PLAN_TOOLS.libre;
    // Aplica a nav-items del sidebar (legacy) Y a las tool-chips de la toolbar
    document.querySelectorAll('.nav-item[data-tool], .tool-chip[data-tool]').forEach(el => {
      const tool = el.dataset.tool;
      const isLocked = !allowed.includes(tool);
      el.classList.toggle('locked', isLocked);
      // Ocultar el lock badge si el plan ya incluye esa herramienta
      const lock = el.querySelector('.lock-badge, .tool-chip-lock');
      if (lock) lock.style.display = isLocked ? '' : 'none';
    });

    ['libre', 'pro', 'promax'].forEach(key => {
      const tag = document.getElementById('tag-current-' + key);
      const card = document.getElementById('upgrade-' + key);
      if (!tag || !card) return;
      const matchKey = key === 'promax' ? 'pro_max' : key;
      if (matchKey === plan) {
        tag.style.display = 'inline-block';
        card.classList.add('current');
      } else {
        tag.style.display = 'none';
        card.classList.remove('current');
      }
    });
  },

  updateUIWithProfile(profile) {
    const nameEl = document.getElementById('user-name-display');
    if (nameEl) nameEl.textContent = profile.full_name || 'Usuario';

    const initialEl = document.getElementById('user-initial');
    if (initialEl) {
      const initial = (profile.full_name?.[0] || profile.email?.[0] || 'U').toUpperCase();
      initialEl.textContent = initial;
    }

    const plan = profile.plan || 'libre';
    const used = profile.queries_used || 0;
    const limit = profile.queries_limit || (window.CONFIG && window.CONFIG.PLAN_LIMITS[plan]) || 10;

    const planDisplay = document.getElementById('user-plan-display');
    if (planDisplay) planDisplay.textContent = (window.CONFIG && window.CONFIG.PLAN_LABELS[plan]) || 'Plan Libre';

    // Tag del logo del sidebar (al lado de "NormaIA") — refleja el plan actual
    const sidebarTag = document.getElementById('sidebar-plan-tag');
    if (sidebarTag) {
      const tagMap = { libre: 'Libre', pro: 'Pro', pro_max: 'Pro Max' };
      sidebarTag.textContent = tagMap[plan] || 'Libre';
    }

    const usageText = document.getElementById('ia-usage-text');
    if (usageText) usageText.textContent = `${used} / ${limit}`;

    const usageBar = document.getElementById('ia-usage-bar');
    if (usageBar) {
      const pct = Math.min(100, (used / limit) * 100);
      usageBar.style.width = `${pct}%`;
      usageBar.style.background = pct >= 90 ? 'var(--danger)' : 'var(--accent)';
    }

    this.applyPlanLocks(plan);
  },

  // ─────────── FORMULARIOS COMPLETOS (delegado a forms.js) ───────────
  // Mapeo entre las claves de Smart Tools y las claves de los formularios
  _formMap: { itbis: 'it1', ir1: 'ir1', ir2: 'ir2', ir17: 'ir17', rst: 'rst' },

  openSmartCard(type) {
    const profile = window.auth.getUserProfile();
    const plan = profile?.plan || 'libre';
    const allowed = PLAN_TOOLS[plan] || PLAN_TOOLS.libre;

    if (!allowed.includes(type)) {
      this.showModal('upgrade');
      return;
    }

    const formKey = this._formMap[type];
    if (!formKey || !window.forms) {
      console.warn('Formulario no disponible:', type);
      return;
    }
    window.forms.open(formKey);
  },

  closeSmartCard() {
    document.getElementById('smart-card-panel').classList.remove('open');
  },
};

window.app = app;
document.addEventListener('DOMContentLoaded', () => app.init());

