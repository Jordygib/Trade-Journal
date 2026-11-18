// Quillstrike: starts a Stripe Checkout session for Pro. Leave "Verify JWT" OFF (the function checks the signed-in user itself).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const SK = Deno.env.get("STRIPE_SECRET_KEY")!, SITE = Deno.env.get("SITE_URL") || "https://quillstrike.com";

async function stripe(path: string, params: Record<string, string>) {
  const r = await fetch("https://api.stripe.com/v1/" + path, { method: "POST", headers: { Authorization: "Bearer " + SK, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
  const j = await r.json(); if (!r.ok) throw new Error(j?.error?.message || "Stripe error"); return j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: null };
  const user = u?.user; if (!user) return json({ error: "Please sign in first." }, 401);
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }
  const yearly = body.interval !== "monthly";
  const price = Deno.env.get(yearly ? "STRIPE_PRICE_YEARLY" : "STRIPE_PRICE_MONTHLY");
  if (!price) return json({ error: "Plans aren’t set up yet." }, 503);
  try {
    const { data: p } = await admin.from("profiles").select("plan, stripe_customer_id, stripe_subscription_id, plan_status").eq("id", user.id).maybeSingle();
    if (p?.plan === "bundle") return json({ error: "You already have Pro + Unlimited." }, 409);
    if (p?.plan === "pro" && p?.stripe_subscription_id && ["active", "trialing", "past_due"].includes(p?.plan_status || "")) return json({ error: "already_pro" }, 409);
    let customer = p?.stripe_customer_id as string | undefined;
    if (!customer) {
      const c = await stripe("customers", { email: user.email || "", "metadata[user_id]": user.id });
      customer = c.id; await admin.from("profiles").update({ stripe_customer_id: customer }).eq("id", user.id);
    }
    const params: Record<string, string> = {
      mode: "subscription", customer, client_reference_id: user.id, "line_items[0][price]": price, "line_items[0][quantity]": "1",
      allow_promotion_codes: "true", "subscription_data[metadata][user_id]": user.id,
      success_url: `${SITE}/settings.html?billing=success`, cancel_url: `${SITE}/pricing.html?billing=cancel`,
    };
    const trial = Number(Deno.env.get("STRIPE_TRIAL_DAYS") || 0); if (trial > 0) params["subscription_data[trial_period_days]"] = String(trial);
    const s = await stripe("checkout/sessions", params);
    return json({ url: s.url });
  } catch (e) { console.error(e); return json({ error: "Couldn’t start checkout. Please try again." }, 502); }
});
