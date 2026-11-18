// Quillstrike: Stripe tells us when a subscription starts, renews, fails or ends. Deploy with "Verify JWT" OFF.
// The Stripe signature on every request is checked below, so only Stripe can change a plan.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!, SK = Deno.env.get("STRIPE_SECRET_KEY")!;

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function valid(raw: string, header: string | null): Promise<boolean> {
  if (!header) return false;
  const t = header.split(",").find((p) => p.startsWith("t="))?.slice(2); const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mine = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)));
  return sigs.some((s) => s.length === mine.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ mine.charCodeAt(i)), 0) === 0);
}

async function apply(sub: any) {
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  let uid = sub.metadata?.user_id as string | undefined;
  let q = admin.from("profiles").select("id, plan");
  q = uid ? q.eq("id", uid) : q.eq("stripe_customer_id", customer);
  const { data: p } = await q.maybeSingle(); if (!p) { console.error("no profile for", customer, uid); return; }
  const live = ["active", "trialing", "past_due"].includes(sub.status);
  const patch: Record<string, unknown> = { stripe_customer_id: customer, stripe_subscription_id: sub.id, plan_status: sub.status, plan_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null };
  if (p.plan !== "bundle") patch.plan = live ? "pro" : "free"; // never touch Pro + Unlimited members
  const { error } = await admin.from("profiles").update(patch).eq("id", p.id); if (error) throw error;
}

Deno.serve(async (req) => {
  const raw = await req.text();
  if (!(await valid(raw, req.headers.get("Stripe-Signature")))) return new Response("bad signature", { status: 400 });
  const ev = JSON.parse(raw);
  try {
    if (ev.type === "checkout.session.completed" && ev.data.object.mode === "subscription" && ev.data.object.subscription) {
      const r = await fetch("https://api.stripe.com/v1/subscriptions/" + ev.data.object.subscription, { headers: { Authorization: "Bearer " + SK } });
      const sub = await r.json(); if (!r.ok) throw new Error("fetch subscription");
      if (!sub.metadata?.user_id && ev.data.object.client_reference_id) sub.metadata = { ...(sub.metadata || {}), user_id: ev.data.object.client_reference_id };
      await apply(sub);
    } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(ev.type)) {
      await apply(ev.data.object);
    }
  } catch (e) { console.error(e); return new Response("error", { status: 500 }); } // Stripe retries on 5xx
  return new Response("ok");
});
