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
        flowType: 'pkce'
      }
    });

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
      } else if (event === 'SIGNED_OUT') {
        initialAuthDone = false;
        currentUser = null;
        userProfile = null;
        window.app.showLoggedOut();
      }
    });

    setTimeout(() => {
      if (!initialAuthDone) {
        initialAuthDone = true;
        window.app.showLoggedOut();
      }
    }, 5000);

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
  if (!sb) return;
  await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
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
