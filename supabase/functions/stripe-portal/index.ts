// Quillstrike: opens the Stripe billing portal (cancel, change card, invoices). Leave "Verify JWT" OFF (checked inside).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const SK = Deno.env.get("STRIPE_SECRET_KEY")!, SITE = Deno.env.get("SITE_URL") || "https://quillstrike.com";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: null };
  if (!u?.user) return json({ error: "Please sign in first." }, 401);
  const { data: p } = await admin.from("profiles").select("stripe_customer_id").eq("id", u.user.id).maybeSingle();
  if (!p?.stripe_customer_id) return json({ error: "No billing account yet." }, 404);
  const r = await fetch("https://api.stripe.com/v1/billing_portal/sessions", { method: "POST", headers: { Authorization: "Bearer " + SK, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ customer: p.stripe_customer_id, return_url: `${SITE}/settings.html` }) });
  const j = await r.json(); if (!r.ok) { console.error(j); return json({ error: "Couldn’t open billing." }, 502); }
  return json({ url: j.url });
});
