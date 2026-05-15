// js/forms_import.js
// Helper compartido para los módulos 606/607/608/609.
// Lee archivos CSV y XLSX/XLS y los devuelve como array de objetos con
// fuzzy matching de nombres de columna.

(function () {
  'use strict';

  // ────────────────────────────────────────────────────────────────
  // Normaliza un string para matching: lowercase, sin acentos, sin
  // espacios/guiones/underscores/paréntesis. "RNC del Proveedor" → "rncdelproveedor"
  // ────────────────────────────────────────────────────────────────
  function normalizeKey(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quita acentos
      .toLowerCase()
      .replace(/[\s_\-()/.,]/g, '');                        // quita separadores
  }

  // ────────────────────────────────────────────────────────────────
  // Encuentra el header de un row que mejor coincida con cualquiera
  // de los sinónimos dados.
  // headerKey: la clave normalizada del header del archivo
  // synonyms: array de strings posibles para esa columna
  // ────────────────────────────────────────────────────────────────
  function matchesAnySynonym(headerKey, synonyms) {
    const normalSyns = synonyms.map(normalizeKey);
    // Match exacto primero
    if (normalSyns.includes(headerKey)) return true;
    // Match parcial: header contiene el sinónimo o viceversa
    for (const syn of normalSyns) {
      if (syn && (headerKey.includes(syn) || syn.includes(headerKey))) return true;
    }
    return false;
  }

  // ────────────────────────────────────────────────────────────────
  // Dado los headers del archivo y un fieldMap, retorna un mapa
  // headerOriginal → fieldInterno. fieldMap es:
  //   { internalName: ['Synonym 1', 'Synonym 2', ...] }
  // ────────────────────────────────────────────────────────────────
  function resolveColumnMapping(headers, fieldMap) {
    const mapping = {};
    const headerKeys = headers.map(h => ({ original: h, key: normalizeKey(h) }));
    for (const [internal, synonyms] of Object.entries(fieldMap)) {
      // Buscar el primer header que coincida
      const found = headerKeys.find(h => matchesAnySynonym(h.key, synonyms));
      if (found) mapping[found.original] = internal;
    }
    return mapping;
  }

  // ────────────────────────────────────────────────────────────────
  // Lee un archivo CSV. Retorna Promise<{ headers, rows }>
  // - headers: Array<string>
  // - rows: Array<Object>  → cada object es { headerOriginal: valor }
  // ────────────────────────────────────────────────────────────────
  function parseCsv(text) {
    // Limpia BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    // Soporta delimitador , o ; (común en Excel español)
    const firstLine = lines[0];
    const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

    function splitLine(line) {
      // Maneja comillas
      const cells = [];
      let cur = '';
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
          else inQuote = !inQuote;
        } else if (c === delimiter && !inQuote) {
          cells.push(cur); cur = '';
        } else {
          cur += c;
        }
      }
      cells.push(cur);
      return cells.map(c => c.trim());
    }

    const headers = splitLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = splitLine(lines[i]);
      if (cells.length === 0 || cells.every(c => !c)) continue;
      const row = {};
      headers.forEach((h, idx) => { row[h] = cells[idx] ?? ''; });
      rows.push(row);
    }
    return { headers, rows };
  }

  // ────────────────────────────────────────────────────────────────
  // Lee un archivo XLSX/XLS usando SheetJS. La primera hoja se toma
  // como dataset. La primera fila como headers.
  // ────────────────────────────────────────────────────────────────
  function parseXlsx(arrayBuffer) {
    if (typeof XLSX === 'undefined') {
      throw new Error('Librería de Excel (SheetJS) no cargada todavía. Espera 2 segundos.');
    }
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { headers: [], rows: [] };
    // Convertir a array de objetos. defval='' para celdas vacías.
    const data = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    if (data.length === 0) return { headers: [], rows: [] };
    const headers = Object.keys(data[0]);
    return { headers, rows: data };
  }

  // ────────────────────────────────────────────────────────────────
  // API PÚBLICA — parsea un File (input file) y aplica fieldMap.
  // Returns Promise<{
  //   mappedRows: Array<{ internalName: value }>,
  //   unmappedHeaders: string[],   // headers del archivo que no encajaron en ningún field
  //   missingFields: string[],     // fields del fieldMap que no encontraron columna
  //   totalRows: number,
  // }>
  // ────────────────────────────────────────────────────────────────
  function parseFile(file, fieldMap) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('Archivo no proporcionado'));

      const ext = file.name.toLowerCase().split('.').pop();
      const reader = new FileReader();

      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.onload = (e) => {
        try {
          let parsed;
          if (ext === 'xlsx' || ext === 'xls') {
            parsed = parseXlsx(e.target.result);
          } else {
            // csv, txt, o cualquier otro intentamos CSV
            parsed = parseCsv(e.target.result);
          }

          if (!parsed.headers.length || !parsed.rows.length) {
            return reject(new Error('Archivo vacío o sin datos'));
          }

          // Resolver mapping
          const colMapping = resolveColumnMapping(parsed.headers, fieldMap);
          const matchedInternal = new Set(Object.values(colMapping));
          const missingFields = Object.keys(fieldMap).filter(k => !matchedInternal.has(k));
          const unmappedHeaders = parsed.headers.filter(h => !colMapping[h]);

          // Reescribir filas con campos internos
          const mappedRows = parsed.rows.map(row => {
            const out = {};
            for (const [original, internal] of Object.entries(colMapping)) {
              out[internal] = row[original];
            }
            return out;
          });

          resolve({
            mappedRows,
            unmappedHeaders,
            missingFields,
            totalRows: parsed.rows.length,
          });
        } catch (err) {
          reject(err);
        }
      };

      if (ext === 'xlsx' || ext === 'xls') {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file, 'UTF-8');
      }
    });
  }

  window.formsImport = {
    parseFile,
    normalizeKey,
    resolveColumnMapping,
  };
})();
