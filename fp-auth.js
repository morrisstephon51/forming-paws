// Forming Paws — shared client auth (Supabase, no SDK)
const FP = (() => {
  const URL = "https://wyzcnkdonbdykidmcxvx.supabase.co";
  const KEY = "sb_publishable_dI7lN4FdgEzJuid5r7whMw_Pxyx6OqG";
  const store = {
    get(){ try { return JSON.parse(localStorage.getItem("fp_session") || "null"); } catch(e){ return null; } },
    set(s){ try { localStorage.setItem("fp_session", JSON.stringify(s)); } catch(e){} },
    clear(){ try { localStorage.removeItem("fp_session"); } catch(e){} }
  };

  // Capture tokens arriving in the URL hash after email links (confirm / recovery)
  function captureHash(){
    const h = new URLSearchParams(location.hash.replace(/^#/, ""));
    if (!h.get("access_token")) {
      return h.get("error_description") ? { error: h.get("error_description") } : null;
    }
    const s = {
      access_token: h.get("access_token"),
      refresh_token: h.get("refresh_token"),
      expires_at: Math.floor(Date.now() / 1000) + parseInt(h.get("expires_in") || "3600", 10),
      type: h.get("type") || "signup"
    };
    store.set(s);
    history.replaceState(null, "", location.pathname + location.search);
    return s;
  }

  function saveTokens(d){
    const s = {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (d.expires_in || 3600)
    };
    store.set(s);
    return s;
  }

  async function getSession(){
    let s = store.get();
    if (!s || !s.access_token) return null;
    if (s.expires_at - 60 > Date.now() / 1000) return s;
    if (!s.refresh_token) { store.clear(); return null; }
    const r = await fetch(URL + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST", headers: { "Content-Type": "application/json", "apikey": KEY },
      body: JSON.stringify({ refresh_token: s.refresh_token })
    });
    if (!r.ok) { store.clear(); return null; }
    return saveTokens(await r.json());
  }

  async function login(email, password){
    const r = await fetch(URL + "/auth/v1/token?grant_type=password", {
      method: "POST", headers: { "Content-Type": "application/json", "apikey": KEY },
      body: JSON.stringify({ email, password })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error_description || d.msg || "Sign-in failed");
    saveTokens(d);
    return d;
  }

  function logout(){ store.clear(); location.href = "login.html"; }

  const headers = t => ({ "Content-Type": "application/json", "apikey": KEY, "Authorization": "Bearer " + t });

  async function api(path, opts = {}){
    const s = await getSession();
    if (!s) throw new Error("no-session");
    const r = await fetch(URL + path, Object.assign({}, opts, { headers: Object.assign(headers(s.access_token), opts.headers || {}) }));
    return r;
  }

  return { URL, KEY, store, captureHash, saveTokens, getSession, login, logout, headers, api };
})();
