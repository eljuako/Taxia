// app.js

const app = {
  init() {
    window.auth.initSupabase();
    this.setupListeners();
  },

  setupListeners() {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if(e.currentTarget.dataset.tab) {
          this.switchTab(e.currentTarget.dataset.tab);
        }
      });
    });

    const chatInput = document.getElementById('chat-input');
    if(chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          window.chat.sendChatMessage();
        }
      });
    }
  },

  showModal(id) {
    document.getElementById(`modal-${id}`).classList.add('open');
  },

  closeModal(id) {
    document.getElementById(`modal-${id}`).classList.remove('open');
  },

  showLoggedIn() {
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('app-console').style.display = 'flex';
  },

  showLoggedOut() {
    document.getElementById('landing-page').style.display = 'block';
    document.getElementById('app-console').style.display = 'none';
  },

  updateUIWithProfile(profile) {
    const nameEl = document.getElementById('user-name-display');
    if (nameEl) nameEl.textContent = profile.full_name || 'Usuario';
    
    const plan = profile.plan || 'libre';
    const used = profile.queries_used || 0;
    const limit = profile.queries_limit || window.CONFIG.PLAN_LIMITS[plan] || 10;
    const remaining = Math.max(0, limit - used);
    
    const planDisplay = document.getElementById('user-plan-display');
    if (planDisplay) planDisplay.textContent = window.CONFIG.PLAN_LABELS[plan] || 'Plan Libre';
    
    const usageText = document.getElementById('ia-usage-text');
    if (usageText) usageText.textContent = `${used} / ${limit}`;
    
    const usageBar = document.getElementById('ia-usage-bar');
    if (usageBar) {
      const pct = Math.min(100, (used / limit) * 100);
      usageBar.style.width = `${pct}%`;
      if (pct >= 90) {
        usageBar.style.background = 'var(--danger)';
      } else {
        usageBar.style.background = 'linear-gradient(90deg, var(--blue-accent), var(--gold-primary))';
      }
    }
  },

  openSmartCard(type) {
    const panel = document.getElementById('smart-card-panel');
    const content = document.getElementById('sc-content');
    
    let html = '';
    if (type === 'itbis') {
      html = `
        <div class="sc-header">
          <h3>Calculadora ITBIS</h3>
          <button class="sc-close" onclick="window.app.closeSmartCard()">✕</button>
        </div>
        <div class="drop-zone">Arrastra tu IT-1 (PDF/Excel) aquí</div>
        <div class="tax-input-group">
          <label>ITBIS Cobrado</label>
          <input type="number" id="itbis-cobrado" placeholder="0.00">
        </div>
        <div class="tax-input-group">
          <label>ITBIS Pagado</label>
          <input type="number" id="itbis-pagado" placeholder="0.00">
        </div>
        <button class="btn-calc" onclick="window.calc.runCalc('itbis')">Calcular ITBIS</button>
        <div id="calc-result"></div>
      `;
    } else if (type === 'ir1') {
      html = `
        <div class="sc-header">
          <h3>Simulador IR-1</h3>
          <button class="sc-close" onclick="window.app.closeSmartCard()">✕</button>
        </div>
        <div class="tax-input-group">
          <label>Ingresos Brutos Anuales</label>
          <input type="number" id="ir1-ingresos" placeholder="0.00">
        </div>
        <div class="tax-input-group">
          <label>Gastos Deducibles</label>
          <input type="number" id="ir1-gastos" placeholder="0.00">
        </div>
        <button class="btn-calc" onclick="window.calc.runCalc('ir1')">Calcular IR-1</button>
        <div id="calc-result"></div>
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
