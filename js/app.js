// app.js

// Herramientas disponibles por plan
const PLAN_TOOLS = {
  libre:   ['itbis'],
  pro:     ['itbis', 'ir1', 'ir2', 'ir17'],
  pro_max: ['itbis', 'ir1', 'ir2', 'ir17'],
};

const app = {
  init() {
    window.auth.initSupabase();
    this.setupListeners();
    // Por defecto (sin perfil cargado aún), tratar como libre
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

    // Cerrar modales al hacer click fuera del contenido
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('open');
        }
      });
    });
  },

  showModal(id) {
    const el = document.getElementById(`modal-${id}`);
    if (el) el.classList.add('open');
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

  // Marca como bloqueadas las herramientas que el plan actual no incluye
  applyPlanLocks(plan) {
    const allowed = PLAN_TOOLS[plan] || PLAN_TOOLS.libre;
    document.querySelectorAll('.nav-item[data-tool]').forEach(el => {
      const tool = el.dataset.tool;
      if (allowed.includes(tool)) {
        el.classList.remove('locked');
      } else {
        el.classList.add('locked');
      }
    });

    // Marcar plan actual en el modal de upgrade
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
    if (planDisplay) {
      planDisplay.textContent = (window.CONFIG && window.CONFIG.PLAN_LABELS[plan]) || 'Plan Libre';
    }

    const usageText = document.getElementById('ia-usage-text');
    if (usageText) usageText.textContent = `${used} / ${limit}`;

    const usageBar = document.getElementById('ia-usage-bar');
    if (usageBar) {
      const pct = Math.min(100, (used / limit) * 100);
      usageBar.style.width = `${pct}%`;
      if (pct >= 90) {
        usageBar.style.background = 'var(--danger)';
      } else {
        usageBar.style.background = 'var(--secondary)';
      }
    }

    // Aplicar candados según plan
    this.applyPlanLocks(plan);
  },

  openSmartCard(type) {
    // Validar plan antes de abrir el simulador
    const profile = window.auth.getUserProfile();
    const plan = profile?.plan || 'libre';
    const allowed = PLAN_TOOLS[plan] || PLAN_TOOLS.libre;

    if (!allowed.includes(type)) {
      // Herramienta bloqueada → mostrar modal de upgrade
      this.showModal('upgrade');
      return;
    }

    const panel = document.getElementById('smart-card-panel');
    const content = document.getElementById('sc-content');

    let html = '';
    if (type === 'itbis') {
      html = `
        <div class="sc-header">
          <h3>Calculadora ITBIS</h3>
          <button class="sc-close" onclick="window.app.closeSmartCard()">✕</button>
        </div>
        <div class="sc-body">
          <div class="sc-form-group">
            <label>ITBIS Cobrado (RD$)</label>
            <input type="number" id="itbis-cobrado" placeholder="0.00">
          </div>
          <div class="sc-form-group">
            <label>ITBIS Pagado (RD$)</label>
            <input type="number" id="itbis-pagado" placeholder="0.00">
          </div>
          <button class="btn-calc v2-cta-btn" style="width:100%;" onclick="window.calc.runCalc('itbis')">Calcular ITBIS</button>
          <div id="calc-result"></div>
        </div>
      `;
    } else if (type === 'ir1') {
      html = `
        <div class="sc-header">
          <h3>Simulador IR-1</h3>
          <button class="sc-close" onclick="window.app.closeSmartCard()">✕</button>
        </div>
        <div class="sc-body">
          <div class="sc-form-group">
            <label>Ingresos Brutos Anuales (RD$)</label>
            <input type="number" id="ir1-ingresos" placeholder="0.00">
          </div>
          <div class="sc-form-group">
            <label>Gastos Deducibles (RD$)</label>
            <input type="number" id="ir1-gastos" placeholder="0.00">
          </div>
          <button class="btn-calc v2-cta-btn" style="width:100%;" onclick="window.calc.runCalc('ir1')">Calcular IR-1</button>
          <div id="calc-result"></div>
        </div>
      `;
    } else if (type === 'ir2') {
      html = `
        <div class="sc-header">
          <h3>Simulador IR-2</h3>
          <button class="sc-close" onclick="window.app.closeSmartCard()">✕</button>
        </div>
        <div class="sc-body">
          <p style="color:var(--text-muted); font-size:0.9rem;">Próximamente: cálculo de ISR para personas jurídicas (27% sobre renta neta imponible).</p>
        </div>
      `;
    } else if (type === 'ir17') {
      html = `
        <div class="sc-header">
          <h3>Simulador IR-17</h3>
          <button class="sc-close" onclick="window.app.closeSmartCard()">✕</button>
        </div>
        <div class="sc-body">
          <p style="color:var(--text-muted); font-size:0.9rem;">Próximamente: cálculo de retenciones en la fuente.</p>
        </div>
      `;
    }

    content.innerHTML = html;
    panel.classList.add('open');
  },

  closeSmartCard() {
    document.getElementById('smart-card-panel').classList.remove('open');
  }
};

window.app = app;
document.addEventListener('DOMContentLoaded', () => app.init());
