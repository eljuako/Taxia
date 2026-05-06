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
    }

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });
  },

  showModal(id) {
    const el = document.getElementById(`modal-${id}`);
    if (el) el.classList.add('open');
    // Limpiar feedback al abrir
    if (id === 'login') this.setFormFeedback('login', '');
    if (id === 'register') this.setFormFeedback('register', '');
  },

  closeModal(id) {
    const el = document.getElementById(`modal-${id}`);
    if (el) el.classList.remove('open');
  },

  showLoggedIn() {
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('app-console').style.display = 'flex';
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
      this.showToast('¡Bienvenido a TaxIA!', 'success');
      this.closeModal('login');
    } catch (err) {
      this.setFormFeedback('login', err.message || 'Error al iniciar sesión.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  },

  // ─────────── REGISTER HANDLER ───────────
  async handleRegister() {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const pass = document.getElementById('register-pass').value;
    const btn = document.getElementById('btn-register-submit');

    if (!name) { this.setFormFeedback('register', 'Ingresa tu nombre completo.', 'error'); return; }
    if (!email || !email.includes('@')) { this.setFormFeedback('register', 'Ingresa un correo válido.', 'error'); return; }
    if (!pass || pass.length < 6) { this.setFormFeedback('register', 'La contraseña debe tener al menos 6 caracteres.', 'error'); return; }

    btn.disabled = true;
    btn.textContent = 'Creando cuenta...';
    this.setFormFeedback('register', '');

    try {
      const result = await window.auth.doRegister(name, email, pass);
      if (result.needsConfirmation) {
        // Supabase pidió confirmación de email
        this.setFormFeedback('register',
          `✉️ Te enviamos un correo a ${email} para confirmar tu cuenta. Revisa tu bandeja (y spam) y haz clic en el enlace para activarla.`,
          'success'
        );
        btn.textContent = 'Revisa tu correo';
        // No cerramos el modal — el usuario debe ver el mensaje
      } else {
        // Cuenta creada y sesión iniciada
        this.showToast('¡Cuenta creada con éxito!', 'success');
        this.closeModal('register');
        btn.textContent = 'Crear cuenta gratis';
      }
    } catch (err) {
      this.setFormFeedback('register', err.message || 'Error al crear la cuenta.', 'error');
      btn.disabled = false;
      btn.textContent = 'Crear cuenta gratis';
    }
  },

  // ─────────── PLAN LOCKS ───────────
  applyPlanLocks(plan) {
    const allowed = PLAN_TOOLS[plan] || PLAN_TOOLS.libre;
    document.querySelectorAll('.nav-item[data-tool]').forEach(el => {
      const tool = el.dataset.tool;
      if (allowed.includes(tool)) el.classList.remove('locked');
      else el.classList.add('locked');
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

    const usageText = document.getElementById('ia-usage-text');
    if (usageText) usageText.textContent = `${used} / ${limit}`;

    const usageBar = document.getElementById('ia-usage-bar');
    if (usageBar) {
      const pct = Math.min(100, (used / limit) * 100);
      usageBar.style.width = `${pct}%`;
      usageBar.style.background = pct >= 90 ? 'var(--danger)' : 'var(--secondary)';
    }

    this.applyPlanLocks(plan);
  },

  // ─────────── SMART CARDS ───────────
  openSmartCard(type) {
    const profile = window.auth.getUserProfile();
    const plan = profile?.plan || 'libre';
    const allowed = PLAN_TOOLS[plan] || PLAN_TOOLS.libre;

    if (!allowed.includes(type)) {
      this.showModal('upgrade');
      return;
    }

    const panel = document.getElementById('smart-card-panel');
    const content = document.getElementById('sc-content');

    let html = '';
    if (type === 'itbis') {
      html = `
        <div class="sc-header"><h3>Calculadora ITBIS</h3>
          <button class="sc-close" onclick="window.app.closeSmartCard()">✕</button></div>
        <div class="sc-body">
          <div class="sc-form-group"><label>ITBIS Cobrado (RD$)</label>
            <input type="number" id="itbis-cobrado" placeholder="0.00"></div>
          <div class="sc-form-group"><label>ITBIS Pagado (RD$)</label>
            <input type="number" id="itbis-pagado" placeholder="0.00"></div>
          <button class="btn-calc v2-cta-btn" style="width:100%;" onclick="window.calc.runCalc('itbis')">Calcular ITBIS</button>
          <div id="calc-result"></div>
        </div>`;
    } else if (type === 'rst') {
      html = `
        <div class="sc-header"><h3>Simulador RST</h3>
          <button class="sc-close" onclick="window.app.closeSmartCard()">✕</button></div>
        <div class="sc-body">
          <p style="color:var(--text-muted); font-size:0.88rem; margin-bottom:1rem;">
            Régimen Simplificado de Tributación (RC-02). Estima tu cuota mensual según ingresos brutos.
          </p>
          <div class="sc-form-group"><label>Ingresos Brutos Anuales (RD$)</label>
            <input type="number" id="rst-ingresos" placeholder="0.00"></div>
          <div class="sc-form-group"><label>Tipo de actividad</label>
            <select id="rst-tipo" style="width:100%; padding:0.8rem; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; font-family:var(--font-body);">
              <option value="comercial">Comercial / Industrial</option>
              <option value="servicios">Servicios</option>
            </select></div>
          <button class="btn-calc v2-cta-btn" style="width:100%;" onclick="window.calc.runCalc('rst')">Calcular RST</button>
          <div id="calc-result"></div>
        </div>`;
    } else if (type === 'ir1') {
      html = `
        <div class="sc-header"><h3>Simulador IR-1</h3>
          <button class="sc-close" onclick="window.app.closeSmartCard()">✕</button></div>
        <div class="sc-body">
          <div class="sc-form-group"><label>Ingresos Brutos Anuales (RD$)</label>
            <input type="number" id="ir1-ingresos" placeholder="0.00"></div>
          <div class="sc-form-group"><label>Gastos Deducibles (RD$)</label>
            <input type="number" id="ir1-gastos" placeholder="0.00"></div>
          <button class="btn-calc v2-cta-btn" style="width:100%;" onclick="window.calc.runCalc('ir1')">Calcular IR-1</button>
          <div id="calc-result"></div>
        </div>`;
    } else if (type === 'ir2') {
      html = `
        <div class="sc-header"><h3>Simulador IR-2</h3>
          <button class="sc-close" onclick="window.app.closeSmartCard()">✕</button></div>
        <div class="sc-body">
          <p style="color:var(--text-muted); font-size:0.9rem;">Próximamente: cálculo de ISR para personas jurídicas (27% sobre renta neta imponible).</p>
        </div>`;
    } else if (type === 'ir17') {
      html = `
        <div class="sc-header"><h3>Simulador IR-17</h3>
          <button class="sc-close" onclick="window.app.closeSmartCard()">✕</button></div>
        <div class="sc-body">
          <p style="color:var(--text-muted); font-size:0.9rem;">Próximamente: cálculo de retenciones en la fuente.</p>
        </div>`;
    }

    content.innerHTML = html;
    panel.classList.add('open');
  },

  closeSmartCard() {
    document.getElementById('smart-card-panel').classList.remove('open');
  },
};

window.app = app;
document.addEventListener('DOMContentLoaded', () => app.init());
