// js/forms609.js
// Generador del Formato 609 — Pagos al exterior (Norma 06-2018 DGII).
// Para empresas que pagan a beneficiarios no residentes — retención 27% ISR (Art. 305 CT).
// Exclusivo del plan Max.

(function () {
  'use strict';

  let _rows = [];
  let _rnc = '';
  let _periodo = '';

  // Tipos de servicio / concepto del pago al exterior
  const TIPOS_SERVICIO = [
    { code: '01', label: '01 — Servicios técnicos y profesionales' },
    { code: '02', label: '02 — Regalías' },
    { code: '03', label: '03 — Intereses' },
    { code: '04', label: '04 — Dividendos' },
    { code: '05', label: '05 — Asistencia técnica' },
    { code: '06', label: '06 — Servicios digitales' },
    { code: '07', label: '07 — Arrendamiento' },
    { code: '08', label: '08 — Servicios de comunicación' },
    { code: '09', label: '09 — Reaseguros' },
    { code: '10', label: '10 — Servicios marítimos / aéreos' },
    { code: '11', label: '11 — Otros pagos al exterior' },
  ];

  function fmtRD(n) {
    return 'RD$ ' + (Number(n) || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function sanitizeText(s) { return String(s || '').slice(0, 100); }
  function fmtDateDgii(s) { return s ? s.replace(/-/g, '') : ''; }

  function emptyRow() {
    return {
      nombreBeneficiario: '',
      tipoServicio: '01',
      paisDestino: '',         // código ISO 2 letras (ej: US, ES, CA)
      fechaPago: '',
      montoFact: 0,            // en pesos dominicanos
      isrRet: 0,
      itbisRet: 0,
    };
  }

  function computeTotals() {
    return _rows.reduce((acc, r) => ({
      montoFact: acc.montoFact + (Number(r.montoFact) || 0),
      isrRet: acc.isrRet + (Number(r.isrRet) || 0),
      itbisRet: acc.itbisRet + (Number(r.itbisRet) || 0),
    }), { montoFact: 0, isrRet: 0, itbisRet: 0 });
  }

  function render() {
    const totals = computeTotals();
    const html = `
      <div class="ff-header">
        <div>
          <div class="ff-title">📑 Formato 609 — Pagos al Exterior</div>
          <div class="ff-subtitle">Pagos a no residentes · Norma 06-2018 · Art. 305 CT</div>
          <div class="ff-deadline">Se sube a Oficina Virtual DGII → Reportes → Envío de Datos</div>
        </div>
        <button type="button" class="sc-close" onclick="window.app.closeSmartCard()" aria-label="Cerrar">✕</button>
      </div>

      <div class="f606-header-form">
        <div class="ff-field">
          <label for="f609-rnc">RNC del contribuyente</label>
          <input type="text" id="f609-rnc" class="ff-input" placeholder="123456789" maxlength="11" value="${_rnc}" oninput="window.forms609.setHeader('rnc', this.value)">
        </div>
        <div class="ff-field">
          <label for="f609-periodo">Período (AAAAMM)</label>
          <input type="text" id="f609-periodo" class="ff-input" placeholder="202504" maxlength="6" value="${_periodo}" oninput="window.forms609.setHeader('periodo', this.value)">
          <div class="ff-sub">Ejemplo: 202504 = abril 2025</div>
        </div>
      </div>

      <div class="f606-toolbar">
        <button type="button" class="ff-btn-secondary" onclick="window.forms609.addRow()">+ Agregar pago</button>
        <button type="button" class="ff-btn-secondary" onclick="document.getElementById('f609-csv-input').click()">📤 Cargar CSV</button>
        <input type="file" id="f609-csv-input" accept=".csv,.txt" style="display:none;" onchange="window.forms609.loadCsv(event)">
        <button type="button" class="ff-btn-secondary" onclick="window.forms609.clearAll()">🗑 Limpiar todo</button>
      </div>

      <div class="f606-table-wrap">
        <table class="f606-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre / Razón social beneficiario</th>
              <th>Tipo servicio</th>
              <th>País (ISO)</th>
              <th>Fecha pago</th>
              <th>Monto facturado</th>
              <th>ISR retenido</th>
              <th>ITBIS retenido</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="f609-tbody">
            ${_rows.map((r, i) => renderRow(r, i)).join('') || `
              <tr class="f606-empty"><td colspan="9">Sin pagos al exterior. Click <strong>+ Agregar pago</strong> para empezar.</td></tr>
            `}
          </tbody>
        </table>
      </div>

      <div class="f606-totals">
        <div class="f606-total-block">
          <div class="f606-total-label">Total pagos</div>
          <div class="f606-total-value">${fmtRD(totals.montoFact)}</div>
        </div>
        <div class="f606-total-block">
          <div class="f606-total-label">ISR retenido (27%)</div>
          <div class="f606-total-value">${fmtRD(totals.isrRet)}</div>
        </div>
        <div class="f606-total-block">
          <div class="f606-total-label">ITBIS retenido</div>
          <div class="f606-total-value">${fmtRD(totals.itbisRet)}</div>
        </div>
        <div class="f606-total-block highlight">
          <div class="f606-total-label">Registros</div>
          <div class="f606-total-value">${_rows.length}</div>
        </div>
      </div>

      <div class="ff-actions">
        <button type="button" class="ff-btn-secondary" onclick="window.forms609.downloadTemplate()">📋 Plantilla CSV</button>
        <button type="button" class="ff-btn-primary" onclick="window.forms609.generate()">📥 Descargar archivo 609 para DGII</button>
      </div>

      <div class="f606-info">
        <strong>⚠ Recordatorio:</strong> Los pagos al exterior tienen retención del <strong>27% ISR</strong> (Art. 305 CT),
        salvo aplique CDI (España, Canadá) que reducen la tasa. Esa retención debe declararse en IR-17.
      </div>
    `;
    const cont = document.getElementById('sc-content');
    if (cont) cont.innerHTML = html;
  }

  function renderRow(r, i) {
    return `
      <tr data-row="${i}">
        <td>${String(i + 1).padStart(3, '0')}</td>
        <td><input type="text" value="${r.nombreBeneficiario}" placeholder="Ej: Microsoft Corporation" oninput="window.forms609.setCell(${i},'nombreBeneficiario',this.value)"></td>
        <td>
          <select onchange="window.forms609.setCell(${i},'tipoServicio',this.value)">
            ${TIPOS_SERVICIO.map(t => `<option value="${t.code}" ${t.code === r.tipoServicio ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </td>
        <td><input type="text" maxlength="2" value="${r.paisDestino}" placeholder="US" oninput="window.forms609.setCell(${i},'paisDestino',this.value)"></td>
        <td><input type="date" value="${r.fechaPago}" oninput="window.forms609.setCell(${i},'fechaPago',this.value)"></td>
        <td><input type="number" step="0.01" value="${r.montoFact || ''}" oninput="window.forms609.setCell(${i},'montoFact',this.value)"></td>
        <td><input type="number" step="0.01" value="${r.isrRet || ''}" oninput="window.forms609.setCell(${i},'isrRet',this.value)"></td>
        <td><input type="number" step="0.01" value="${r.itbisRet || ''}" oninput="window.forms609.setCell(${i},'itbisRet',this.value)"></td>
        <td><button type="button" class="f606-del" onclick="window.forms609.deleteRow(${i})">🗑</button></td>
      </tr>
    `;
  }

  function refreshTotalsOnly() {
    const totals = computeTotals();
    const blocks = document.querySelectorAll('.f606-total-value');
    if (blocks.length >= 4) {
      blocks[0].textContent = fmtRD(totals.montoFact);
      blocks[1].textContent = fmtRD(totals.isrRet);
      blocks[2].textContent = fmtRD(totals.itbisRet);
      blocks[3].textContent = _rows.length;
    }
  }

  function setHeader(field, value) {
    if (field === 'rnc') _rnc = String(value).replace(/\D/g, '');
    if (field === 'periodo') _periodo = String(value).replace(/\D/g, '').slice(0, 6);
  }

  function setCell(index, field, value) {
    if (!_rows[index]) return;
    if (field === 'nombreBeneficiario') _rows[index][field] = sanitizeText(value);
    else if (field === 'paisDestino') _rows[index][field] = String(value || '').toUpperCase().slice(0, 2);
    else if (['montoFact', 'isrRet', 'itbisRet'].includes(field)) {
      _rows[index][field] = parseFloat(value) || 0;
      refreshTotalsOnly();
    } else _rows[index][field] = value;
  }

  function addRow() { _rows.push(emptyRow()); render(); }
  function deleteRow(i) { _rows.splice(i, 1); render(); }
  function clearAll() {
    if (_rows.length === 0) return;
    if (!confirm('¿Eliminar todos los pagos al exterior?')) return;
    _rows = []; render();
  }

  function downloadTemplate() {
    const headers = [
      'Nombre_Beneficiario',
      'Tipo_Servicio(01-11)',
      'Pais(ISO_2_letras)',
      'Fecha_Pago(YYYY-MM-DD)',
      'Monto_Facturado_RD',
      'ISR_Retenido',
      'ITBIS_Retenido',
    ];
    const sample = [
      'Microsoft Corporation,06,US,2025-04-15,100000.00,27000.00,18000.00',
      'Telefonica SA,08,ES,2025-04-20,50000.00,5000.00,9000.00',
    ];
    downloadText(headers.join(',') + '\n' + sample.join('\n'), 'plantilla_609.csv', 'text/csv');
    window.app.showToast('Plantilla CSV descargada', 'success', 2500);
  }

  function loadCsv(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { window.app.showToast('CSV vacío', 'error'); return; }
      const newRows = [];
      lines.slice(1).forEach(line => {
        const c = line.split(',').map(x => x.trim().replace(/^"|"$/g, ''));
        if (c.length < 7) return;
        newRows.push({
          nombreBeneficiario: sanitizeText(c[0]),
          tipoServicio: (c[1] || '01').padStart(2, '0'),
          paisDestino: String(c[2] || '').toUpperCase().slice(0, 2),
          fechaPago: c[3] || '',
          montoFact: parseFloat(c[4]) || 0,
          isrRet: parseFloat(c[5]) || 0,
          itbisRet: parseFloat(c[6]) || 0,
        });
      });
      _rows = _rows.concat(newRows);
      render();
      window.app.showToast(`${newRows.length} pagos cargados`, 'success', 3000);
    };
    reader.readAsText(file);
  }

  function generate() {
    if (!_rnc || _rnc.length < 9) {
      window.app.showToast('Ingresa el RNC del contribuyente', 'error');
      return;
    }
    if (!_periodo || _periodo.length !== 6) {
      window.app.showToast('Ingresa el período AAAAMM', 'error');
      return;
    }
    if (_rows.length === 0) {
      window.app.showToast('Agrega al menos un pago al exterior', 'error');
      return;
    }

    const invalidRows = [];
    _rows.forEach((r, i) => {
      const errs = [];
      if (!r.nombreBeneficiario) errs.push('Nombre');
      if (!r.paisDestino || r.paisDestino.length !== 2) errs.push('País');
      if (!r.fechaPago) errs.push('Fecha');
      if (!r.montoFact || r.montoFact <= 0) errs.push('Monto');
      if (errs.length) invalidRows.push(`Fila ${i + 1}: ${errs.join(', ')}`);
    });
    if (invalidRows.length) {
      window.app.showToast(`Errores: ${invalidRows[0]}`, 'error', 6000);
      return;
    }

    const totals = computeTotals();
    const lines = [];
    // Header 609: 609|RNC|Periodo|CantRegistros|TotalMonto|TotalRetencionISR
    lines.push([
      '609', _rnc, _periodo, _rows.length,
      totals.montoFact.toFixed(2),
      totals.isrRet.toFixed(2),
    ].join('|'));

    _rows.forEach((r, i) => {
      lines.push([
        i + 1,
        r.nombreBeneficiario,
        r.tipoServicio,
        r.paisDestino,
        fmtDateDgii(r.fechaPago),
        (r.montoFact || 0).toFixed(2),
        (r.isrRet || 0).toFixed(2),
        (r.itbisRet || 0).toFixed(2),
      ].join('|'));
    });

    const filename = `DGII_F_609_${_rnc}_${_periodo}.txt`;
    downloadText(lines.join('\n') + '\n', filename, 'text/plain');
    window.app.showToast(`📥 Archivo 609 generado (${_rows.length} registros)`, 'success', 4000);
  }

  function downloadText(content, filename, mime) {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function open() {
    const panel = document.getElementById('smart-card-panel');
    if (!panel) return;
    if (_rows.length === 0) _rows = [emptyRow()];
    if (!_periodo) {
      const now = new Date();
      _periodo = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0');
    }
    render();
    panel.classList.add('open');
  }

  window.forms609 = { open, addRow, deleteRow, clearAll, setHeader, setCell, loadCsv, downloadTemplate, generate };
})();
