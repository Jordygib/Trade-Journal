// Quillstrike: where SnapTrade sends the trader back after they approve. Deploy with "Verify JWT" turned OFF
// (the browser arrives here from SnapTrade without a Quillstrike login header). Safety comes from the one-time `state` value.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE = Deno.env.get("SITE_URL") || "https://quillstrike.com";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function back(result: string) {
  return new Response(null, { status: 302, headers: { Location: `${SITE}/import.html?broker=${result}`, "Cache-Control": "no-store" } });
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const code = u.searchParams.get("code"), state = u.searchParams.get("state");
  if (u.searchParams.get("error") || !code || !state) return back("denied");
  const { data: st } = await admin.from("broker_oauth_state").select("*").eq("state", state).maybeSingle();
  if (!st) return back("expired");
  await admin.from("broker_oauth_state").delete().eq("state", state); // one use only
  if (Date.now() - new Date(st.created_at).getTime() > 15 * 60 * 1000) return back("expired");

  const id = Deno.env.get("SNAPTRADE_CLIENT_ID")!, secret = Deno.env.get("SNAPTRADE_CLIENT_SECRET")!;
  const redirect = `${Deno.env.get("SUPABASE_URL")}/functions/v1/snaptrade-callback`;
  const res = await fetch("https://api.snaptrade.com/oauth/token/", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${id}:${secret}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: st.verifier, redirect_uri: redirect }),
  });
  if (!res.ok) { console.error("token exchange failed", res.status, await res.text()); return back("error"); }
  const t = await res.json();
  const { error } = await admin.from("broker_connections").upsert({
    user_id: st.user_id, provider: "snaptrade", access_token: t.access_token, refresh_token: t.refresh_token,
    expires_at: new Date(Date.now() + (t.expires_in || 36000) * 1000).toISOString(), scope: t.scope || "read",
    status: "active", connected_at: new Date().toISOString(), last_error: null,
  });
  if (error) { console.error(error); return back("error"); }
  return back("connected");
});
