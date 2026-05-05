// auth.js
let sb = null;
let currentUser = null;
let userProfile = null;

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

  } catch(e) {
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
  if (!sb) return;
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) throw error;
}

async function doRegister(name, email, pass) {
  if (!sb) return;
  const { error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: name } } });
  if (error) throw error;
}

async function doGoogleAuth() {
  if (!sb) return;
  await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
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
  }
};
