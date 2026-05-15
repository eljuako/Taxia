// js/forms608.js
// Generador del Formato 608 — Comprobantes Fiscales Anulados (Norma 06-2018 DGII).
// Más simple que 606/607: solo NCF + fecha + motivo de anulación.
// Exclusivo del plan Max.

(function () {
  'use strict';

  let _rows = [];
  let _rnc = '';
  let _periodo = '';

  // Tipos de anulación oficiales DGII
  const TIPOS_ANULACION = [
    { code: '01', label: '01 — Deterioro de factura pre-impresa' },
    { code: '02', label: '02 — Errores de impresión (pre-impresa)' },
    { code: '03', label: '03 — Impresión defectuosa' },
    { code: '04', label: '04 — Duplicidad de factura' },
    { code: '05', label: '05 — Corrección de la información' },
    { code: '06', label: '06 — Cambio de productos' },
    { code: '07', label: '07 — Devolución de productos' },
    { code: '08', label: '08 — Omisión de productos' },
    { code: '09', label: '09 — Errores en la secuencia de NCF' },
  ];

  function sanitizeId(s) { return String(s || '').replace(/\D/g, ''); }
  function sanitizeNCF(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function fmtDateDgii(s) { return s ? s.replace(/-/g, '') : ''; }

  function emptyRow() {
    return { ncf: '', fechaComp: '', tipoAnulacion: '04' };
  }

  function render() {
    const html = `
      <div class="ff-header">
        <div>
          <div class="ff-title">📑 Formato 608 — NCF Anulados</div>
          <div class="ff-subtitle">Comprobantes fiscales anulados · Norma 06-2018</div>
          <div class="ff-deadline">Se sube a Oficina Virtual DGII → Reportes → Envío de Datos</div>
        </div>
        <button type="button" class="sc-close" onclick="window.app.closeSmartCard()" aria-label="Cerrar">✕</button>
      </div>

      <div class="f606-header-form">
        <div class="ff-field">
          <label for="f608-rnc">RNC del contribuyente</label>
          <input type="text" id="f608-rnc" class="ff-input" placeholder="123456789" maxlength="11" value="${_rnc}" oninput="window.forms608.setHeader('rnc', this.value)">
        </div>
        <div class="ff-field">
          <label for="f608-periodo">Período (AAAAMM)</label>
          <input type="text" id="f608-periodo" class="ff-input" placeholder="202504" maxlength="6" value="${_periodo}" oninput="window.forms608.setHeader('periodo', this.value)">
          <div class="ff-sub">Ejemplo: 202504 = abril 2025</div>
        </div>
      </div>

      <div class="f606-toolbar">
        <button type="button" class="ff-btn-secondary" onclick="window.forms608.addRow()">+ Agregar NCF anulado</button>
        <button type="button" class="ff-btn-secondary" onclick="document.getElementById('f608-csv-input').click()">📤 Cargar Excel/CSV</button>
        <input type="file" id="f608-csv-input" accept=".csv,.txt,.xlsx,.xls" style="display:none;" onchange="window.forms608.loadCsv(event)">
        <button type="button" class="ff-btn-secondary" onclick="window.forms608.clearAll()">🗑 Limpiar todo</button>
      </div>

      <div class="f606-table-wrap">
        <table class="f606-table">
          <thead>
            <tr>
              <th>#</th>
              <th>NCF anulado</th>
              <th>Fecha del comprobante</th>
              <th>Tipo de anulación</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="f608-tbody">
            ${_rows.map((r, i) => renderRow(r, i)).join('') || `
              <tr class="f606-empty"><td colspan="5">Sin NCF anulados. Click <strong>+ Agregar NCF anulado</strong> para empezar.</td></tr>
            `}
          </tbody>
        </table>
      </div>

      <div class="f606-totals">
        <div class="f606-total-block highlight">
          <div class="f606-total-label">NCF anulados</div>
          <div class="f606-total-value">${_rows.length}</div>
        </div>
      </div>

      <div class="ff-actions">
        <button type="button" class="ff-btn-secondary" onclick="window.forms608.downloadTemplate()">📋 Plantilla CSV</button>
        <button type="button" class="ff-btn-primary" onclick="window.forms608.generate()">📥 Descargar archivo 608 para DGII</button>
      </div>

      <div class="f606-info">
        <strong>⚠ Importante:</strong> Si en el período no hubo anulaciones, debes igual subir un archivo 608 vacío
        (solo header) a DGII para cumplir la obligación.
      </div>
    `;
    const cont = document.getElementById('sc-content');
    if (cont) cont.innerHTML = html;
  }

  function renderRow(r, i) {
    return `
      <tr data-row="${i}">
        <td>${String(i + 1).padStart(3, '0')}</td>
        <td><input type="text" value="${r.ncf}" placeholder="B0100000001" oninput="window.forms608.setCell(${i},'ncf',this.value)"></td>
        <td><input type="date" value="${r.fechaComp}" oninput="window.forms608.setCell(${i},'fechaComp',this.value)"></td>
        <td>
          <select onchange="window.forms608.setCell(${i},'tipoAnulacion',this.value)">
            ${TIPOS_ANULACION.map(t => `<option value="${t.code}" ${t.code === r.tipoAnulacion ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </td>
        <td><button type="button" class="f606-del" onclick="window.forms608.deleteRow(${i})">🗑</button></td>
      </tr>
    `;
  }

  function setHeader(field, value) {
    if (field === 'rnc') _rnc = sanitizeId(value);
    if (field === 'periodo') _periodo = String(value).replace(/\D/g, '').slice(0, 6);
  }

  function setCell(index, field, value) {
    if (!_rows[index]) return;
    if (field === 'ncf') _rows[index][field] = sanitizeNCF(value);
    else _rows[index][field] = value;
  }

  function addRow() { _rows.push(emptyRow()); render(); }
  function deleteRow(i) { _rows.splice(i, 1); render(); }
  function clearAll() {
    if (_rows.length === 0) return;
    if (!confirm('¿Eliminar todos los NCF anulados?')) return;
    _rows = []; render();
  }

  function downloadTemplate() {
    const headers = ['NCF', 'Fecha_Comprobante(YYYY-MM-DD)', 'Tipo_Anulacion(01-09)'];
    const sample = [
      'B0100000015,2025-04-10,04',
      'B0100000022,2025-04-18,05',
    ];
    downloadText(headers.join(',') + '\n' + sample.join('\n'), 'plantilla_608.csv', 'text/csv');
    window.app.showToast('Plantilla CSV descargada', 'success', 2500);
  }

  const FIELD_MAP_608 = {
    ncf:           ['ncf', 'comprobante', 'numero comprobante', 'ncf anulado'],
    fechaComp:     ['fecha comprobante', 'fecha emision', 'fecha', 'fecha anulacion'],
    tipoAnulacion: ['tipo anulacion', 'tipo de anulacion', 'motivo', 'razon'],
  };

  async function loadCsv(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !window.formsImport) {
      window.app.showToast('Helper no disponible', 'error');
      return;
    }
    try {
      const result = await window.formsImport.parseFile(file, FIELD_MAP_608);
      const missing = result.missingFields.filter(f => ['ncf', 'fechaComp'].includes(f));
      if (missing.length) {
        window.app.showToast(`Faltan columnas: ${missing.join(', ')}`, 'error', 7000);
        return;
      }
      const newRows = result.mappedRows.map(r => ({
        ncf: sanitizeNCF(r.ncf),
        fechaComp: parseDate(r.fechaComp),
        tipoAnulacion: String(r.tipoAnulacion || '04').padStart(2, '0').slice(0, 2),
      })).filter(r => r.ncf && r.fechaComp);
      const skipped = result.totalRows - newRows.length;
      _rows = _rows.concat(newRows);
      render();
      let msg = `✓ ${newRows.length} NCF cargados`;
      if (skipped > 0) msg += ` (${skipped} omitidos)`;
      window.app.showToast(msg, 'success', 4000);
    } catch (err) {
      window.app.showToast(`Error: ${err.message}`, 'error', 6000);
    }
  }

  function parseDate(input) {
    if (!input) return '';
    const s = String(input).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) { const [, a, b, y] = m; return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`; }
    const t = new Date(s);
    return !isNaN(t.getTime()) ? t.toISOString().slice(0, 10) : '';
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

    const invalidRows = [];
    _rows.forEach((r, i) => {
      const errs = [];
      if (!r.ncf) errs.push('NCF');
      if (!r.fechaComp) errs.push('Fecha');
      if (!r.tipoAnulacion) errs.push('Tipo anulación');
      if (errs.length) invalidRows.push(`Fila ${i + 1}: ${errs.join(', ')}`);
    });
    if (invalidRows.length) {
      window.app.showToast(`Errores: ${invalidRows[0]}`, 'error', 6000);
      return;
    }

    const lines = [];
    // Header 608: 608|RNC|Periodo|CantRegistros
    lines.push(['608', _rnc, _periodo, _rows.length].join('|'));
    // Detalle: Línea|NCF|FechaComprobante|TipoAnulacion
    _rows.forEach((r, i) => {
      lines.push([
        i + 1,
        r.ncf,
        fmtDateDgii(r.fechaComp),
        r.tipoAnulacion,
      ].join('|'));
    });

    const filename = `DGII_F_608_${_rnc}_${_periodo}.txt`;
    downloadText(lines.join('\n') + '\n', filename, 'text/plain');
    window.app.showToast(`📥 Archivo 608 generado (${_rows.length} registros)`, 'success', 4000);
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

  window.forms608 = { open, addRow, deleteRow, clearAll, setHeader, setCell, loadCsv, downloadTemplate, generate };
})();
