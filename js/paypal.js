// js/paypal.js
// Integración PayPal Subscriptions — renderiza botones y maneja confirmación.

(function () {
  'use strict';

  let _renderedContainers = new Set(); // evita re-renderizar el mismo container

  // Renderiza un botón de suscripción en un container específico
  function renderButton(containerId, planKey) {
    if (!window.paypal) {
      console.warn('PayPal SDK no cargado');
      return;
    }
    if (!window.CONFIG?.PAYPAL_CONFIGURED) {
      // Plan IDs no configurados → mostrar mensaje
      const c = document.getElementById(containerId);
      if (c) {
        c.innerHTML = '<div style="text-align:center; padding:0.7rem; background:#FEF3C7; border:1px solid #FCD34D; border-radius:8px; font-size:0.78rem; color:#92400E;">⚠ PayPal pendiente de configurar (falta Plan ID)</div>';
      }
      return;
    }
    if (_renderedContainers.has(containerId)) return; // ya renderizado

    const planId = planKey === 'pro_max'
      ? window.CONFIG.PAYPAL_PLAN_PROMAX
      : window.CONFIG.PAYPAL_PLAN_PRO;

    const container = document.getElementById(containerId);
    if (!container) return;

    // Limpiar el placeholder
    container.innerHTML = '';

    try {
      window.paypal.Buttons({
        style: {
          shape: 'pill',
          color: 'blue',
          layout: 'vertical',
          label: 'subscribe',
          height: 45,
          tagline: false,
        },
        createSubscription: function (data, actions) {
          return actions.subscription.create({
            plan_id: planId,
          });
        },
        onApprove: async function (data) {
          // data.subscriptionID = ID que devuelve PayPal
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

            // Éxito: actualizar UI
            window.app.showToast('🎉 ¡Suscripción activada! Bienvenido al ' + (planKey === 'pro_max' ? 'Plan Pro Max' : 'Plan Pro'), 'success', 5000);
            window.app.closeModal('upgrade');

            // Recargar perfil de Supabase para ver el nuevo plan
            if (window.auth?.reloadProfile) {
              await window.auth.reloadProfile();
            }
          } catch (err) {
            console.error('PayPal confirm error:', err);
            window.app.showToast('Pago aprobado pero hubo un error al activar el plan. Contacta soporte con tu ID: ' + data.subscriptionID, 'error', 8000);
          }
        },
        onError: function (err) {
          console.error('PayPal error:', err);
          window.app.showToast('Error en PayPal. Intenta de nuevo.', 'error');
        },
        onCancel: function () {
          window.app.showToast('Pago cancelado.', 'info', 2500);
        },
      }).render('#' + containerId);

      _renderedContainers.add(containerId);
    } catch (e) {
      console.error('Error renderizando PayPal:', e);
      container.innerHTML = '<div style="text-align:center; padding:0.7rem; color:var(--danger); font-size:0.8rem;">⚠ No se pudo cargar PayPal</div>';
    }
  }

  // Inicializa los botones del modal de upgrade (Pro y Pro Max)
  function initUpgradeButtons() {
    // Esperar a que PayPal SDK esté disponible (puede tardar al cargarse async)
    if (!window.paypal) {
      let intentos = 0;
      const interval = setInterval(() => {
        intentos++;
        if (window.paypal) {
          clearInterval(interval);
          renderButton('upgrade-paypal-pro', 'pro');
          renderButton('upgrade-paypal-promax', 'pro_max');
        } else if (intentos > 50) { // 5 segundos de espera máxima
          clearInterval(interval);
          ['upgrade-paypal-pro', 'upgrade-paypal-promax'].forEach(id => {
            const c = document.getElementById(id);
            if (c) c.innerHTML = '<div style="text-align:center; padding:0.7rem; color:var(--danger); font-size:0.8rem;">⚠ PayPal SDK no se pudo cargar. Recarga la página.</div>';
          });
        }
      }, 100);
      return;
    }
    renderButton('upgrade-paypal-pro', 'pro');
    renderButton('upgrade-paypal-promax', 'pro_max');
  }

  // Para los botones del pricing del landing (público): redirigir a registro/login
  // No renderizamos PayPal ahí porque el usuario aún no está logueado
  function landingPricingClick(planKey) {
    const user = window.auth?.getCurrentUser?.();
    if (!user) {
      window.location.href = 'registro.html';
      return;
    }
    // Si ya está logueado, abrir el modal de upgrade
    window.app.showModal('upgrade');
  }

  window.payments = {
    initUpgradeButtons,
    landingPricingClick,
    _reset: () => _renderedContainers.clear(),
  };
})();
