// auth.js
let sb = null;
let currentUser = null;
let userProfile = null;

// Traduce mensajes de error de Supabase a español
function translateAuthError(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Tu correo aún no está confirmado. Revisa tu bandeja de entrada.';
  if (m.includes('user already registered') || m.includes('already been registered')) return 'Este correo ya está registrado. Intenta iniciar sesión.';
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('unable to validate email')) return 'El formato del correo no es válido.';
  if (m.includes('rate limit')) return 'Demasiados intentos. Espera unos segundos e intenta de nuevo.';
  if (m.includes('signup') && m.includes('disabled')) return 'El registro por email está desactivado en este momento.';
  return msg || 'Ocurrió un error. Intenta de nuevo.';
}

function initSupabase() {
  try {
    sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // Implicit flow: el token llega directo en el hash (#access_token=...).
        // Evita el problema de "Chrome state deletion for intermediate sites"
        // (Bounce Tracking Mitigation) que afectaba al flow PKCE porque borraba
        // el code_verifier del localStorage de Supabase entre navegaciones.
        flowType: 'implicit',
        storage: window.localStorage,
        storageKey: 'normaia-auth-session',
      }
    });

    // Detectar si venimos de un callback OAuth (Google).
    // Implicit flow → token llega en hash: #access_token=...
    // (PKCE flow llegaba como ?code=... — mantenemos ambas detecciones por compat.)
    const url = new URL(window.location.href);
    const isOAuthCallback = url.hash.includes('access_token=') || url.searchParams.has('code');
    const hasOAuthError = url.searchParams.has('error');

    if (hasOAuthError) {
      // Mostrar error al usuario de forma visible
      console.warn('OAuth error:', url.searchParams.get('error_description') || url.searchParams.get('error'));
      setTimeout(() => {
        window.app?.showToast?.(
          'No se pudo completar el inicio de sesión con Google: ' +
          (url.searchParams.get('error_description') || url.searchParams.get('error')),
          'error',
          7000
        );
      }, 500);
      // Limpiar params de error de la URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    let initialAuthDone = false;

    async function resolveInitialAuth(session) {
      if (initialAuthDone) return;
      initialAuthDone = true;
      if (session?.user) {
        currentUser = session.user;
        await loadProfile();
        window.app.showLoggedIn();
      } else {
        window.app.showLoggedOut();
      }
    }

    sb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) resolveInitialAuth(session);
    }).catch(err => {
      console.warn('getSession error:', err);
    });

    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        resolveInitialAuth(session);
      } else if (event === 'SIGNED_IN') {
        if (!initialAuthDone) {
          resolveInitialAuth(session);
        } else {
          currentUser = session.user;
          await loadProfile();
          if (document.getElementById('app-console').style.display !== 'flex') {
            window.app.showLoggedIn();
          }
        }
        // Si veníamos de OAuth, limpiar la URL (query + hash) ahora que la sesión está establecida.
        // Implicit flow deja #access_token=... en el hash; PKCE dejaba ?code=... en query.
        if (isOAuthCallback) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      } else if (event === 'SIGNED_OUT') {
        initialAuthDone = false;
        currentUser = null;
        userProfile = null;
        window.app.showLoggedOut();
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Refresh silencioso — actualizar currentUser por si cambió
        currentUser = session.user;
      }
    });

    // Timeout de seguridad: si no recibimos INITIAL_SESSION o SIGNED_IN, asumir no logueado.
    // Más largo (12s) si venimos de OAuth callback — el code exchange puede tardar.
    const timeoutMs = isOAuthCallback ? 12000 : 5000;
    setTimeout(() => {
      if (!initialAuthDone) {
        initialAuthDone = true;
        window.app.showLoggedOut();
        if (isOAuthCallback) {
          window.app?.showToast?.(
            'El inicio de sesión tardó demasiado. Intenta de nuevo.',
            'error',
            5000
          );
        }
      }
    }, timeoutMs);

  } catch (e) {
    console.warn('Supabase init error:', e);
    window.app.showLoggedOut();
  }
}

async function loadProfile() {
  if (!sb || !currentUser) return;
  const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  if (data) {
    userProfile = data;
    window.app.updateUIWithProfile(userProfile);
  }
}

async function doLogin(email, pass) {
  if (!sb) throw new Error('Servicio no disponible');
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) throw new Error(translateAuthError(error.message));
}

async function doRegister(name, email, pass) {
  if (!sb) throw new Error('Servicio no disponible');
  const { data, error } = await sb.auth.signUp({
    email,
    password: pass,
    options: { data: { full_name: name } },
  });
  if (error) throw new Error(translateAuthError(error.message));
  // Si Supabase requiere confirmación de email, no hay session todavía
  return { needsConfirmation: !data.session, user: data.user };
}

async function doGoogleAuth() {
  if (!sb) {
    window.app?.showToast?.('Servicio de autenticación no disponible.', 'error');
    return;
  }
  try {
    // redirectTo debe coincidir EXACTAMENTE con una "Redirect URL" autorizada en Supabase
    // Dashboard → Authentication → URL Configuration. Usamos origin + '/' para evitar
    // ambigüedades entre "https://normaia.do" y "https://normaia.do/".
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) {
      console.error('signInWithOAuth error:', error);
      window.app?.showToast?.('No se pudo iniciar Google: ' + error.message, 'error', 6000);
    }
    // Si OK, el navegador será redirigido a Google. No hay que hacer nada más aquí.
  } catch (e) {
    console.error('doGoogleAuth exception:', e);
    window.app?.showToast?.('Error inesperado iniciando Google.', 'error');
  }
}

async function signOut() {
  if (sb) await sb.auth.signOut();
}

window.auth = {
  initSupabase,
  doLogin,
  doRegister,
  doGoogleAuth,
  signOut,
  getCurrentUser: () => currentUser,
  getUserProfile: () => userProfile,
  reloadProfile: loadProfile, // recargar perfil (útil después de cambio de plan)
  incrementQueryCount: async () => {
    if (!currentUser || !sb || !userProfile) return true;
    const limit = userProfile.queries_limit || CONFIG.PLAN_LIMITS[userProfile.plan || 'libre'];
    const used = (userProfile.queries_used || 0) + 1;
    if (used > limit) return false;
    await sb.from('profiles').update({ queries_used: used }).eq('id', currentUser.id);
    userProfile.queries_used = used;
    window.app.updateUIWithProfile(userProfile);
    return true;
  },
};
