// js/forms607.js
// Generador del Formato 607 — Ventas de bienes y servicios (Norma 06-2018 DGII).
// Exclusivo del plan Max.

(function () {
  'use strict';

  let _rows = [];
  let _rnc = '';
  let _periodo = '';

  const TIPO_INGRESO = [
    { code: '01', label: '01 — Ingresos por operaciones (no financieros)' },
    { code: '02', label: '02 — Ingresos financieros' },
    { code: '03', label: '03 — Ingresos extraordinarios' },
    { code: '04', label: '04 — Ingresos por arrendamientos' },
    { code: '05', label: '05 — Ingresos por venta de activos depreciables' },
    { code: '06', label: '06 — Otros ingresos' },
  ];

  function fmtRD(n) {
    return 'RD$ ' + (Number(n) || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function sanitizeId(s) { return String(s || '').replace(/\D/g, ''); }
  function sanitizeNCF(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function fmtDateDgii(s) { return s ? s.replace(/-/g, '') : ''; }

  function emptyRow() {
    return {
      idCliente: '',         // RNC o cédula (vacío = consumidor final)
      tipoId: '1',           // 1=RNC, 2=Cédula
      ncf: '',
      ncfMod: '',
      tipoIngreso: '01',
      fechaComp: '',
      fechaRet: '',          // fecha de retención (si hubo)
      montoFact: 0,
      itbisFact: 0,
      itbisRetTerceros: 0,   // ITBIS retenido por terceros (compradores agentes de retención)
      itbisPercibido: 0,     // ITBIS percibido si soy agente
      isrRetTerceros: 0,     // ISR retenido por terceros
      isrPercibido: 0,
      iscFact: 0,            // Impuesto Selectivo al Consumo
      otrosImpuestos: 0,
      propina: 0,
    };
  }

  function computeTotals() {
    return _rows.reduce((acc, r) => ({
      montoFact: acc.montoFact + (Number(r.montoFact) || 0),
      itbisFact: acc.itbisFact + (Number(r.itbisFact) || 0),
      itbisRetTerceros: acc.itbisRetTerceros + (Number(r.itbisRetTerceros) || 0),
      isrPercibido: acc.isrPercibido + (Number(r.isrPercibido) || 0),
      itbisPercibido: acc.itbisPercibido + (Number(r.itbisPercibido) || 0),
    }), { montoFact: 0, itbisFact: 0, itbisRetTerceros: 0, isrPercibido: 0, itbisPercibido: 0 });
  }

  function render() {
    const totals = computeTotals();
    const html = `
      <div class="ff-header">
        <div>
          <div class="ff-title">📑 Formato 607 — Ventas</div>
          <div class="ff-subtitle">Ventas de bienes y servicios · Norma 06-2018</div>
          <div class="ff-deadline">Se sube a Oficina Virtual DGII → Reportes → Envío de Datos</div>
        </div>
        <button type="button" class="sc-close" onclick="window.app.closeSmartCard()" aria-label="Cerrar">✕</button>
      </div>

      <div class="f606-header-form">
        <div class="ff-field">
          <label for="f607-rnc">RNC del contribuyente</label>
          <input type="text" id="f607-rnc" class="ff-input" placeholder="123456789" maxlength="11" value="${_rnc}" oninput="window.forms607.setHeader('rnc', this.value)">
        </div>
        <div class="ff-field">
          <label for="f607-periodo">Período (AAAAMM)</label>
          <input type="text" id="f607-periodo" class="ff-input" placeholder="202504" maxlength="6" value="${_periodo}" oninput="window.forms607.setHeader('periodo', this.value)">
          <div class="ff-sub">Ejemplo: 202504 = abril 2025</div>
        </div>
      </div>

      <div class="f606-toolbar">
        <button type="button" class="ff-btn-secondary" onclick="window.forms607.addRow()">+ Agregar venta</button>
        <button type="button" class="ff-btn-secondary" onclick="document.getElementById('f607-csv-input').click()">📤 Cargar CSV</button>
        <input type="file" id="f607-csv-input" accept=".csv,.txt" style="display:none;" onchange="window.forms607.loadCsv(event)">
        <button type="button" class="ff-btn-secondary" onclick="window.forms607.clearAll()">🗑 Limpiar todo</button>
      </div>

      <div class="f606-table-wrap">
        <table class="f606-table">
          <thead>
            <tr>
              <th>#</th>
              <th>RNC/Cédula cliente</th>
              <th>Tipo ID</th>
              <th>NCF emitido</th>
              <th>Tipo ingreso</th>
              <th>Fecha comp.</th>
              <th>Monto facturado</th>
              <th>ITBIS facturado</th>
              <th>ITBIS ret. terceros</th>
              <th>ISR percibido</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="f607-tbody">
            ${_rows.map((r, i) => renderRow(r, i)).join('') || `
              <tr class="f606-empty"><td colspan="11">Sin ventas. Click <strong>+ Agregar venta</strong> para empezar o carga un CSV.</td></tr>
            `}
          </tbody>
        </table>
      </div>

      <div class="f606-totals">
        <div class="f606-total-block">
          <div class="f606-total-label">Total ventas</div>
          <div class="f606-total-value">${fmtRD(totals.montoFact)}</div>
        </div>
        <div class="f606-total-block">
          <div class="f606-total-label">ITBIS facturado</div>
          <div class="f606-total-value">${fmtRD(totals.itbisFact)}</div>
        </div>
        <div class="f606-total-block">
          <div class="f606-total-label">ITBIS retenido terceros</div>
          <div class="f606-total-value">${fmtRD(totals.itbisRetTerceros)}</div>
        </div>
        <div class="f606-total-block">
          <div class="f606-total-label">ISR percibido</div>
          <div class="f606-total-value">${fmtRD(totals.isrPercibido)}</div>
        </div>
        <div class="f606-total-block highlight">
          <div class="f606-total-label">Registros</div>
          <div class="f606-total-value">${_rows.length}</div>
        </div>
      </div>

      <div class="ff-actions">
        <button type="button" class="ff-btn-secondary" onclick="window.forms607.downloadTemplate()">📋 Plantilla CSV</button>
        <button type="button" class="ff-btn-primary" onclick="window.forms607.generate()">📥 Descargar archivo 607 para DGII</button>
      </div>

      <div class="f606-info">
        <strong>⚠ Importante:</strong> Cliente vacío = consumidor final.
        Este archivo se sube a Oficina Virtual DGII → <em>Reportes → Envío de Datos → 607</em>.
      </div>
    `;
    const cont = document.getElementById('sc-content');
    if (cont) cont.innerHTML = html;
  }

  function renderRow(r, i) {
    return `
      <tr data-row="${i}">
        <td>${String(i + 1).padStart(3, '0')}</td>
        <td><input type="text" maxlength="11" value="${r.idCliente}" placeholder="(opcional)" oninput="window.forms607.setCell(${i},'idCliente',this.value)"></td>
        <td>
          <select onchange="window.forms607.setCell(${i},'tipoId',this.value)">
            <option value="1" ${r.tipoId === '1' ? 'selected' : ''}>RNC</option>
            <option value="2" ${r.tipoId === '2' ? 'selected' : ''}>Cédula</option>
          </select>
        </td>
        <td><input type="text" value="${r.ncf}" placeholder="B0100000001" oninput="window.forms607.setCell(${i},'ncf',this.value)"></td>
        <td>
          <select onchange="window.forms607.setCell(${i},'tipoIngreso',this.value)">
            ${TIPO_INGRESO.map(t => `<option value="${t.code}" ${t.code === r.tipoIngreso ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </td>
        <td><input type="date" value="${r.fechaComp}" oninput="window.forms607.setCell(${i},'fechaComp',this.value)"></td>
        <td><input type="number" step="0.01" value="${r.montoFact || ''}" oninput="window.forms607.setCell(${i},'montoFact',this.value)"></td>
        <td><input type="number" step="0.01" value="${r.itbisFact || ''}" oninput="window.forms607.setCell(${i},'itbisFact',this.value)"></td>
        <td><input type="number" step="0.01" value="${r.itbisRetTerceros || ''}" oninput="window.forms607.setCell(${i},'itbisRetTerceros',this.value)"></td>
        <td><input type="number" step="0.01" value="${r.isrPercibido || ''}" oninput="window.forms607.setCell(${i},'isrPercibido',this.value)"></td>
        <td><button type="button" class="f606-del" onclick="window.forms607.deleteRow(${i})">🗑</button></td>
      </tr>
    `;
  }

  function refreshTotalsOnly() {
    const totals = computeTotals();
    const blocks = document.querySelectorAll('.f606-total-value');
    if (blocks.length >= 5) {
      blocks[0].textContent = fmtRD(totals.montoFact);
      blocks[1].textContent = fmtRD(totals.itbisFact);
      blocks[2].textContent = fmtRD(totals.itbisRetTerceros);
      blocks[3].textContent = fmtRD(totals.isrPercibido);
      blocks[4].textContent = _rows.length;
    }
  }

  function setHeader(field, value) {
    if (field === 'rnc') _rnc = sanitizeId(value);
    if (field === 'periodo') _periodo = String(value).replace(/\D/g, '').slice(0, 6);
  }

  function setCell(index, field, value) {
    if (!_rows[index]) return;
    if (field === 'idCliente') _rows[index][field] = sanitizeId(value);
    else if (['ncf', 'ncfMod'].includes(field)) _rows[index][field] = sanitizeNCF(value);
    else if (['montoFact', 'itbisFact', 'itbisRetTerceros', 'itbisPercibido', 'isrRetTerceros', 'isrPercibido', 'iscFact', 'otrosImpuestos', 'propina'].includes(field)) {
      _rows[index][field] = parseFloat(value) || 0;
      refreshTotalsOnly();
    } else _rows[index][field] = value;
  }

  function addRow() { _rows.push(emptyRow()); render(); }
  function deleteRow(i) { _rows.splice(i, 1); render(); }
  function clearAll() {
    if (_rows.length === 0) return;
    if (!confirm('¿Eliminar todas las ventas cargadas?')) return;
    _rows = []; render();
  }

  function downloadTemplate() {
    const headers = [
      'RNC_o_Cedula_cliente(vacio=consumidor_final)',
      'Tipo_ID(1=RNC,2=Cedula)',
      'NCF_Emitido',
      'Tipo_Ingreso(01-06)',
      'Fecha_Comprobante(YYYY-MM-DD)',
      'Monto_Facturado',
      'ITBIS_Facturado',
      'ITBIS_Retenido_Terceros',
      'ISR_Percibido',
    ];
    const sample = [
      '101234567,1,B0100000001,01,2025-04-15,5000.00,900.00,0.00,0.00',
      ',2,B0200000050,01,2025-04-16,2500.00,450.00,0.00,0.00',
    ];
    downloadText(headers.join(',') + '\n' + sample.join('\n'), 'plantilla_607.csv', 'text/csv');
    window.app.showToast('Plantilla CSV descargada', 'success', 2500);
  }

  function loadCsv(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        window.app.showToast('CSV vacío o sin datos', 'error');
        return;
      }
      const dataLines = lines.slice(1);
      const newRows = [];
      for (const line of dataLines) {
        const c = line.split(',').map(x => x.trim().replace(/^"|"$/g, ''));
        if (c.length < 9) continue;
        newRows.push({
          idCliente: sanitizeId(c[0]),
          tipoId: c[1] || '1',
          ncf: sanitizeNCF(c[2]),
          ncfMod: '',
          tipoIngreso: (c[3] || '01').padStart(2, '0'),
          fechaComp: c[4] || '',
          fechaRet: '',
          montoFact: parseFloat(c[5]) || 0,
          itbisFact: parseFloat(c[6]) || 0,
          itbisRetTerceros: parseFloat(c[7]) || 0,
          itbisPercibido: 0,
          isrRetTerceros: 0,
          isrPercibido: parseFloat(c[8]) || 0,
          iscFact: 0,
          otrosImpuestos: 0,
          propina: 0,
        });
      }
      _rows = _rows.concat(newRows);
      render();
      window.app.showToast(`${newRows.length} ventas cargadas`, 'success', 3000);
    };
    reader.readAsText(file);
  }

  function generate() {
    if (!_rnc || _rnc.length < 9) {
      window.app.showToast('Ingresa el RNC del contribuyente (9 u 11 dígitos)', 'error');
      return;
    }
    if (!_periodo || _periodo.length !== 6) {
      window.app.showToast('Ingresa el período en formato AAAAMM', 'error');
      return;
    }
    if (_rows.length === 0) {
      window.app.showToast('Agrega al menos una venta', 'error');
      return;
    }

    const invalidRows = [];
    _rows.forEach((r, i) => {
      const errs = [];
      if (!r.ncf) errs.push('NCF');
      if (!r.fechaComp) errs.push('Fecha');
      if (!r.montoFact || r.montoFact <= 0) errs.push('Monto');
      if (errs.length) invalidRows.push(`Fila ${i + 1}: falta ${errs.join(', ')}`);
    });
    if (invalidRows.length) {
      window.app.showToast(`Errores: ${invalidRows[0]}${invalidRows.length > 1 ? ` (+${invalidRows.length - 1})` : ''}`, 'error', 6000);
      return;
    }

    const totals = computeTotals();
    const lines = [];
    // Header: 607|RNC|Periodo|CantRegistros|TotalMonto|TotalITBIS|TotalISRPercibido|TotalITBISPercibido
    lines.push([
      '607', _rnc, _periodo, _rows.length,
      totals.montoFact.toFixed(2),
      totals.itbisFact.toFixed(2),
      totals.isrPercibido.toFixed(2),
      totals.itbisPercibido.toFixed(2),
    ].join('|'));

    _rows.forEach((r, i) => {
      lines.push([
        i + 1,
        r.idCliente || '',
        r.tipoId || '1',
        r.ncf,
        r.ncfMod || '',
        r.tipoIngreso || '01',
        fmtDateDgii(r.fechaComp),
        fmtDateDgii(r.fechaRet),
        (r.montoFact || 0).toFixed(2),
        (r.itbisFact || 0).toFixed(2),
        (r.itbisRetTerceros || 0).toFixed(2),
        (r.itbisPercibido || 0).toFixed(2),
        (r.isrRetTerceros || 0).toFixed(2),
        (r.isrPercibido || 0).toFixed(2),
        (r.iscFact || 0).toFixed(2),
        (r.otrosImpuestos || 0).toFixed(2),
        (r.propina || 0).toFixed(2),
      ].join('|'));
    });

    const filename = `DGII_F_607_${_rnc}_${_periodo}.txt`;
    downloadText(lines.join('\n') + '\n', filename, 'text/plain');
    window.app.showToast(`📥 Archivo 607 generado (${_rows.length} registros)`, 'success', 4000);
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

  window.forms607 = { open, addRow, deleteRow, clearAll, setHeader, setCell, loadCsv, downloadTemplate, generate };
})();
