// js/forms606.js
// Generador del Formato 606 — Compras de bienes y servicios (Norma 06-2018 DGII).
// Genera un archivo .txt delimitado por | que se sube directamente a Oficina Virtual DGII.
// Exclusivo del plan Max.

(function () {
  'use strict';

  // ════════════════════════════════════════════════════════════════
  // ESTADO INTERNO
  // ════════════════════════════════════════════════════════════════
  let _rows = [];        // array de { rnc, tipoBienServicios, ncf, ncfMod, tipoId, fechaComp, fechaPago, montoFact, itbisFact, itbisRet, isrRet, montoServ, montoBienes }
  let _rnc = '';         // RNC del contribuyente
  let _periodo = '';     // YYYYMM

  // ════════════════════════════════════════════════════════════════
  // CATÁLOGOS DGII
  // ════════════════════════════════════════════════════════════════
  const TIPO_BIENES_SERVICIOS = [
    { code: '01', label: '01 — Gastos de personal' },
    { code: '02', label: '02 — Gastos por trabajos, suministros y servicios' },
    { code: '03', label: '03 — Arrendamientos' },
    { code: '04', label: '04 — Gastos de activos fijos' },
    { code: '05', label: '05 — Gastos de representación' },
    { code: '06', label: '06 — Otras deducciones admitidas' },
    { code: '07', label: '07 — Gastos financieros' },
    { code: '08', label: '08 — Gastos extraordinarios' },
    { code: '09', label: '09 — Compras y gastos que formarán parte del costo de venta' },
    { code: '10', label: '10 — Adquisiciones de activos' },
    { code: '11', label: '11 — Gastos de seguros' },
  ];

  const TIPO_IDENTIFICACION = [
    { code: '1', label: 'RNC' },
    { code: '2', label: 'Cédula' },
    { code: '3', label: 'Pasaporte' },
  ];

  // ════════════════════════════════════════════════════════════════
  // UTILIDADES
  // ════════════════════════════════════════════════════════════════
  function fmtRD(n) {
    return 'RD$ ' + (Number(n) || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Sanea RNC/Cédula — solo dígitos
  function sanitizeId(s) {
    return String(s || '').replace(/\D/g, '');
  }

  // Sanea NCF — 11 caracteres (E + 10 dígitos) o 19 (B/A + 18 dígitos) o e-CF (B + 9 + 7)
  function sanitizeNCF(s) {
    return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  // Convierte YYYY-MM-DD → YYYYMMDD (formato DGII)
  function fmtDateDgii(isoDate) {
    if (!isoDate) return '';
    return isoDate.replace(/-/g, '');
  }

  function emptyRow() {
    return {
      rnc: '',
      tipoBienServicios: '09',     // default: compras formando parte costo
      ncf: '',
      ncfMod: '',
      tipoId: '1',                  // default: RNC
      fechaComp: '',                // YYYY-MM-DD del input
      fechaPago: '',
      montoFact: 0,
      itbisFact: 0,
      itbisRet: 0,
      isrRet: 0,
      montoServ: 0,
      montoBienes: 0,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // RENDER UI
  // ════════════════════════════════════════════════════════════════
  function render() {
    const totals = computeTotals();
    const html = `
      <div class="ff-header">
        <div>
          <div class="ff-title">📑 Formato 606 — Compras</div>
          <div class="ff-subtitle">Compras de bienes y servicios · Norma 06-2018</div>
          <div class="ff-deadline">Se sube a Oficina Virtual DGII → Reportes → Envío de Datos</div>
        </div>
        <button type="button" class="sc-close" onclick="window.app.closeSmartCard()" aria-label="Cerrar">✕</button>
      </div>

      <div class="f606-header-form">
        <div class="ff-field">
          <label for="f606-rnc">RNC del contribuyente</label>
          <input type="text" id="f606-rnc" class="ff-input" placeholder="123456789" maxlength="11" value="${_rnc}" oninput="window.forms606.setHeader('rnc', this.value)">
        </div>
        <div class="ff-field">
          <label for="f606-periodo">Período (AAAAMM)</label>
          <input type="text" id="f606-periodo" class="ff-input" placeholder="202504" maxlength="6" value="${_periodo}" oninput="window.forms606.setHeader('periodo', this.value)">
          <div class="ff-sub">Ejemplo: 202504 = abril 2025</div>
        </div>
      </div>

      <div class="f606-toolbar">
        <button type="button" class="ff-btn-secondary" onclick="window.forms606.addRow()">+ Agregar compra</button>
        <button type="button" class="ff-btn-secondary" onclick="document.getElementById('f606-csv-input').click()">📤 Cargar Excel/CSV</button>
        <input type="file" id="f606-csv-input" accept=".csv,.txt,.xlsx,.xls" style="display:none;" onchange="window.forms606.loadCsv(event)">
        <button type="button" class="ff-btn-secondary" onclick="window.forms606.clearAll()">🗑 Limpiar todo</button>
      </div>

      <div class="f606-table-wrap">
        <table class="f606-table">
          <thead>
            <tr>
              <th>#</th>
              <th>RNC/Cédula proveedor</th>
              <th>Tipo bien/servicio</th>
              <th>NCF</th>
              <th>Fecha comp.</th>
              <th>Fecha pago</th>
              <th>Monto facturado</th>
              <th>ITBIS facturado</th>
              <th>ITBIS retenido</th>
              <th>ISR retenido</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="f606-tbody">
            ${_rows.map((r, i) => renderRow(r, i)).join('') || `
              <tr class="f606-empty"><td colspan="11">Sin compras. Click <strong>+ Agregar compra</strong> para empezar o carga un CSV.</td></tr>
            `}
          </tbody>
        </table>
      </div>

      <div class="f606-totals">
        <div class="f606-total-block">
          <div class="f606-total-label">Total compras</div>
          <div class="f606-total-value">${fmtRD(totals.montoFact)}</div>
        </div>
        <div class="f606-total-block">
          <div class="f606-total-label">Total ITBIS facturado</div>
          <div class="f606-total-value">${fmtRD(totals.itbisFact)}</div>
        </div>
        <div class="f606-total-block">
          <div class="f606-total-label">Total ITBIS retenido</div>
          <div class="f606-total-value">${fmtRD(totals.itbisRet)}</div>
        </div>
        <div class="f606-total-block">
          <div class="f606-total-label">Total ISR retenido</div>
          <div class="f606-total-value">${fmtRD(totals.isrRet)}</div>
        </div>
        <div class="f606-total-block highlight">
          <div class="f606-total-label">Registros</div>
          <div class="f606-total-value">${_rows.length}</div>
        </div>
      </div>

      <div class="ff-actions">
        <button type="button" class="ff-btn-secondary" onclick="window.forms606.downloadTemplate()">📋 Plantilla CSV</button>
        <button type="button" class="ff-btn-primary" onclick="window.forms606.generate()">📥 Descargar archivo 606 para DGII</button>
      </div>

      <div class="f606-info">
        <strong>⚠ Importante:</strong> Este archivo se sube directamente a la Oficina Virtual DGII →
        <em>Reportes → Envío de Datos → 606</em>. NormaIA no envía nada a DGII por ti — tú haces el upload.
      </div>
    `;

    const cont = document.getElementById('sc-content');
    if (cont) cont.innerHTML = html;
  }

  function renderRow(r, i) {
    return `
      <tr data-row="${i}">
        <td>${String(i + 1).padStart(3, '0')}</td>
        <td><input type="text" maxlength="11" value="${r.rnc}" placeholder="RNC" oninput="window.forms606.setCell(${i},'rnc',this.value)"></td>
        <td>
          <select onchange="window.forms606.setCell(${i},'tipoBienServicios',this.value)">
            ${TIPO_BIENES_SERVICIOS.map(t => `<option value="${t.code}" ${t.code === r.tipoBienServicios ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </td>
        <td><input type="text" value="${r.ncf}" placeholder="B0100000001" oninput="window.forms606.setCell(${i},'ncf',this.value)"></td>
        <td><input type="date" value="${r.fechaComp}" oninput="window.forms606.setCell(${i},'fechaComp',this.value)"></td>
        <td><input type="date" value="${r.fechaPago}" oninput="window.forms606.setCell(${i},'fechaPago',this.value)"></td>
        <td><input type="number" step="0.01" value="${r.montoFact || ''}" oninput="window.forms606.setCell(${i},'montoFact',this.value)"></td>
        <td><input type="number" step="0.01" value="${r.itbisFact || ''}" oninput="window.forms606.setCell(${i},'itbisFact',this.value)"></td>
        <td><input type="number" step="0.01" value="${r.itbisRet || ''}" oninput="window.forms606.setCell(${i},'itbisRet',this.value)"></td>
        <td><input type="number" step="0.01" value="${r.isrRet || ''}" oninput="window.forms606.setCell(${i},'isrRet',this.value)"></td>
        <td><button type="button" class="f606-del" onclick="window.forms606.deleteRow(${i})" title="Eliminar fila">🗑</button></td>
      </tr>
    `;
  }

  function refreshTotalsOnly() {
    // Actualiza solo los totales sin redibujar toda la tabla (evita pérdida de foco)
    const totals = computeTotals();
    const blocks = document.querySelectorAll('.f606-total-value');
    if (blocks.length >= 5) {
      blocks[0].textContent = fmtRD(totals.montoFact);
      blocks[1].textContent = fmtRD(totals.itbisFact);
      blocks[2].textContent = fmtRD(totals.itbisRet);
      blocks[3].textContent = fmtRD(totals.isrRet);
      blocks[4].textContent = _rows.length;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // OPERACIONES SOBRE EL ESTADO
  // ════════════════════════════════════════════════════════════════
  function setHeader(field, value) {
    if (field === 'rnc') _rnc = sanitizeId(value);
    if (field === 'periodo') _periodo = String(value).replace(/\D/g, '').slice(0, 6);
  }

  function setCell(index, field, value) {
    if (!_rows[index]) return;
    if (['rnc'].includes(field)) {
      _rows[index][field] = sanitizeId(value);
    } else if (['ncf', 'ncfMod'].includes(field)) {
      _rows[index][field] = sanitizeNCF(value);
    } else if (['montoFact', 'itbisFact', 'itbisRet', 'isrRet', 'montoServ', 'montoBienes'].includes(field)) {
      _rows[index][field] = parseFloat(value) || 0;
      refreshTotalsOnly();
    } else {
      _rows[index][field] = value;
    }
  }

  function addRow() {
    _rows.push(emptyRow());
    render();
  }

  function deleteRow(index) {
    _rows.splice(index, 1);
    render();
  }

  function clearAll() {
    if (_rows.length === 0) return;
    if (!confirm('¿Eliminar todas las compras cargadas?')) return;
    _rows = [];
    render();
  }

  function computeTotals() {
    return _rows.reduce((acc, r) => ({
      montoFact: acc.montoFact + (Number(r.montoFact) || 0),
      itbisFact: acc.itbisFact + (Number(r.itbisFact) || 0),
      itbisRet: acc.itbisRet + (Number(r.itbisRet) || 0),
      isrRet: acc.isrRet + (Number(r.isrRet) || 0),
    }), { montoFact: 0, itbisFact: 0, itbisRet: 0, isrRet: 0 });
  }

  // ════════════════════════════════════════════════════════════════
  // CSV LOAD & TEMPLATE
  // ════════════════════════════════════════════════════════════════
  function downloadTemplate() {
    const headers = [
      'RNC_o_Cedula_proveedor',
      'Tipo_Bien_Servicio(01-11)',
      'NCF',
      'Fecha_Comprobante(YYYY-MM-DD)',
      'Fecha_Pago(YYYY-MM-DD)',
      'Monto_Facturado',
      'ITBIS_Facturado',
      'ITBIS_Retenido',
      'ISR_Retenido',
    ];
    const sample = [
      '101234567,09,B0100000001,2025-04-15,2025-04-20,10000.00,1800.00,0.00,0.00',
      '102345678,02,B0200000123,2025-04-18,2025-04-25,5000.00,900.00,0.00,500.00',
    ];
    const content = headers.join(',') + '\n' + sample.join('\n');
    downloadText(content, 'plantilla_606.csv', 'text/csv');
    window.app.showToast('Plantilla CSV descargada', 'success', 2500);
  }

  // Mapeo flexible de columnas para CSV/Excel
  // Cada campo interno tiene varios sinónimos que se intentan matchear
  const FIELD_MAP_606 = {
    rnc:                ['rnc proveedor', 'rnc o cedula proveedor', 'rnc', 'cedula', 'rnc cedula', 'proveedor rnc'],
    tipoBienServicios:  ['tipo bien servicio', 'tipo bien servicios', 'tipo b s', 'tipo bs', 'tipo gasto'],
    ncf:                ['ncf', 'comprobante', 'numero comprobante fiscal'],
    fechaComp:          ['fecha comprobante', 'fecha factura', 'fecha emision', 'fecha'],
    fechaPago:          ['fecha pago', 'fecha de pago'],
    montoFact:          ['monto facturado', 'monto', 'total', 'subtotal', 'importe'],
    itbisFact:          ['itbis facturado', 'itbis', 'iva facturado', 'iva'],
    itbisRet:           ['itbis retenido', 'itbis retencion'],
    isrRet:             ['isr retenido', 'isr retencion', 'retencion isr', 'retencion renta'],
  };

  async function loadCsv(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!window.formsImport) {
      window.app.showToast('Helper de import no cargado, recarga la página', 'error');
      return;
    }
    try {
      const result = await window.formsImport.parseFile(file, FIELD_MAP_606);

      if (!result.mappedRows.length) {
        window.app.showToast('No se pudo leer ninguna fila del archivo', 'error');
        return;
      }
      // Si faltan campos críticos, advertir
      const critical = ['rnc', 'ncf', 'fechaComp', 'montoFact'];
      const missingCritical = result.missingFields.filter(f => critical.includes(f));
      if (missingCritical.length) {
        window.app.showToast(
          `Faltan columnas obligatorias: ${missingCritical.join(', ')}. Revisa los headers de tu archivo.`,
          'error', 7000
        );
        return;
      }

      // Convertir a estructura interna
      const newRows = result.mappedRows.map(r => ({
        rnc: sanitizeId(r.rnc),
        tipoBienServicios: String(r.tipoBienServicios || '09').padStart(2, '0').slice(0, 2),
        ncf: sanitizeNCF(r.ncf),
        ncfMod: '',
        tipoId: (sanitizeId(r.rnc).length === 9) ? '1' : '2',
        fechaComp: parseDate(r.fechaComp),
        fechaPago: parseDate(r.fechaPago),
        montoFact: parseFloat(r.montoFact) || 0,
        itbisFact: parseFloat(r.itbisFact) || 0,
        itbisRet: parseFloat(r.itbisRet) || 0,
        isrRet: parseFloat(r.isrRet) || 0,
        montoServ: 0,
        montoBienes: 0,
      })).filter(r => r.rnc && r.ncf);  // descartar filas sin RNC ni NCF

      const skipped = result.totalRows - newRows.length;
      _rows = _rows.concat(newRows);
      render();

      let msg = `✓ ${newRows.length} compras cargadas`;
      if (skipped > 0) msg += ` (${skipped} omitidas por datos incompletos)`;
      window.app.showToast(msg, 'success', 4000);
    } catch (err) {
      window.app.showToast(`Error: ${err.message}`, 'error', 6000);
    }
  }

  // Parser de fecha tolerante: acepta YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY (intenta detectar)
  function parseDate(input) {
    if (!input) return '';
    const s = String(input).trim();
    // YYYY-MM-DD ya formateado
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // DD/MM/YYYY o DD-MM-YYYY
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
      const [, a, b, y] = m;
      // Si el primer número > 12, asumimos DD/MM/YYYY
      const day = parseInt(a) > 12 ? a : a;
      const month = parseInt(a) > 12 ? b : (parseInt(b) > 12 ? a : b);
      // Default: DD/MM/YYYY (estándar dominicano)
      return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    }
    // Excel a veces devuelve fechas como número serial o como string YYYY/MM/DD
    const isoTry = new Date(s);
    if (!isNaN(isoTry.getTime())) {
      return isoTry.toISOString().slice(0, 10);
    }
    return '';
  }

  // ════════════════════════════════════════════════════════════════
  // GENERAR ARCHIVO 606 (formato DGII)
  // ════════════════════════════════════════════════════════════════
  function generate() {
    // Validaciones
    if (!_rnc || _rnc.length < 9) {
      window.app.showToast('Ingresa el RNC del contribuyente (9 u 11 dígitos)', 'error');
      document.getElementById('f606-rnc')?.focus();
      return;
    }
    if (!_periodo || _periodo.length !== 6) {
      window.app.showToast('Ingresa el período en formato AAAAMM (ej: 202504)', 'error');
      document.getElementById('f606-periodo')?.focus();
      return;
    }
    if (_rows.length === 0) {
      window.app.showToast('Agrega al menos una compra antes de generar el archivo', 'error');
      return;
    }

    // Validar filas
    const invalidRows = [];
    _rows.forEach((r, i) => {
      const errs = [];
      if (!r.rnc) errs.push('RNC');
      if (!r.ncf) errs.push('NCF');
      if (!r.fechaComp) errs.push('Fecha');
      if (!r.montoFact || r.montoFact <= 0) errs.push('Monto');
      if (errs.length) invalidRows.push(`Fila ${i + 1}: falta ${errs.join(', ')}`);
    });
    if (invalidRows.length) {
      window.app.showToast(`Hay errores: ${invalidRows[0]}${invalidRows.length > 1 ? ` (+${invalidRows.length - 1} más)` : ''}`, 'error', 6000);
      return;
    }

    // Construir el archivo
    const totals = computeTotals();
    const lines = [];

    // Header: 606|RNC|Periodo|CantRegistros|TotalMonto|TotalITBISFact|TotalITBISRet|TotalISRRet
    lines.push([
      '606',
      _rnc,
      _periodo,
      _rows.length,
      totals.montoFact.toFixed(2),
      totals.itbisFact.toFixed(2),
      totals.itbisRet.toFixed(2),
      totals.isrRet.toFixed(2),
    ].join('|'));

    // Detalle
    _rows.forEach((r, i) => {
      lines.push([
        i + 1,                                   // Línea
        r.rnc,                                   // RNC/Cédula proveedor
        r.tipoBienServicios,                     // Tipo bien/servicio (01-11)
        r.ncf,                                   // NCF
        r.ncfMod || '',                          // NCF modificado
        r.tipoId || (r.rnc.length === 9 ? '1' : '2'),  // Tipo ID: 1=RNC, 2=Cédula
        fmtDateDgii(r.fechaComp),                // Fecha comprobante YYYYMMDD
        fmtDateDgii(r.fechaPago),                // Fecha pago YYYYMMDD
        (r.montoFact || 0).toFixed(2),
        (r.itbisFact || 0).toFixed(2),
        (r.itbisRet || 0).toFixed(2),
        '0.00',                                  // ITBIS proporcionalidad costo
        '0.00',                                  // ITBIS costo
        '0.00',                                  // ITBIS por adelantar
        '0.00',                                  // ITBIS devengado
        (r.isrRet || 0).toFixed(2),
        (r.montoServ || 0).toFixed(2),
        (r.montoBienes || 0).toFixed(2),
      ].join('|'));
    });

    const filename = `DGII_F_606_${_rnc}_${_periodo}.txt`;
    downloadText(lines.join('\n') + '\n', filename, 'text/plain');
    window.app.showToast(`📥 Archivo 606 generado (${_rows.length} registros)`, 'success', 4000);
  }

  function downloadText(content, filename, mime) {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ════════════════════════════════════════════════════════════════
  // API PÚBLICA
  // ════════════════════════════════════════════════════════════════
  function open() {
    const panel = document.getElementById('smart-card-panel');
    if (!panel) return;
    // Reset si está vacío (primera vez)
    if (_rows.length === 0) _rows = [emptyRow()];
    // Auto-llenar período al mes actual si está vacío
    if (!_periodo) {
      const now = new Date();
      _periodo = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0');
    }
    render();
    panel.classList.add('open');
  }

  window.forms606 = {
    open,
    addRow,
    deleteRow,
    clearAll,
    setHeader,
    setCell,
    loadCsv,
    downloadTemplate,
    generate,
  };
})();
