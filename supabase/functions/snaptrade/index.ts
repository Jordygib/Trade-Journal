// Quillstrike broker functions (SnapTrade OAuth, read-only). Leave "Verify JWT" ON: only signed-in users call this.
// Actions (POST JSON {action}): status | start | sync | disconnect
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const URL_ = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CID = Deno.env.get("SNAPTRADE_CLIENT_ID")!, CSECRET = Deno.env.get("SNAPTRADE_CLIENT_SECRET")!;
const API = "https://api.snaptrade.com";

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rand = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));

async function userFrom(req: Request) {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  return data?.user || null;
}

async function freshToken(uid: string): Promise<{ token: string } | { error: string }> {
  const { data: c } = await admin.from("broker_connections").select("*").eq("user_id", uid).maybeSingle();
  if (!c) return { error: "not_connected" };
  if (c.status !== "active") return { error: "needs_reconnect" };
  if (new Date(c.expires_at).getTime() - Date.now() > 60_000) return { token: c.access_token };
  const r = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${CID}:${CSECRET}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: c.refresh_token }),
  });
  if (!r.ok) {
    const msg = await r.text(); console.error("refresh failed", r.status, msg);
    if (r.status === 400 || r.status === 401) await admin.from("broker_connections").update({ status: "needs_reconnect", last_error: "Refresh rejected" }).eq("user_id", uid);
    return { error: "needs_reconnect" };
  }
  const t = await r.json();
  await admin.from("broker_connections").update({ access_token: t.access_token, refresh_token: t.refresh_token || c.refresh_token, expires_at: new Date(Date.now() + (t.expires_in || 36000) * 1000).toISOString() }).eq("user_id", uid);
  return { token: t.access_token };
}

async function get(token: string, path: string, tries = 3): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(API + path, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (r.status === 429) { await new Promise((ok) => setTimeout(ok, (Number(r.headers.get("Retry-After")) || 2) * 1000)); continue; }
    if (r.status === 401 || r.status === 403) throw new Error("auth");
    if (!r.ok) throw new Error(`SnapTrade ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }
  throw new Error("SnapTrade is busy. Try again in a minute.");
}

const OPT_TYPES = new Set(["BUY", "SELL", "OPTIONEXPIRATION", "OPTIONASSIGNMENT", "OPTIONEXERCISE"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const user = await userFrom(req);
  if (!user) return json({ error: "Please sign in again." }, 401);
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }
  const action = body.action;

  if (action === "status") {
    const { data: c } = await admin.from("broker_connections").select("status, connected_at, last_sync_at, last_error").eq("user_id", user.id).maybeSingle();
    return json({ connected: !!c, ...(c || {}) });
  }

  if (action === "start") {
    const state = rand(24), verifier = rand(48);
    const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    await admin.from("broker_oauth_state").delete().lt("created_at", new Date(Date.now() - 3600_000).toISOString());
    const { error } = await admin.from("broker_oauth_state").insert({ state, user_id: user.id, verifier });
    if (error) return json({ error: "Could not start the connection." }, 500);
    const q = new URLSearchParams({ response_type: "code", client_id: CID, redirect_uri: `${URL_}/functions/v1/snaptrade-callback`, scope: "read", state, code_challenge: challenge, code_challenge_method: "S256" });
    return json({ url: `https://dashboard.snaptrade.com/oauth/authorize?${q}` });
  }

  if (action === "disconnect") {
    const { data: c } = await admin.from("broker_connections").select("refresh_token").eq("user_id", user.id).maybeSingle();
    if (c) {
      try { // best effort: tell SnapTrade to revoke
        await fetch(`${API}/oauth/revoke/`, { method: "POST", headers: { Authorization: "Basic " + btoa(`${CID}:${CSECRET}`), "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: c.refresh_token, token_type_hint: "refresh_token" }) });
      } catch (e) { console.error("revoke", e); }
    }
    await admin.from("broker_connections").delete().eq("user_id", user.id);
    return json({ ok: true });
  }

  if (action === "sync") {
    const t = await freshToken(user.id);
    if ("error" in t) return json({ error: t.error }, t.error === "not_connected" ? 404 : 409);
    const days = Math.min(Math.max(Number(body.days) || 400, 7), 1100);
    const start = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    try {
      const accounts = await get(t.token, "/accounts");
      const out: any[] = [];
      for (const a of (Array.isArray(accounts) ? accounts : accounts.data || [])) {
        let offset = 0;
        for (let page = 0; page < 30; page++) {
          const r = await get(t.token, `/accounts/${a.id}/activities?startDate=${start}&limit=1000&offset=${offset}`);
          const rows = r.data || [];
          for (const x of rows) {
            if (!x.option_symbol || !OPT_TYPES.has(x.type)) continue;
            const o = x.option_symbol;
            out.push({
              id: x.id, ref: x.external_reference_id || null, acct: a.id, type: x.type, ot: x.option_type || null,
              when: x.trade_date, ticker: (o.underlying_symbol && o.underlying_symbol.symbol) || o.ticker, right: o.option_type,
              strike: o.strike_price, exp: o.expiration_date, units: x.units, price: x.price, fee: x.fee || 0, mini: !!o.is_mini_option,
            });
          }
          offset += rows.length;
          if (!rows.length || offset >= (r.pagination?.total ?? 0)) break;
        }
      }
      await admin.from("broker_connections").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("user_id", user.id);
      return json({ activities: out, accounts: (Array.isArray(accounts) ? accounts : accounts.data || []).length, since: start });
    } catch (e) {
      const m = String((e as Error).message || e);
      if (m === "auth") { await admin.from("broker_connections").update({ status: "needs_reconnect", last_error: "Access was revoked" }).eq("user_id", user.id); return json({ error: "needs_reconnect" }, 409); }
      await admin.from("broker_connections").update({ last_error: m.slice(0, 300) }).eq("user_id", user.id);
      return json({ error: m }, 502);
    }
  }
  return json({ error: "Unknown action" }, 400);
});
