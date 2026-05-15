// js/forms.js
// Sistema de formularios fiscales completos para NormaIA.
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

  // ── Escala progresiva ISR personas físicas — IR-1 normal (Art. 296)
  // Tasas: 0 / 15% / 20% / 25%
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

  // ── Escala progresiva RST para Persona Física (Decreto 265-19)
  // Tasas REDUCIDAS respecto al IR-1: 0 / 10% / 15% / 20%
  // Se aplica directamente sobre los INGRESOS BRUTOS (no sobre el 60%).
  // El "beneficio" del RST PF es esta escala reducida + 4 cuotas trimestrales.
  // base acumulada de cada tramo = la suma de impuesto de los tramos anteriores
  const TABLA_RST_PF = [
    { desde: 0,       tasa: 0,    base: 0          },
    { desde: 416220,  tasa: 0.10, base: 0          },                      // 10% sobre excedente de 416,220
    { desde: 624329,  tasa: 0.15, base: 20810.90   },  // (624329-416220) * 0.10 = 20,810.90
    { desde: 867123,  tasa: 0.20, base: 57230.00   },  // 20810.90 + (867123-624329) * 0.15 = 57,229.00 ≈ 57,230
  ];
  function calcRstPf(ingresoBruto) {
    for (let i = TABLA_RST_PF.length - 1; i >= 0; i--) {
      const t = TABLA_RST_PF[i];
      if (ingresoBruto > t.desde) return +(t.base + (ingresoBruto - t.desde) * t.tasa).toFixed(2);
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
    // RST — RÉGIMEN SIMPLIFICADO DE TRIBUTACIÓN (Decreto 265-19)
    // Soporta: PJ vs PF, modalidad Servicios/Compras/Agropecuario, sector general/farmacias
    // ─────────────────────────────────────────────────────────
    rst: {
      title: 'Formulario RST',
      subtitle: 'Régimen Simplificado de Tributación (Decreto 265-19)',
      deadline: 'Plazo: 4 cuotas trimestrales (Mar/Abr · Jun · Sep · Dic)',
      icon: '📋',
      sections: [
        {
          name: 'I. Tipo de Contribuyente',
          fields: [
            { id: 'rst-tipo', label: 'Tipo de contribuyente', type: 'select', options: [
              { value: 'pf', label: 'Persona Física (profesional independiente)' },
              { value: 'pj', label: 'Persona Jurídica (SRL, SAS, SA)' },
            ]},
            { id: 'rst-modalidad', label: 'Modalidad del RST', type: 'select', options: [
              { value: 'servicios', label: 'Ingresos / Servicios (Profesionales y producción)' },
              { value: 'compras', label: 'Compras (Comercio de bienes)' },
              { value: 'agropecuario', label: 'Agropecuario (Producción primaria)' },
            ]},
            { id: 'rst-sector', label: 'Sector (solo aplica a Compras)', type: 'select', options: [
              { value: 'general', label: 'Comercial general (colmados, ferreterías, tiendas)' },
              { value: 'farmacias', label: 'Farmacias (medicamentos exentos)' },
            ]},
          ],
        },
        {
          name: 'II. Datos del Período',
          fields: [
            { id: 'rst-ingresos-anuales', label: 'Ingresos Brutos Anuales (modalidad Servicios)', type: 'money', sub: 'Tope: RD$ 12,068,181.09 anuales (referencial 2025)' },
            { id: 'rst-compras-anuales', label: 'Compras Anuales (modalidad Compras)', type: 'money', sub: 'Tope: RD$ 55,485,890.09 anuales (referencial 2025)' },
            { id: 'rst-margen-bruto', label: 'Margen Bruto Presunto (% sobre compras)', type: 'money', sub: 'Margen estimado por DGII según sector. Ejemplo: 25%' },
          ],
        },
        {
          name: 'III. Cálculo del Impuesto',
          fields: [
            { id: 'rst-base-imponible', label: 'Base Imponible', type: 'money', readonly: true, formula: () => {
              const tipo = document.getElementById('rst-tipo')?.value;
              const modalidad = document.getElementById('rst-modalidad')?.value;
              if (modalidad === 'compras') {
                // Modalidad Compras: base = compras × margen bruto presunto
                return num('rst-compras-anuales') * (num('rst-margen-bruto') / 100);
              }
              // Servicios o Agropecuario:
              // - PF: la base es el INGRESO BRUTO directo. El "beneficio" del RST PF
              //       es la escala reducida (10/15/20% vs 15/20/25% del IR-1 normal),
              //       NO una deducción del 40%. La escala se aplica sobre el bruto.
              // - PJ: 100% de los ingresos (luego se aplica 7% en ISR).
              return num('rst-ingresos-anuales');
            }},
            { id: 'rst-isr', label: 'ISR a Pagar', type: 'money', readonly: true, highlight: true, formula: () => {
              const tipo = document.getElementById('rst-tipo')?.value;
              const modalidad = document.getElementById('rst-modalidad')?.value;
              const base = num('rst-base-imponible');

              if (modalidad === 'compras') {
                // Modalidad Compras
                if (tipo === 'pj') return base * 0.27;
                // PF Compras: escala RST con tasas reducidas
                return calcRstPf(base);
              }
              // Servicios / Agropecuario
              if (tipo === 'pj') {
                // PJ Servicios: 7% sobre ingresos brutos (cubre ISR + ITBIS)
                return num('rst-ingresos-anuales') * 0.07;
              }
              // PF Servicios: escala progresiva RST sobre ingresos brutos.
              //   0 → 416,220        : exento
              //   416,220 → 624,329  : 10% sobre excedente
              //   624,329 → 867,123  : 15% sobre excedente
              //   > 867,123          : 20% sobre excedente
              // Ejemplo: ingresos 500,000 → 10% × (500,000-416,220) = RD$8,378
              return calcRstPf(num('rst-ingresos-anuales'));
            }},
            { id: 'rst-itbis', label: 'ITBIS a Pagar (solo modalidad Compras)', type: 'money', readonly: true, formula: () => {
              const modalidad = document.getElementById('rst-modalidad')?.value;
              if (modalidad !== 'compras') return 0;
              const sector = document.getElementById('rst-sector')?.value;
              const base = num('rst-base-imponible');
              // Sector general: 18% × 60% del margen
              // Farmacias: 18% × 25% del margen (medicamentos exentos)
              const factor = sector === 'farmacias' ? 0.25 : 0.60;
              return base * factor * 0.18;
            }},
            { id: 'rst-total-anual', label: 'TOTAL ANUAL A PAGAR (ISR + ITBIS)', type: 'money', readonly: true, highlight: true, formula: () => num('rst-isr') + num('rst-itbis') },
          ],
        },
        {
          name: 'IV. Distribución en 4 Cuotas Trimestrales',
          fields: [
            { id: 'rst-cuota1', label: 'Cuota 1 — Marzo (PF) / Abril (PJ)', type: 'money', readonly: true, formula: () => num('rst-total-anual') / 4 },
            { id: 'rst-cuota2', label: 'Cuota 2 — Junio', type: 'money', readonly: true, formula: () => num('rst-total-anual') / 4 },
            { id: 'rst-cuota3', label: 'Cuota 3 — Septiembre', type: 'money', readonly: true, formula: () => num('rst-total-anual') / 4 },
            { id: 'rst-cuota4', label: 'Cuota 4 — Diciembre', type: 'money', readonly: true, formula: () => num('rst-total-anual') / 4 },
            { id: 'rst-resultado', label: 'CUOTA TRIMESTRAL', type: 'result', formula: () => num('rst-total-anual') / 4 },
          ],
        },
      ],
      summary: () => {
        const tipo = document.getElementById('rst-tipo')?.value || 'pj';
        const modalidad = document.getElementById('rst-modalidad')?.value || 'servicios';
        const total = num('rst-total-anual');
        const cuota = total / 4;

        // Validación de topes
        let warning = '';
        if (modalidad === 'servicios' && num('rst-ingresos-anuales') > 12068181.09) {
          warning = ' ⚠ Excedes el tope de RD$ 12,068,181.09';
        } else if (modalidad === 'compras' && num('rst-compras-anuales') > 55485890.09) {
          warning = ' ⚠ Excedes el tope de RD$ 55,485,890.09';
        }

        const tipoLabel = tipo === 'pj' ? 'Persona Jurídica' : 'Persona Física';
        const modLabel = modalidad === 'compras' ? 'Compras' : (modalidad === 'agropecuario' ? 'Agropecuario' : 'Servicios');

        return {
          label: `${tipoLabel} · ${modLabel} · Cuota trimestral${warning}`,
          value: fmtRD(cuota),
          type: warning ? 'pay' : 'pay'
        };
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
        ${window.CONFIG?.FILE_UPLOAD_ENABLED ? `<button class="ff-tab" data-tab="documento" onclick="window.forms.switchTab(this, 'documento', '${formKey}')">📎 Adjuntar</button>` : ''}
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
          <button class="ff-btn-primary" onclick="window.forms.exportForm('${formKey}')">📊 Descargar papel de trabajo (Excel)</button>
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
      el.addEventListener('input', () => {
        if (formKey === 'rst') applyRstDefaults();
        recalc(formKey);
      });
      el.addEventListener('change', () => {
        if (formKey === 'rst') applyRstDefaults();
        recalc(formKey);
      });
    });
    // Cálculo inicial
    setTimeout(() => {
      if (formKey === 'rst') applyRstDefaults();
      recalc(formKey);
    }, 50);
  }

  // ═══════════════════════════════════════════════════════════
  //         RST — DEFAULTS DINÁMICOS POR CATEGORÍA
  // Pre-carga porcentajes, muestra/oculta campos no aplicables,
  // y renderiza un panel informativo con las tasas vigentes.
  // ═══════════════════════════════════════════════════════════

  // Márgenes brutos presuntos referenciales por sector (Decreto 265-19)
  const RST_MARGEN_DEFAULT = {
    general:   30,   // comercio general (colmados, ferreterías, tiendas)
    farmacias: 25,   // farmacias (medicamentos exentos)
  };

  function setFieldVisible(fieldId, visible) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    const wrap = el.closest('.ff-field');
    if (wrap) wrap.style.display = visible ? '' : 'none';
  }

  function ensureRstInfoPanel() {
    let panel = document.getElementById('rst-info-panel');
    if (panel) return panel;
    const sectorEl = document.getElementById('rst-sector');
    if (!sectorEl) return null;
    const section = sectorEl.closest('.ff-section');
    if (!section) return null;
    panel = document.createElement('div');
    panel.id = 'rst-info-panel';
    panel.className = 'rst-info-panel';
    section.appendChild(panel);
    return panel;
  }

  function applyRstDefaults() {
    const tipoEl = document.getElementById('rst-tipo');
    const modalidadEl = document.getElementById('rst-modalidad');
    const sectorEl = document.getElementById('rst-sector');
    if (!tipoEl || !modalidadEl || !sectorEl) return;

    const tipo = tipoEl.value;
    const modalidad = modalidadEl.value;
    const sector = sectorEl.value;

    const isCompras = modalidad === 'compras';
    const isServiciosOAgro = !isCompras;

    // 1) Mostrar/ocultar campos según modalidad
    setFieldVisible('rst-sector', isCompras);
    setFieldVisible('rst-ingresos-anuales', isServiciosOAgro);
    setFieldVisible('rst-compras-anuales', isCompras);
    setFieldVisible('rst-margen-bruto', isCompras);
    setFieldVisible('rst-itbis', isCompras);

    // 2) Pre-llenar el margen bruto según el sector (sólo si el usuario aún no escribió)
    const margenEl = document.getElementById('rst-margen-bruto');
    if (margenEl && isCompras) {
      const def = RST_MARGEN_DEFAULT[sector] ?? 30;
      // No sobrescribimos si el usuario ya tocó manualmente (margenEl.dataset.touched === '1')
      if (margenEl.dataset.touched !== '1' || !margenEl.value) {
        margenEl.value = def;
      }
      // Detectar primera modificación manual del usuario para no pisarla
      if (!margenEl._touchBound) {
        margenEl._touchBound = true;
        margenEl.addEventListener('input', () => { margenEl.dataset.touched = '1'; });
      }
    }

    // 3) Renderizar el panel informativo con las tasas aplicables
    const panel = ensureRstInfoPanel();
    if (!panel) return;

    let lines = [];
    if (modalidad === 'servicios') {
      if (tipo === 'pj') {
        lines = [
          ['Exención', 'No aplica', 'no hay mínimo exento para PJ'],
          ['ISR', '7% sobre ingresos brutos', 'cubre ISR + ITBIS'],
        ];
      } else {
        lines = [
          ['Exención anual', 'RD$ 416,220.00', 'mínimo no imponible'],
          ['Escala progresiva RST', '0% / 10% / 15% / 20%', 'tasas reducidas (vs IR-1 normal 15/20/25%)'],
          ['Cálculo', 'Sobre ingresos brutos (no se aplica 40%)', 'el beneficio del RST PF es la escala reducida'],
        ];
      }
    } else if (modalidad === 'compras') {
      const factorItbis = sector === 'farmacias' ? '25%' : '60%';
      const margenDef = RST_MARGEN_DEFAULT[sector] ?? 30;
      if (tipo === 'pj') {
        lines = [
          ['Margen bruto presunto', `${margenDef}% (referencial · editable)`, 'base = compras × margen'],
          ['ISR', '27% sobre margen presunto', 'tasa PJ'],
          ['ITBIS', `${factorItbis} × 18% del margen`, sector === 'farmacias' ? 'medicamentos exentos' : 'sector general'],
        ];
      } else {
        lines = [
          ['Margen bruto presunto', `${margenDef}% (referencial · editable)`, 'base = compras × margen'],
          ['ISR', 'Escala RST (0 / 10% / 15% / 20%)', 'tasas reducidas sobre el margen'],
          ['ITBIS', `${factorItbis} × 18% del margen`, sector === 'farmacias' ? 'medicamentos exentos' : 'sector general'],
        ];
      }
    } else if (modalidad === 'agropecuario') {
      lines = [
        ['Régimen', 'Producción primaria agropecuaria', 'Decreto 265-19'],
        ['ISR', tipo === 'pj' ? '7% sobre ingresos brutos' : 'Escala RST reducida (0/10/15/20%)', ''],
      ];
    }

    const rows = lines.map(([k, v, hint]) => `
      <div class="rst-info-row">
        <span class="rst-info-key">${k}</span>
        <span class="rst-info-val">${v}</span>
        ${hint ? `<span class="rst-info-hint">${hint}</span>` : ''}
      </div>
    `).join('');

    const tipoLbl = tipo === 'pj' ? 'Persona Jurídica' : 'Persona Física';
    const modLbl = modalidad === 'compras' ? 'Compras' : (modalidad === 'agropecuario' ? 'Agropecuario' : 'Servicios');

    panel.innerHTML = `
      <div class="rst-info-head">
        <span class="rst-info-badge">${tipoLbl}</span>
        <span class="rst-info-badge alt">${modLbl}</span>
        ${isCompras ? `<span class="rst-info-badge ghost">${sector === 'farmacias' ? 'Farmacias' : 'General'}</span>` : ''}
        <span class="rst-info-title">Tasas aplicables</span>
      </div>
      <div class="rst-info-body">${rows}</div>
    `;
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

  // ═══════════════════════════════════════════════════════════
  // EXPORT — Excel "papel de trabajo" con layout DGII
  // ═══════════════════════════════════════════════════════════
  // Genera un .xlsx con 3 hojas:
  //  1. Formulario   — réplica del layout oficial con casillas numeradas
  //  2. Base legal   — artículos y normas aplicables al cálculo
  //  3. Instrucciones — guía para transcribir a Oficina Virtual DGII
  //
  // NOTA: este archivo NO se sube a DGII. Es papel de trabajo del contador.
  // Para presentar la declaración hay que ir a oficinavirtual.dgii.gov.do
  // y llenar los campos con los valores de este archivo.
  function exportForm(formKey) {
    const form = FORMS[formKey];
    if (!form) return;
    if (typeof XLSX === 'undefined') {
      window.app.showToast('Librería de Excel aún cargando, intenta en 2s', 'info', 3000);
      return;
    }

    const today = new Date();
    const dateStr = today.toLocaleDateString('es-DO');
    const isoDate = today.toISOString().slice(0, 10);

    // ─── HOJA 1: Formulario ───────────────────────────────────
    const formSheet = [];
    formSheet.push(['NORMAIA · PAPEL DE TRABAJO', '', '', '']);
    formSheet.push([form.title, form.subtitle, '', '']);
    formSheet.push([form.deadline || '', '', `Generado: ${dateStr}`, '']);
    formSheet.push(['', '', '', '']);
    formSheet.push(['Casilla', 'Concepto', 'Monto (RD$)', 'Nota']);

    let casilla = 1;
    for (const section of form.sections) {
      formSheet.push([`— ${section.name} —`, '', '', '']);
      for (const f of section.fields) {
        if (f.type === 'select') {
          const el = document.getElementById(f.id);
          const selectedLabel = el?.options?.[el.selectedIndex]?.text || el?.value || '';
          formSheet.push(['', f.label, selectedLabel, '']);
          continue;
        }
        const v = num(f.id);
        const isResult = f.type === 'result' || f.highlight;
        const note = f.readonly ? 'Calculado' : (f.sub || '');
        if (v !== 0 || f.readonly || f.type === 'result') {
          formSheet.push([
            String(casilla).padStart(2, '0'),
            f.label + (isResult ? ' ★' : ''),
            +v.toFixed(2),
            note,
          ]);
          casilla++;
        }
      }
      formSheet.push(['', '', '', '']);
    }

    const sum = form.summary();
    formSheet.push(['', '', '', '']);
    formSheet.push(['RESULTADO FINAL', sum.label, sum.value, '']);
    formSheet.push(['', '', '', '']);
    formSheet.push(['⚠ Este es un papel de trabajo del contador.', '', '', '']);
    formSheet.push(['  NO se sube a DGII como archivo.', '', '', '']);
    formSheet.push(['  Transcribe los valores a Oficina Virtual', '', '', '']);
    formSheet.push(['  para presentar la declaración oficial.', '', '', '']);

    const ws1 = XLSX.utils.aoa_to_sheet(formSheet);
    ws1['!cols'] = [
      { wch: 9 },     // Casilla
      { wch: 48 },    // Concepto
      { wch: 18 },    // Monto
      { wch: 35 },    // Nota
    ];
    // Combinar header row 1 (NORMAIA) — A1:D1
    ws1['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    ];

    // ─── HOJA 2: Base legal ───────────────────────────────────
    const legalRows = [
      ['Base legal del cálculo'],
      [''],
      ['Fundamento', 'Norma', 'Resumen'],
    ];
    const legalMap = {
      it1: [
        ['ITBIS general', 'Art. 341 CT Ley 11-92', '18% sobre transferencias gravadas'],
        ['ITBIS reducido', 'Art. 343 párrafo I', '16% sobre productos específicos'],
        ['Exportaciones', 'Art. 343 párrafo II', 'Tasa 0%'],
        ['Crédito fiscal', 'Art. 346 CT', 'Compensación contra débito del mismo período'],
        ['Plazo declaración', 'Art. 353 CT', 'Día 20 del mes siguiente'],
      ],
      ir1: [
        ['Escala progresiva PF', 'Art. 296 CT', '0% / 15% / 20% / 25% sobre renta neta'],
        ['Exención anual', 'Art. 296 + Decreto 309-12', 'Mínimo no imponible RD$ 416,220'],
        ['Anticipos ISR', 'Art. 314 CT', '1.5% ingresos brutos o ISR año anterior'],
        ['Plazo declaración', 'Art. 110 CT', '31 de marzo (cierre dic anterior)'],
      ],
      ir2: [
        ['ISR Personas Jurídicas', 'Art. 297 CT', '27% sobre renta neta imponible'],
        ['Impuesto a los Activos', 'Ley 173-07 + Art. 401 CT', '1% sobre activos fijos depreciables'],
        ['Crédito por ISR', 'Art. 405 CT', 'Pagar el mayor entre ISR e Imp. Activos'],
        ['Plazo declaración', 'Art. 295 CT', '120 días post cierre fiscal'],
      ],
      ir17: [
        ['Honorarios profesionales', 'Norma 02-2005 + Art. 309', '10% ISR + 100% ITBIS retención'],
        ['Alquileres', 'Art. 309 lit. b)', '10% ISR + 100% ITBIS'],
        ['Pagos al exterior', 'Art. 305 CT', '27% (salvo CDI España/Canadá)'],
        ['Estado a proveedores', 'Norma 02-2005', '5% ISR + 100% ITBIS'],
        ['Dividendos', 'Art. 308 CT', '10% pago único sobre el bruto'],
      ],
      rst: [
        ['Régimen Simplificado', 'Decreto 265-19 + Norma 06-2021', 'Régimen opcional para MIPYMES'],
        ['Topes RST', 'Decreto 265-19 actualizado', 'Servicios RD$ 12,068,181.09 / Compras RD$ 55,485,890.09'],
        ['PJ Servicios', 'Decreto 265-19', '7% sobre ingresos brutos (ISR + ITBIS)'],
        ['PF Servicios', 'Decreto 265-19', 'Escala reducida 0/10/15/20% sobre ingresos'],
        ['4 cuotas trimestrales', 'Decreto 265-19', 'Mar/Abr · Jun · Sep · Dic'],
        ['Permanencia mínima', 'Decreto 265-19', '3 años en el régimen'],
      ],
    };
    (legalMap[formKey] || []).forEach(r => legalRows.push(r));
    legalRows.push(['']);
    legalRows.push(['Nota: Esta información es referencial.']);
    legalRows.push(['Consulta siempre la normativa vigente en dgii.gov.do o con un CPA certificado.']);

    const ws2 = XLSX.utils.aoa_to_sheet(legalRows);
    ws2['!cols'] = [{ wch: 32 }, { wch: 32 }, { wch: 48 }];

    // ─── HOJA 3: Instrucciones ─────────────────────────────────
    const instr = [
      [`Cómo presentar el ${form.title} en DGII`],
      [''],
      ['1.', 'Entra a https://oficinavirtual.dgii.gov.do con tu RNC y clave'],
      ['2.', 'Menú: Declaración Jurada → busca el formulario correspondiente'],
      ['3.', 'Selecciona el período fiscal a declarar'],
      ['4.', 'Transcribe los valores de la Hoja 1 a las casillas correspondientes'],
      ['5.', 'Verifica los totales calculados por la plataforma DGII'],
      ['6.', 'Firma electrónicamente y envía la declaración'],
      ['7.', 'Imprime el comprobante de envío para tu archivo'],
      [''],
      ['Pagos:'],
      ['', 'Si te queda saldo a pagar, DGII genera un volante con código de barras.'],
      ['', 'Puedes pagar en cualquier banco autorizado o vía portal bancario.'],
      [''],
      ['Plazos generales:'],
      ['', 'IT-1 (ITBIS): día 20 del mes siguiente'],
      ['', 'IR-3 / IR-17 (Retenciones): día 10 del mes siguiente'],
      ['', 'IR-1 (PF anual): 31 de marzo'],
      ['', 'IR-2 (PJ anual): 120 días post cierre fiscal'],
      ['', 'RST: 4 cuotas trimestrales (Mar/Abr · Jun · Sep · Dic)'],
      [''],
      ['Recargos por mora (Arts. 26-27 y 252 CT):'],
      ['', '10% el primer mes'],
      ['', '+ 4% por cada mes adicional'],
      ['', '+ 1.10% mensual de interés indemnizatorio'],
      [''],
      [`Generado por NormaIA · ${dateStr} · normaia.do`],
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(instr);
    ws3['!cols'] = [{ wch: 5 }, { wch: 80 }];

    // ─── ARMAR WORKBOOK Y DESCARGAR ────────────────────────────
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Formulario');
    XLSX.utils.book_append_sheet(wb, ws2, 'Base legal');
    XLSX.utils.book_append_sheet(wb, ws3, 'Instrucciones');

    const filename = `NormaIA_${form.title.replace(/\s+/g, '_')}_${isoDate}.xlsx`;
    XLSX.writeFile(wb, filename);
    window.app.showToast('📊 Papel de trabajo descargado', 'success', 3000);
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
      const role = m.classList.contains('msg-user') ? 'Usuario' : 'NormaIA';
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
