// js/forms.js
// Sistema de formularios fiscales completos para TaxIA.
// Cada formulario soporta 3 modos de llenado: Manual, Documento (extracción IA), Chat (extracción de conversación).

(function () {
  'use strict';

  // ─────────── UTILIDADES ───────────
  function fmtRD(n) {
    const num = Number(n) || 0;
    return 'RD$ ' + num.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function num(id) { return parseFloat(document.getElementById(id)?.value) || 0; }
  function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
  function setText(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }

  // Escala progresiva ISR personas físicas (referencial 2024-2025, actualizable)
  const TABLA_IR1 = [
    { desde: 0,       tasa: 0,    base: 0     },
    { desde: 416220,  tasa: 0.15, base: 0     },
    { desde: 624329,  tasa: 0.20, base: 31216 },
    { desde: 867123,  tasa: 0.25, base: 79776 },
  ];
  function calcIR1(rentaNeta) {
    for (let i = TABLA_IR1.length - 1; i >= 0; i--) {
      const t = TABLA_IR1[i];
      if (rentaNeta > t.desde) return +(t.base + (rentaNeta - t.desde) * t.tasa).toFixed(2);
    }
    return 0;
  }

  // ═══════════════════════════════════════════════════════════
  //                   DEFINICIONES DE FORMULARIOS
  // ═══════════════════════════════════════════════════════════
  const FORMS = {
    // ─────────────────────────────────────────────────────────
    // IT-1 — DECLARACIÓN MENSUAL DE ITBIS
    // ─────────────────────────────────────────────────────────
    it1: {
      title: 'Formulario IT-1',
      subtitle: 'Declaración Mensual de ITBIS',
      deadline: 'Plazo: día 20 del mes siguiente',
      icon: '📊',
      sections: [
        {
          name: 'I. Operaciones del Período',
          fields: [
            { id: 'it1-vt-18', label: 'Ventas/Servicios Gravados 18%', type: 'money' },
            { id: 'it1-vt-16', label: 'Ventas Gravadas 16% (productos especiales)', type: 'money' },
            { id: 'it1-exp', label: 'Exportaciones (tasa 0%)', type: 'money' },
            { id: 'it1-exentas', label: 'Operaciones Exentas', type: 'money' },
          ],
        },
        {
          name: 'II. ITBIS Facturado (Débito Fiscal)',
          fields: [
            { id: 'it1-itbis-18', label: 'ITBIS Facturado 18%', type: 'money', readonly: true, formula: () => num('it1-vt-18') * 0.18 },
            { id: 'it1-itbis-16', label: 'ITBIS Facturado 16%', type: 'money', readonly: true, formula: () => num('it1-vt-16') * 0.16 },
            { id: 'it1-total-debito', label: 'Total ITBIS Facturado', type: 'money', readonly: true, highlight: true, formula: () => num('it1-itbis-18') + num('it1-itbis-16') },
          ],
        },
        {
          name: 'III. ITBIS Adelantado (Crédito Fiscal)',
          fields: [
            { id: 'it1-compras', label: 'Compras Locales (sin ITBIS)', type: 'money' },
            { id: 'it1-itbis-pagado', label: 'ITBIS Pagado en Compras', type: 'money' },
            { id: 'it1-itbis-importacion', label: 'ITBIS Pagado en Aduana (Importaciones)', type: 'money' },
            { id: 'it1-retenciones', label: 'ITBIS Retenido por el Estado / Terceros', type: 'money' },
            { id: 'it1-total-credito', label: 'Total ITBIS Crédito', type: 'money', readonly: true, highlight: true, formula: () => num('it1-itbis-pagado') + num('it1-itbis-importacion') + num('it1-retenciones') },
          ],
        },
        {
          name: 'IV. Liquidación',
          fields: [
            { id: 'it1-saldo-favor-anterior', label: 'Saldo a Favor del Período Anterior', type: 'money' },
            { id: 'it1-resultado', label: 'ITBIS A PAGAR (o Saldo a Favor)', type: 'result', formula: () => num('it1-total-debito') - num('it1-total-credito') - num('it1-saldo-favor-anterior') },
          ],
        },
      ],
      summary: () => {
        const r = num('it1-total-debito') - num('it1-total-credito') - num('it1-saldo-favor-anterior');
        if (r > 0) return { label: 'Total a Pagar este Mes', value: fmtRD(r), type: 'pay' };
        if (r < 0) return { label: 'Saldo a Favor (próximo mes)', value: fmtRD(Math.abs(r)), type: 'credit' };
        return { label: 'Sin saldo a pagar ni a favor', value: fmtRD(0), type: 'neutral' };
      },
    },

    // ─────────────────────────────────────────────────────────
    // IR-1 — ISR ANUAL PERSONAS FÍSICAS
    // ─────────────────────────────────────────────────────────
    ir1: {
      title: 'Formulario IR-1',
      subtitle: 'ISR Anual — Personas Físicas',
      deadline: 'Plazo: 31 de marzo del año siguiente',
      icon: '👤',
      sections: [
        {
          name: 'I. Ingresos del Año',
          fields: [
            { id: 'ir1-salarios', label: 'Salarios y Remuneraciones', type: 'money' },
            { id: 'ir1-honorarios', label: 'Honorarios Profesionales', type: 'money' },
            { id: 'ir1-alquileres', label: 'Alquileres Recibidos', type: 'money' },
            { id: 'ir1-comisiones', label: 'Comisiones', type: 'money' },
            { id: 'ir1-otros', label: 'Otros Ingresos Gravables', type: 'money' },
            { id: 'ir1-ingresos-totales', label: 'Total Ingresos Brutos', type: 'money', readonly: true, highlight: true, formula: () => num('ir1-salarios') + num('ir1-honorarios') + num('ir1-alquileres') + num('ir1-comisiones') + num('ir1-otros') },
          ],
        },
        {
          name: 'II. Deducciones Permitidas',
          fields: [
            { id: 'ir1-aportes-sdss', label: 'Aportes Obligatorios SDSS (AFP + ARS)', type: 'money' },
            { id: 'ir1-educacion', label: 'Gastos Educación (Ley 179-09, máx 10% renta)', type: 'money' },
            { id: 'ir1-deducciones-totales', label: 'Total Deducciones', type: 'money', readonly: true, formula: () => num('ir1-aportes-sdss') + num('ir1-educacion') },
          ],
        },
        {
          name: 'III. Renta Neta Gravable',
          fields: [
            { id: 'ir1-renta-neta', label: 'Renta Neta Gravable Anual', type: 'money', readonly: true, highlight: true, formula: () => Math.max(0, num('ir1-ingresos-totales') - num('ir1-deducciones-totales')) },
          ],
        },
        {
          name: 'IV. Cálculo del ISR (Escala Progresiva)',
          fields: [
            { id: 'ir1-isr-bruto', label: 'ISR según Escala Progresiva', type: 'money', readonly: true, formula: () => calcIR1(num('ir1-renta-neta')) },
            { id: 'ir1-retenciones-sufridas', label: 'Retenciones Sufridas durante el Año', type: 'money' },
            { id: 'ir1-anticipos', label: 'Anticipos Pagados', type: 'money' },
            { id: 'ir1-resultado', label: 'ISR A PAGAR (o Saldo a Favor)', type: 'result', formula: () => num('ir1-isr-bruto') - num('ir1-retenciones-sufridas') - num('ir1-anticipos') },
          ],
        },
      ],
      summary: () => {
        const r = num('ir1-isr-bruto') - num('ir1-retenciones-sufridas') - num('ir1-anticipos');
        if (r > 0) return { label: 'ISR a Pagar (antes del 31 de marzo)', value: fmtRD(r), type: 'pay' };
        if (r < 0) return { label: 'Saldo a Favor (solicitar reembolso)', value: fmtRD(Math.abs(r)), type: 'credit' };
        return { label: 'Sin ISR a pagar', value: fmtRD(0), type: 'neutral' };
      },
    },

    // ─────────────────────────────────────────────────────────
    // IR-2 — ISR ANUAL PERSONAS JURÍDICAS
    // ─────────────────────────────────────────────────────────
    ir2: {
      title: 'Formulario IR-2',
      subtitle: 'ISR Anual — Personas Jurídicas',
      deadline: 'Plazo: 120 días posteriores al cierre fiscal',
      icon: '🏢',
      sections: [
        {
          name: 'I. Ingresos',
          fields: [
            { id: 'ir2-ingresos-brutos', label: 'Ingresos Brutos Operacionales', type: 'money' },
            { id: 'ir2-ingresos-financieros', label: 'Ingresos Financieros', type: 'money' },
            { id: 'ir2-otros-ingresos', label: 'Otros Ingresos', type: 'money' },
            { id: 'ir2-total-ingresos', label: 'Total Ingresos', type: 'money', readonly: true, highlight: true, formula: () => num('ir2-ingresos-brutos') + num('ir2-ingresos-financieros') + num('ir2-otros-ingresos') },
          ],
        },
        {
          name: 'II. Costos y Gastos Deducibles',
          fields: [
            { id: 'ir2-costo-ventas', label: 'Costo de Ventas / Servicios', type: 'money' },
            { id: 'ir2-gastos-personal', label: 'Gastos de Personal', type: 'money' },
            { id: 'ir2-gastos-operacion', label: 'Gastos Operacionales', type: 'money' },
            { id: 'ir2-depreciacion', label: 'Depreciación y Amortización', type: 'money' },
            { id: 'ir2-gastos-financieros', label: 'Gastos Financieros', type: 'money' },
            { id: 'ir2-otros-gastos', label: 'Otros Gastos Deducibles', type: 'money' },
            { id: 'ir2-total-gastos', label: 'Total Costos y Gastos', type: 'money', readonly: true, highlight: true, formula: () => num('ir2-costo-ventas') + num('ir2-gastos-personal') + num('ir2-gastos-operacion') + num('ir2-depreciacion') + num('ir2-gastos-financieros') + num('ir2-otros-gastos') },
          ],
        },
        {
          name: 'III. Renta Neta y ISR',
          fields: [
            { id: 'ir2-renta-neta', label: 'Renta Neta Imponible', type: 'money', readonly: true, formula: () => Math.max(0, num('ir2-total-ingresos') - num('ir2-total-gastos')) },
            { id: 'ir2-isr', label: 'ISR (27% sobre Renta Neta)', type: 'money', readonly: true, highlight: true, formula: () => num('ir2-renta-neta') * 0.27 },
          ],
        },
        {
          name: 'IV. Impuesto a los Activos (mínimo alternativo)',
          fields: [
            { id: 'ir2-activos', label: 'Total Activos Imponibles', type: 'money' },
            { id: 'ir2-isa', label: 'Impuesto a los Activos (1%)', type: 'money', readonly: true, formula: () => num('ir2-activos') * 0.01 },
            { id: 'ir2-impuesto-mayor', label: 'Mayor entre ISR e ISA', type: 'money', readonly: true, formula: () => Math.max(num('ir2-isr'), num('ir2-isa')) },
          ],
        },
        {
          name: 'V. Liquidación',
          fields: [
            { id: 'ir2-anticipos-pagados', label: 'Anticipos Mensuales Pagados', type: 'money' },
            { id: 'ir2-retenciones', label: 'Retenciones Sufridas', type: 'money' },
            { id: 'ir2-saldo-anterior', label: 'Saldo a Favor del Año Anterior', type: 'money' },
            { id: 'ir2-resultado', label: 'ISR A PAGAR (o Saldo a Favor)', type: 'result', formula: () => num('ir2-impuesto-mayor') - num('ir2-anticipos-pagados') - num('ir2-retenciones') - num('ir2-saldo-anterior') },
          ],
        },
      ],
      summary: () => {
        const r = num('ir2-impuesto-mayor') - num('ir2-anticipos-pagados') - num('ir2-retenciones') - num('ir2-saldo-anterior');
        if (r > 0) return { label: 'ISR a Pagar', value: fmtRD(r), type: 'pay' };
        if (r < 0) return { label: 'Saldo a Favor', value: fmtRD(Math.abs(r)), type: 'credit' };
        return { label: 'Sin ISR a pagar', value: fmtRD(0), type: 'neutral' };
      },
    },

    // ─────────────────────────────────────────────────────────
    // IR-17 — RETENCIONES Y RETRIBUCIONES COMPLEMENTARIAS
    // ─────────────────────────────────────────────────────────
    ir17: {
      title: 'Formulario IR-17',
      subtitle: 'Otras Retenciones y Retribuciones Complementarias',
      deadline: 'Plazo: día 10 del mes siguiente',
      icon: '💼',
      sections: [
        {
          name: 'I. Retenciones por Concepto',
          fields: [
            { id: 'ir17-alquileres', label: 'Alquileres (10%)', type: 'money', sub: 'Base imponible (sin ITBIS)' },
            { id: 'ir17-r-alquileres', label: 'Retención Alquileres', type: 'money', readonly: true, formula: () => num('ir17-alquileres') * 0.10 },

            { id: 'ir17-honorarios', label: 'Honorarios PF (10%)', type: 'money', sub: 'Servicios profesionales independientes' },
            { id: 'ir17-r-honorarios', label: 'Retención Honorarios', type: 'money', readonly: true, formula: () => num('ir17-honorarios') * 0.10 },

            { id: 'ir17-dividendos', label: 'Dividendos pagados (10%)', type: 'money' },
            { id: 'ir17-r-dividendos', label: 'Retención Dividendos', type: 'money', readonly: true, formula: () => num('ir17-dividendos') * 0.10 },

            { id: 'ir17-intereses', label: 'Intereses a PF Residentes (10%)', type: 'money' },
            { id: 'ir17-r-intereses', label: 'Retención Intereses', type: 'money', readonly: true, formula: () => num('ir17-intereses') * 0.10 },

            { id: 'ir17-estado', label: 'Pagos a Proveedores del Estado (5%)', type: 'money' },
            { id: 'ir17-r-estado', label: 'Retención Estado', type: 'money', readonly: true, formula: () => num('ir17-estado') * 0.05 },

            { id: 'ir17-exterior', label: 'Pagos al Exterior (27%)', type: 'money', sub: 'Servicios y asistencia técnica no residentes' },
            { id: 'ir17-r-exterior', label: 'Retención Exterior', type: 'money', readonly: true, formula: () => num('ir17-exterior') * 0.27 },

            { id: 'ir17-premios', label: 'Premios Loterías/Juegos (25%)', type: 'money' },
            { id: 'ir17-r-premios', label: 'Retención Premios', type: 'money', readonly: true, formula: () => num('ir17-premios') * 0.25 },
          ],
        },
        {
          name: 'II. Retribuciones Complementarias (IRC)',
          fields: [
            { id: 'ir17-rc-vivienda', label: 'Vivienda asignada al empleado', type: 'money' },
            { id: 'ir17-rc-vehiculo', label: 'Vehículos (base proporcional)', type: 'money' },
            { id: 'ir17-rc-educacion', label: 'Educación pagada al empleado/familia', type: 'money' },
            { id: 'ir17-rc-clubes', label: 'Membresías clubes/gimnasios', type: 'money' },
            { id: 'ir17-rc-otros', label: 'Otros Beneficios Personales', type: 'money' },
            { id: 'ir17-rc-base', label: 'Total Base Retribuciones', type: 'money', readonly: true, formula: () => num('ir17-rc-vivienda') + num('ir17-rc-vehiculo') + num('ir17-rc-educacion') + num('ir17-rc-clubes') + num('ir17-rc-otros') },
            { id: 'ir17-rc-impuesto', label: 'IRC (27% sobre base)', type: 'money', readonly: true, highlight: true, formula: () => num('ir17-rc-base') * 0.27 },
          ],
        },
        {
          name: 'III. Total a Pagar',
          fields: [
            { id: 'ir17-total-retenciones', label: 'Total Retenciones del Mes', type: 'money', readonly: true, formula: () => num('ir17-r-alquileres') + num('ir17-r-honorarios') + num('ir17-r-dividendos') + num('ir17-r-intereses') + num('ir17-r-estado') + num('ir17-r-exterior') + num('ir17-r-premios') },
            { id: 'ir17-resultado', label: 'TOTAL A PAGAR (Retenciones + IRC)', type: 'result', formula: () => num('ir17-total-retenciones') + num('ir17-rc-impuesto') },
          ],
        },
      ],
      summary: () => {
        const r = num('ir17-total-retenciones') + num('ir17-rc-impuesto');
        return { label: 'Total a Pagar', value: fmtRD(r), type: r > 0 ? 'pay' : 'neutral' };
      },
    },

    // ─────────────────────────────────────────────────────────
    // RST — RÉGIMEN SIMPLIFICADO DE TRIBUTACIÓN (RC-02)
    // ─────────────────────────────────────────────────────────
    rst: {
      title: 'Formulario RC-02',
      subtitle: 'Régimen Simplificado de Tributación (RST)',
      deadline: 'Plazo: cuotas según calendario DGII',
      icon: '📋',
      sections: [
        {
          name: 'I. Información General',
          fields: [
            { id: 'rst-modalidad', label: 'Modalidad RST', type: 'select', options: [
              { value: 'comercial', label: 'Comercial / Industrial (2%)' },
              { value: 'servicios', label: 'Servicios (5%)' },
              { value: 'agropecuario', label: 'Agropecuario (3%)' },
            ]},
            { id: 'rst-ingresos-anuales', label: 'Ingresos Brutos Anuales Estimados', type: 'money', sub: 'Tope: RD$8,771,184.30 (servicios) o RD$40,369,844.48 (compras)' },
          ],
        },
        {
          name: 'II. Cálculo de la Cuota',
          fields: [
            { id: 'rst-tasa', label: 'Tasa Aplicable', type: 'money', readonly: true, formula: () => {
              const m = document.getElementById('rst-modalidad')?.value;
              if (m === 'servicios') return 0.05;
              if (m === 'agropecuario') return 0.03;
              return 0.02;
            }},
            { id: 'rst-cuota-anual', label: 'Cuota Anual a Pagar', type: 'money', readonly: true, highlight: true, formula: () => num('rst-ingresos-anuales') * num('rst-tasa') },
            { id: 'rst-resultado', label: 'Cuota Mensual Equivalente', type: 'result', formula: () => num('rst-cuota-anual') / 12 },
          ],
        },
      ],
      summary: () => {
        const a = num('rst-cuota-anual');
        const m = a / 12;
        return { label: `Cuota Anual ${fmtRD(a)} · Mensual ${fmtRD(m)}`, value: fmtRD(a), type: 'pay' };
      },
    },
  };

  // ═══════════════════════════════════════════════════════════
  //                    RENDERER DEL FORMULARIO
  // ═══════════════════════════════════════════════════════════
  function renderForm(formKey) {
    const form = FORMS[formKey];
    if (!form) return '';

    const sectionsHtml = form.sections.map(section => {
      const fieldsHtml = section.fields.map(f => {
        if (f.type === 'select') {
          const opts = f.options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
          return `
            <div class="ff-field">
              <label for="${f.id}">${f.label}</label>
              <select id="${f.id}" class="ff-input ff-select" data-formkey="${formKey}">${opts}</select>
              ${f.sub ? `<div class="ff-sub">${f.sub}</div>` : ''}
            </div>`;
        }
        if (f.type === 'result') {
          return `
            <div class="ff-field ff-result-row">
              <label for="${f.id}">${f.label}</label>
              <div class="ff-result-value" id="${f.id}-display">${fmtRD(0)}</div>
              <input type="hidden" id="${f.id}" value="0">
            </div>`;
        }
        const cls = ['ff-input'];
        if (f.readonly) cls.push('ff-readonly');
        if (f.highlight) cls.push('ff-highlight');
        return `
          <div class="ff-field">
            <label for="${f.id}">${f.label}</label>
            <div class="ff-input-wrap">
              <span class="ff-prefix">RD$</span>
              <input type="number" step="0.01" min="0" id="${f.id}" class="${cls.join(' ')}" data-formkey="${formKey}" placeholder="0.00" ${f.readonly ? 'readonly' : ''}>
            </div>
            ${f.sub ? `<div class="ff-sub">${f.sub}</div>` : ''}
          </div>`;
      }).join('');
      return `<div class="ff-section"><div class="ff-section-title">${section.name}</div>${fieldsHtml}</div>`;
    }).join('');

    return `
      <div class="ff-header">
        <button class="sc-close" onclick="window.app.closeSmartCard()" aria-label="Cerrar">✕</button>
        <div class="ff-header-icon">${form.icon}</div>
        <div class="ff-header-text">
          <h3>${form.title}</h3>
          <div class="ff-subtitle">${form.subtitle}</div>
          <div class="ff-deadline">⏱ ${form.deadline}</div>
        </div>
      </div>

      <div class="ff-tabs">
        <button class="ff-tab active" data-tab="manual" onclick="window.forms.switchTab(this, 'manual', '${formKey}')">✍ Manual</button>
        <button class="ff-tab" data-tab="documento" onclick="window.forms.switchTab(this, 'documento', '${formKey}')">📎 Adjuntar</button>
        <button class="ff-tab" data-tab="chat" onclick="window.forms.switchTab(this, 'chat', '${formKey}')">💬 Desde el chat</button>
      </div>

      <!-- Panel: ADJUNTAR DOCUMENTO -->
      <div class="ff-tab-panel" id="ff-panel-documento" style="display:none;">
        <div class="ff-extract-zone">
          <div class="ff-extract-icon">📄</div>
          <div class="ff-extract-text">
            <strong>Sube un documento para llenar el formulario automáticamente</strong>
            <p>Estados de cuenta, libros de ventas, facturas, balances. Acepta PDF, Excel, JPG.</p>
          </div>
          <input type="file" id="ff-extract-file" accept=".pdf,.xlsx,.xls,.csv,image/*" style="display:none;" onchange="window.forms.handleDocExtract(event, '${formKey}')">
          <button class="ff-extract-btn" onclick="document.getElementById('ff-extract-file').click()">Seleccionar archivo</button>
        </div>
        <div id="ff-extract-status" class="ff-extract-status" style="display:none;"></div>
      </div>

      <!-- Panel: DESDE EL CHAT -->
      <div class="ff-tab-panel" id="ff-panel-chat" style="display:none;">
        <div class="ff-chat-extract">
          <div class="ff-chat-icon">💬</div>
          <p>Si has hablado con el bot sobre tus números (ventas, gastos, ingresos), puedo extraer los datos relevantes y llenar el formulario automáticamente.</p>
          <button class="ff-extract-btn" onclick="window.forms.extractFromChat('${formKey}')">Llenar con la conversación reciente</button>
          <div id="ff-chat-extract-status" class="ff-extract-status" style="display:none; margin-top: 1rem;"></div>
        </div>
      </div>

      <!-- Panel: MANUAL (campos del formulario) -->
      <div class="ff-tab-panel" id="ff-panel-manual">
        ${sectionsHtml}

        <div class="ff-summary" id="ff-summary">
          <div class="ff-summary-label">— Sin datos aún —</div>
          <div class="ff-summary-value">RD$ 0.00</div>
        </div>

        <div class="ff-actions">
          <button class="ff-btn-secondary" onclick="window.forms.clearForm('${formKey}')">Limpiar</button>
          <button class="ff-btn-primary" onclick="window.forms.exportForm('${formKey}')">📥 Exportar resumen</button>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════
  //                    LÓGICA DE FORMULARIOS
  // ═══════════════════════════════════════════════════════════
  function recalc(formKey) {
    const form = FORMS[formKey];
    if (!form) return;

    // Recalcular todos los campos con fórmula (en orden, ya que dependen entre sí)
    for (const section of form.sections) {
      for (const f of section.fields) {
        if (typeof f.formula === 'function') {
          const v = +f.formula().toFixed(2);
          setVal(f.id, v);
          if (f.type === 'result') {
            const display = document.getElementById(f.id + '-display');
            if (display) display.textContent = fmtRD(v);
          }
        }
      }
    }

    // Actualizar el summary
    const sum = form.summary();
    const summaryEl = document.getElementById('ff-summary');
    if (summaryEl) {
      summaryEl.className = 'ff-summary ff-summary-' + sum.type;
      summaryEl.innerHTML = `
        <div class="ff-summary-label">${sum.label}</div>
        <div class="ff-summary-value">${sum.value}</div>
      `;
    }
  }

  function attachListeners(formKey) {
    document.querySelectorAll(`[data-formkey="${formKey}"]`).forEach(el => {
      el.addEventListener('input', () => recalc(formKey));
      el.addEventListener('change', () => recalc(formKey));
    });
    // Cálculo inicial
    setTimeout(() => recalc(formKey), 50);
  }

  function switchTab(btn, tab, formKey) {
    document.querySelectorAll('.ff-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    ['manual', 'documento', 'chat'].forEach(t => {
      const panel = document.getElementById('ff-panel-' + t);
      if (panel) panel.style.display = (t === tab) ? 'block' : 'none';
    });
  }

  function clearForm(formKey) {
    const form = FORMS[formKey];
    if (!form) return;
    for (const section of form.sections) {
      for (const f of section.fields) {
        if (f.type === 'select') continue;
        setVal(f.id, '');
      }
    }
    recalc(formKey);
    window.app.showToast('Formulario limpiado', 'info', 2000);
  }

  function exportForm(formKey) {
    const form = FORMS[formKey];
    if (!form) return;
    const lines = [];
    lines.push(`==============================================`);
    lines.push(`  ${form.title} — ${form.subtitle}`);
    lines.push(`  Generado por TaxIA — ${new Date().toLocaleDateString('es-DO')}`);
    lines.push(`==============================================`);
    lines.push('');
    for (const section of form.sections) {
      lines.push(`--- ${section.name} ---`);
      for (const f of section.fields) {
        const v = num(f.id);
        if (v !== 0 || f.readonly || f.type === 'result') {
          lines.push(`${f.label.padEnd(50, '.')} ${fmtRD(v)}`);
        }
      }
      lines.push('');
    }
    const sum = form.summary();
    lines.push(`==============================================`);
    lines.push(`RESULTADO: ${sum.label} = ${sum.value}`);
    lines.push(`==============================================`);
    lines.push('');
    lines.push('Esta es una estimación generada por TaxIA basada en los datos ingresados.');
    lines.push('No sustituye la declaración oficial en la Oficina Virtual de la DGII.');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window.app.showToast('Resumen descargado', 'success', 2500);
  }

  // ═══════════════════════════════════════════════════════════
  //                    EXTRACCIÓN POR DOCUMENTO
  // ═══════════════════════════════════════════════════════════
  async function handleDocExtract(event, formKey) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const status = document.getElementById('ff-extract-status');
    status.style.display = 'block';
    status.className = 'ff-extract-status loading';
    status.innerHTML = `<div class="ff-spinner"></div> Subiendo y analizando "${file.name}"...`;

    try {
      // 1) Subir archivo a /api/upload (Dify file upload)
      const fd = new FormData();
      fd.append('file', file);
      fd.append('user', 'taxia-form-' + (window.auth?.getCurrentUser()?.id?.slice(0, 8) || 'anon'));
      const upRes = await fetch('/api/upload', { method: 'POST', body: fd });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error || 'Error al subir el archivo');

      // 2) Llamar a /api/extract para obtener campos estructurados
      status.innerHTML = `<div class="ff-spinner"></div> Extrayendo datos para el ${FORMS[formKey].title}...`;
      const fields = collectFieldList(formKey);
      const exRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formKey,
          formTitle: FORMS[formKey].title,
          fileId: upData.id,
          fields,
          user: 'taxia-form-' + (window.auth?.getCurrentUser()?.id?.slice(0, 8) || 'anon'),
        }),
      });
      const exData = await exRes.json();
      if (!exRes.ok) throw new Error(exData.error || 'Error al extraer datos');

      // 3) Aplicar valores extraídos al formulario
      const values = exData.values || {};
      const applied = applyExtractedValues(formKey, values);

      status.className = 'ff-extract-status success';
      status.innerHTML = `✓ Se llenaron ${applied} campos automáticamente. Revisa los valores en la pestaña Manual y ajusta si es necesario.`;

      // Cambiar a la pestaña Manual para que vea el resultado
      const manualTab = document.querySelector('.ff-tab[data-tab="manual"]');
      if (manualTab) manualTab.click();

    } catch (err) {
      status.className = 'ff-extract-status error';
      status.innerHTML = `❌ ${err.message || 'Error al procesar el documento'}`;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //                    EXTRACCIÓN POR CHAT
  // ═══════════════════════════════════════════════════════════
  async function extractFromChat(formKey) {
    const status = document.getElementById('ff-chat-extract-status');
    status.style.display = 'block';
    status.className = 'ff-extract-status loading';
    status.innerHTML = `<div class="ff-spinner"></div> Analizando conversación reciente...`;

    // Tomar los últimos mensajes del chat
    const container = document.getElementById('ia-messages');
    if (!container) {
      status.className = 'ff-extract-status error';
      status.innerHTML = '❌ No hay conversación reciente.';
      return;
    }
    const msgs = Array.from(container.querySelectorAll('.chat-message')).slice(-10);
    if (msgs.length < 2) {
      status.className = 'ff-extract-status error';
      status.innerHTML = '❌ Habla con el bot primero sobre tus números (ventas, gastos, ingresos) y luego usa esta opción.';
      return;
    }

    const conversation = msgs.map(m => {
      const role = m.classList.contains('msg-user') ? 'Usuario' : 'TaxIA';
      const txt = m.querySelector('.msg-content')?.innerText?.trim() || '';
      return `${role}: ${txt}`;
    }).join('\n');

    try {
      const fields = collectFieldList(formKey);
      const exRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formKey,
          formTitle: FORMS[formKey].title,
          conversation,
          fields,
          user: 'taxia-form-' + (window.auth?.getCurrentUser()?.id?.slice(0, 8) || 'anon'),
        }),
      });
      const exData = await exRes.json();
      if (!exRes.ok) throw new Error(exData.error || 'Error al extraer datos del chat');

      const values = exData.values || {};
      const applied = applyExtractedValues(formKey, values);

      status.className = 'ff-extract-status success';
      status.innerHTML = `✓ Llené ${applied} campos a partir de tu conversación. Revisa y ajusta si es necesario.`;

      const manualTab = document.querySelector('.ff-tab[data-tab="manual"]');
      if (manualTab) manualTab.click();

    } catch (err) {
      status.className = 'ff-extract-status error';
      status.innerHTML = `❌ ${err.message || 'No se pudieron extraer datos'}`;
    }
  }

  // Lista de campos editables (sin readonly ni results) para mandar al backend
  function collectFieldList(formKey) {
    const form = FORMS[formKey];
    if (!form) return [];
    const out = [];
    for (const s of form.sections) {
      for (const f of s.fields) {
        if (f.readonly || f.type === 'result' || f.type === 'select') continue;
        out.push({ id: f.id, label: f.label });
      }
    }
    return out;
  }

  // Aplica los valores que devolvió el backend
  function applyExtractedValues(formKey, values) {
    let count = 0;
    for (const [id, v] of Object.entries(values)) {
      const el = document.getElementById(id);
      if (el && !el.readOnly) {
        el.value = (typeof v === 'number') ? v : parseFloat(String(v).replace(/[^\d.-]/g, '')) || 0;
        count++;
      }
    }
    recalc(formKey);
    return count;
  }

  // ═══════════════════════════════════════════════════════════
  //                    API PÚBLICA
  // ═══════════════════════════════════════════════════════════
  window.forms = {
    open(formKey) {
      const panel = document.getElementById('smart-card-panel');
      const content = document.getElementById('sc-content');
      if (!panel || !content) return;
      content.innerHTML = renderForm(formKey);
      panel.classList.add('open');
      attachListeners(formKey);
    },
    switchTab,
    clearForm,
    exportForm,
    handleDocExtract,
    extractFromChat,
    FORMS,
  };
})();
