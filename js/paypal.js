// js/paypal.js
// Integración PayPal Subscriptions — renderiza botones y maneja confirmación.
// Optimizaciones de UX:
//  1. Pre-render automático tan pronto el SDK + containers estén listos.
//  2. Skeleton placeholder visible inmediatamente al abrir el modal.
//  3. Estado is-ready que limpia el skeleton cuando los botones aparecen.

(function () {
  'use strict';

  const _renderedContainers = new Set();
  let _sdkReady = false;
  let _sdkWaiting = null;   // Promise compartida que resuelve cuando SDK está listo
  let _preRenderTried = false;

  // Espera al SDK con poll cada 80ms, máx 8s. Memoiza la promesa.
  function whenSdkReady() {
    if (_sdkReady) return Promise.resolve(true);
    if (_sdkWaiting) return _sdkWaiting;
    _sdkWaiting = new Promise((resolve) => {
      if (window.paypal) {
        _sdkReady = true;
        return resolve(true);
      }
      let tries = 0;
      const iv = setInterval(() => {
        tries++;
        if (window.paypal) {
          clearInterval(iv);
          _sdkReady = true;
          resolve(true);
        } else if (tries > 100) {  // 8 segundos
          clearInterval(iv);
          resolve(false);
        }
      }, 80);
    });
    return _sdkWaiting;
  }

  function setSlotError(containerId, message) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.classList.remove('is-ready');
    c.innerHTML = `<div style="text-align:center; padding:0.7rem; background:oklch(from var(--warn) l c h / .12); border:1px solid oklch(from var(--warn) l c h / .35); border-radius:8px; font-size:0.78rem; color:var(--warn);">${message}</div>`;
  }

  // Renderiza un botón de suscripción en un container específico
  function renderButton(containerId, planKey) {
    if (!window.paypal) return false;
    if (!window.CONFIG?.PAYPAL_CONFIGURED) {
      setSlotError(containerId, '⚠ PayPal pendiente de configurar (falta Plan ID)');
      return false;
    }
    if (_renderedContainers.has(containerId)) return true; // ya renderizado

    const planId = planKey === 'pro_max'
      ? window.CONFIG.PAYPAL_PLAN_PROMAX
      : window.CONFIG.PAYPAL_PLAN_PRO;

    const container = document.getElementById(containerId);
    if (!container) return false;

    // El container DEBE ser visible (offsetParent != null) para que PayPal renderice.
    // Si no, marcamos como pendiente y volvemos a intentar cuando se abra el modal.
    if (!container.offsetParent) {
      return false;
    }

    // Limpiar el skeleton (los hijos serán reemplazados por el iframe de PayPal)
    container.innerHTML = '';

    try {
      window.paypal.Buttons({
        style: {
          shape: 'pill',
          color: 'gold',
          layout: 'vertical',
          label: 'subscribe',
          height: 42,
        },
        createSubscription: function (data, actions) {
          return actions.subscription.create({ plan_id: planId });
        },
        onApprove: async function (data) {
          const user = window.auth?.getCurrentUser?.();
          if (!user) {
            window.app.showToast('Tu sesión expiró. Inicia sesión de nuevo.', 'error');
            return;
          }
          window.app.showToast('Verificando pago con PayPal...', 'info', 3000);
          try {
            const res = await fetch('/api/paypal-confirm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscriptionID: data.subscriptionID,
                userId: user.id,
                userEmail: user.email,
                planKey,
              }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || `Error ${res.status}`);
            window.app.showToast(
              '🎉 ¡Suscripción activada! Bienvenido al ' + (planKey === 'pro_max' ? 'Plan Pro Max' : 'Plan Pro'),
              'success', 5000
            );
            window.app.closeModal('upgrade');
            if (window.auth?.reloadProfile) await window.auth.reloadProfile();
          } catch (err) {
            console.error('PayPal confirm error:', err);
            window.app.showToast(
              'Pago aprobado pero hubo un error al activar el plan. Contacta soporte con tu ID: ' + data.subscriptionID,
              'error', 8000
            );
          }
        },
        onError: function (err) {
          console.error('PayPal error:', err);
          window.app.showToast('Error en PayPal. Intenta de nuevo.', 'error');
        },
        onCancel: function () {
          window.app.showToast('Pago cancelado.', 'info', 2500);
        },
      }).render('#' + containerId).then(() => {
        // Render completo → quitar el min-height del skeleton
        container.classList.add('is-ready');
      }).catch(err => {
        console.error('Error renderizando PayPal:', err);
        setSlotError(containerId, '⚠ No se pudo cargar PayPal. Recarga la página.');
      });

      _renderedContainers.add(containerId);
      return true;
    } catch (e) {
      console.error('Error renderizando PayPal:', e);
      setSlotError(containerId, '⚠ No se pudo cargar PayPal');
      return false;
    }
  }

  // Inicializa los botones del modal de upgrade — versión async, sin polling propio.
  async function initUpgradeButtons() {
    const ok = await whenSdkReady();
    if (!ok) {
      ['upgrade-paypal-pro', 'upgrade-paypal-promax'].forEach(id => {
        setSlotError(id, '⚠ PayPal SDK no se pudo cargar. Recarga la página.');
      });
      return;
    }
    // Render en el siguiente tick para que el modal esté ya visible
    requestAnimationFrame(() => {
      renderButton('upgrade-paypal-pro', 'pro');
      renderButton('upgrade-paypal-promax', 'pro_max');
    });
  }

  // Para los botones del pricing del landing (público): redirigir a registro/login
  function landingPricingClick(planKey) {
    const user = window.auth?.getCurrentUser?.();
    if (!user) {
      window.location.href = 'registro.html';
      return;
    }
    window.app.showModal('upgrade');
  }

  // ═══ Pre-warm del SDK ═══
  // En cuanto el SDK esté listo, marcamos _sdkReady para que initUpgradeButtons
  // resuelva instantáneamente cuando el usuario abra el modal.
  whenSdkReady().then(ok => {
    if (ok) {
      // Pre-warm completado. Si el usuario abre el modal ahora, renderiza ya.
      console.debug('PayPal SDK ready (pre-warm complete)');
    }
  });

  window.payments = {
    initUpgradeButtons,
    landingPricingClick,
    _reset: () => _renderedContainers.clear(),
  };
})();
