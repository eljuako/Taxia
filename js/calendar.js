// js/calendar.js
// Calendario de Vencimientos Fiscales DGII — feature de plan Pro+.
// Calcula próximos vencimientos a partir de la fecha actual y los renderiza
// en un modal accesible desde la toolbar.

(function () {
  'use strict';

  // ════════════════════════════════════════════════════════════════
  // CATÁLOGO DE VENCIMIENTOS FIJOS DGII (referenciales 2025-2026)
  // ════════════════════════════════════════════════════════════════
  //
  // type: 'monthly' | 'yearly' | 'biannual' | 'quarterly'
  // dayOfMonth: día (1-31) — para monthly y los específicos
  // months: array de meses (1-12) en los que aplica — para biannual/quarterly
  // monthOffset: para monthly = mes siguiente al período (ej. IT-1 de enero vence en febrero)
  //
  const VENCIMIENTOS = [
    {
      key: 'it1',
      label: 'IT-1 (ITBIS mensual)',
      desc: 'Declaración mensual del ITBIS facturado y deducciones',
      type: 'monthly',
      dayOfMonth: 20,
      monthOffset: 1,           // del período al vencimiento
      icon: '📊',
      legal: 'Art. 350 CT · Día 20 del mes siguiente',
    },
    {
      key: 'ir3',
      label: 'IR-3 (Retenciones empleados)',
      desc: 'Retención del ISR sobre salarios pagados',
      type: 'monthly',
      dayOfMonth: 10,
      monthOffset: 1,
      icon: '👥',
      legal: 'Art. 309 CT · Día 10 del mes siguiente',
    },
    {
      key: 'ir17',
      label: 'IR-17 (Retenciones a terceros)',
      desc: 'Retenciones a proveedores y servicios (honorarios, alquileres, etc.)',
      type: 'monthly',
      dayOfMonth: 10,
      monthOffset: 1,
      icon: '💼',
      legal: 'Art. 309 CT · Día 10 del mes siguiente',
    },
    {
      key: 'ir13',
      label: 'IR-13 (Anticipos ISR)',
      desc: 'Anticipos trimestrales sobre el ISR del año anterior',
      type: 'quarterly',
      dayOfMonth: 15,
      months: [3, 6, 9, 12],    // marzo, junio, sept, dic
      icon: '💰',
      legal: 'Art. 314 CT · Día 15 de marzo/junio/septiembre/diciembre',
    },
    {
      key: 'ir1',
      label: 'IR-1 (Declaración anual PF)',
      desc: 'Declaración jurada de Personas Físicas',
      type: 'yearly',
      dayOfMonth: 31,
      month: 3,                  // marzo
      icon: '👤',
      legal: 'Art. 110 CT · 31 de marzo',
    },
    {
      key: 'ir2',
      label: 'IR-2 (Declaración anual PJ)',
      desc: 'Declaración jurada de Personas Jurídicas (cierre dic = 30 abril)',
      type: 'yearly',
      dayOfMonth: 30,
      month: 4,                  // 120 días post cierre dic = 30 abril
      icon: '🏢',
      legal: '120 días post cierre fiscal · típico 30 de abril',
    },
    {
      key: 'ipi',
      label: 'IPI (Patrimonio Inmobiliario)',
      desc: 'Impuesto sobre patrimonio inmobiliario — 2 cuotas',
      type: 'biannual',
      dayOfMonth: 11,
      months: [3, 9],            // 11 marzo y 11 septiembre
      icon: '🏠',
      legal: 'Ley 18-88 · 11 de marzo y 11 de septiembre',
    },
    {
      key: 'rst',
      label: 'RST (Régimen Simplificado)',
      desc: 'Cuota trimestral del Régimen Simplificado de Tributación',
      type: 'quarterly',
      dayOfMonth: 15,
      months: [3, 6, 9, 12],
      icon: '📋',
      legal: 'Decreto 265-19 · 4 cuotas trimestrales',
    },
    {
      key: 'dior',
      label: 'DIOR (Partes vinculadas)',
      desc: 'Declaración informativa de operaciones con partes relacionadas',
      type: 'yearly',
      dayOfMonth: 30,
      month: 6,                  // 180 días post cierre dic
      icon: '🔗',
      legal: '180 días post cierre fiscal · típico 30 de junio',
    },
  ];

  // ════════════════════════════════════════════════════════════════
  // CÁLCULO DE PRÓXIMOS VENCIMIENTOS
  // ════════════════════════════════════════════════════════════════

  // Suma N meses a una fecha (preserva el día si existe en el mes destino)
  function addMonths(date, n) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + n);
    return d;
  }

  // Calcula la próxima fecha de vencimiento para un item dado a partir de "now"
  function nextOccurrence(item, now) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();
    const month = today.getMonth() + 1;   // 1-12
    const day = today.getDate();

    if (item.type === 'monthly') {
      // Vence el día N del mes siguiente al período actual.
      // Si aún no ha pasado el día N del mes actual, ese es el vencimiento de este mes.
      // Si ya pasó, el próximo es el día N del mes siguiente.
      let candidateMonth = month;
      let candidateYear = year;
      if (day > item.dayOfMonth) {
        candidateMonth += 1;
        if (candidateMonth > 12) { candidateMonth = 1; candidateYear += 1; }
      }
      return new Date(candidateYear, candidateMonth - 1, item.dayOfMonth);
    }

    if (item.type === 'yearly') {
      let candidateYear = year;
      const candidate = new Date(candidateYear, item.month - 1, item.dayOfMonth);
      if (candidate < today) candidateYear += 1;
      return new Date(candidateYear, item.month - 1, item.dayOfMonth);
    }

    if (item.type === 'biannual' || item.type === 'quarterly') {
      // Buscamos el próximo mes de la lista
      const months = item.months || [];
      for (const m of months) {
        const candidate = new Date(year, m - 1, item.dayOfMonth);
        if (candidate >= today) return candidate;
      }
      // Si ya pasaron todos este año, el primero del próximo año
      return new Date(year + 1, months[0] - 1, item.dayOfMonth);
    }
    return null;
  }

  // Devuelve los próximos N vencimientos ordenados por fecha
  function getUpcoming(limit = 10, now = new Date()) {
    const list = VENCIMIENTOS.map(item => {
      const date = nextOccurrence(item, now);
      const daysLeft = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
      return { ...item, date, daysLeft };
    }).sort((a, b) => a.date - b.date);
    return list.slice(0, limit);
  }

  // ════════════════════════════════════════════════════════════════
  // FORMATO Y UI
  // ════════════════════════════════════════════════════════════════

  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  function formatDate(d) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = MESES[d.getMonth()];
    return `${dd} ${mm}`;
  }

  function urgencyClass(daysLeft) {
    if (daysLeft <= 3) return 'urgent';
    if (daysLeft <= 10) return 'warn';
    return 'ok';
  }

  function urgencyLabel(daysLeft) {
    if (daysLeft === 0) return 'Hoy';
    if (daysLeft === 1) return 'Mañana';
    if (daysLeft <= 7) return `En ${daysLeft} días`;
    if (daysLeft <= 30) return `En ${daysLeft} días`;
    return `En ${daysLeft} días`;
  }

  // ════════════════════════════════════════════════════════════════
  // MODAL
  // ════════════════════════════════════════════════════════════════

  function getPlan() {
    const profile = window.auth?.getUserProfile?.();
    return profile?.plan || 'libre';
  }

  function ensureModal() {
    let modal = document.getElementById('modal-calendar');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'modal-calendar';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal calendar-modal">
        <button type="button" class="modal-close" onclick="window.app.closeModal('calendar')" aria-label="Cerrar">✕</button>
        <h2 style="text-align:left; margin-bottom:0.25rem;">Calendario de vencimientos</h2>
        <p style="color:var(--ink-3); font-size:0.92rem; margin-bottom:1.2rem;">
          Próximos plazos DGII calculados en tiempo real. <span style="font-family:var(--mono); font-size:11px; color:var(--ink-4);" id="cal-today"></span>
        </p>
        <div id="cal-body"></div>
      </div>
    `;
    document.body.appendChild(modal);
    // Cerrar al hacer click en el overlay
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
    return modal;
  }

  function renderUpcoming() {
    const body = document.getElementById('cal-body');
    if (!body) return;
    const today = new Date();
    const list = getUpcoming(12, today);

    const todayEl = document.getElementById('cal-today');
    if (todayEl) todayEl.textContent = `Hoy: ${formatDate(today)} ${today.getFullYear()}`;

    body.innerHTML = `
      <ul class="cal-list">
        ${list.map(item => `
          <li class="cal-item ${urgencyClass(item.daysLeft)}">
            <div class="cal-icon">${item.icon}</div>
            <div class="cal-main">
              <div class="cal-title">${item.label}</div>
              <div class="cal-desc">${item.desc}</div>
              <div class="cal-legal">${item.legal}</div>
            </div>
            <div class="cal-date">
              <div class="cal-date-num">${formatDate(item.date)}</div>
              <div class="cal-date-year">${item.date.getFullYear()}</div>
              <div class="cal-date-left">${urgencyLabel(item.daysLeft)}</div>
            </div>
          </li>
        `).join('')}
      </ul>
      <p style="text-align:center; margin-top:1rem; color:var(--ink-4); font-size:11px; font-family:var(--mono);">
        Los plazos pueden extenderse al siguiente día hábil si caen en sábado, domingo o feriado.
      </p>
    `;
  }

  function renderUpgradeTeaser() {
    const body = document.getElementById('cal-body');
    if (!body) return;
    body.innerHTML = `
      <div class="cal-locked">
        <div class="cal-locked-icon">🔒</div>
        <h3>Disponible en planes Pro y Max</h3>
        <p>Recibe alertas anticipadas de IT-1, IR-1, IR-2, IR-17, anticipos, RST, IPI y más — todos los plazos DGII en un solo lugar, actualizados automáticamente.</p>
        <button type="button" class="cta-upgrade-cal" onclick="window.app.closeModal('calendar'); window.app.showModal('upgrade');">
          ⚡ Ver planes de pago
        </button>
        <ul class="cal-preview-list">
          ${getUpcoming(3).map(item => `
            <li>
              <span>${item.icon} ${item.label}</span>
              <span style="font-family:var(--mono); color:var(--ink-4);">${formatDate(item.date)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════════
  // API PÚBLICA
  // ════════════════════════════════════════════════════════════════

  function open() {
    ensureModal();
    const plan = getPlan();
    if (plan === 'libre') {
      renderUpgradeTeaser();
    } else {
      renderUpcoming();
    }
    document.getElementById('modal-calendar')?.classList.add('open');
  }

  // Devuelve el próximo vencimiento más cercano (para badge en toolbar, etc.)
  function getNextDeadline() {
    const list = getUpcoming(1);
    return list[0] || null;
  }

  window.calendar = {
    open,
    getUpcoming,
    getNextDeadline,
    VENCIMIENTOS,  // exportado por si forms.js quisiera usarlo
  };
})();
