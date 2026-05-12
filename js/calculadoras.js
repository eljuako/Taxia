// calculadoras.js

function fmtRD(n) {
  return 'RD$ ' + Math.abs(n).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcImpuestoProg(renta, tabla) {
  for (let i = tabla.length - 1; i >= 0; i--) {
    const tramo = tabla[i];
    if (renta > tramo.desde) {
      return +(tramo.base + (renta - tramo.desde) * tramo.tasa).toFixed(2);
    }
  }
  return 0;
}

const TABLA_IR1_2024 = [
  { desde: 0,       tasa: 0,    base: 0     },
  { desde: 416220,  tasa: 0.15, base: 0     },
  { desde: 624329,  tasa: 0.20, base: 31216 },
  { desde: 867123,  tasa: 0.25, base: 79776 },
];

function runCalc(type) {
  let result = '';
  if (type === 'itbis') {
    const cobrado = parseFloat(document.getElementById('itbis-cobrado').value) || 0;
    const pagado = parseFloat(document.getElementById('itbis-pagado').value) || 0;
    const aPagar = cobrado - pagado;
    result = `<strong>ITBIS a pagar:</strong> ${fmtRD(aPagar)}`;
  } else if (type === 'ir1') {
    const ingresos = parseFloat(document.getElementById('ir1-ingresos').value) || 0;
    const gastos = parseFloat(document.getElementById('ir1-gastos').value) || 0;
    const rentaNeta = Math.max(0, ingresos - gastos);
    const impuesto = calcImpuestoProg(rentaNeta, TABLA_IR1_2024);
    result = `<strong>Renta Neta:</strong> ${fmtRD(rentaNeta)}<br><strong>IR-1 a pagar:</strong> ${fmtRD(impuesto)}`;
  } else if (type === 'rst') {
    const ingresos = parseFloat(document.getElementById('rst-ingresos').value) || 0;
    const tipo = document.getElementById('rst-tipo').value;
    // Tasas RST (referenciales — validar con norma DGII vigente):
    // Comercial / Industrial: 2%, Servicios: 5%
    const tasa = tipo === 'servicios' ? 0.05 : 0.02;
    const cuotaAnual = ingresos * tasa;
    const cuotaMensual = cuotaAnual / 12;
    result = `<strong>Cuota anual RST:</strong> ${fmtRD(cuotaAnual)}<br><strong>Equivalente mensual:</strong> ${fmtRD(cuotaMensual)}<br><small style="opacity:0.75; font-weight:normal;">⚠️ Cifra estimada. Confirma la tasa vigente en la norma DGII.</small>`;
  }

  document.getElementById('calc-result').innerHTML = `
    <div style="padding:1rem; background:rgba(16,185,129,0.1); border:1px solid var(--success); border-radius:8px; margin-top:1rem; color:var(--text-main); line-height:1.6;">
      ${result}
    </div>`;
}

window.calc = { runCalc };
