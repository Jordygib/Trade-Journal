# Setting up the new Quillstrike features

## 1. Database (needed for Plans and Session history)
1. Open Supabase → your project → SQL Editor → New query.
2. Paste everything in `new-features.sql` and click Run.
3. You should see "Success. No rows returned." It is safe to run again.

## 2. Ask your journal AI helper (optional; the page works without it)
Without this step, Ask your journal uses its built-in question reader.

1. Create an account at console.anthropic.com, add billing, and create an API key.
2. In Supabase: Edge Functions → Secrets → add `ANTHROPIC_API_KEY` with your key.
   Optional secrets: `ASK_DAILY_LIMIT` (default 20 questions per user per day), `ASK_MODEL` (default claude-haiku-5-5).
3. Deploy the function. The easiest way without installing anything:
   Edge Functions → Deploy a new function → Via editor → name it exactly `ask-journal`,
   paste the contents of `functions/ask-journal/index.ts`, and click Deploy.
4. Leave "Verify JWT" turned on. Only signed-in users can ask.
5. Test it at quillstrike.com/ask.html. The note under each answer no longer says
   "by the built-in question reader" once the AI helper is answering.

Only the question and a list of your tickers, strategies and tags are sent to the AI. Trades never leave the browser.
Never put the API key in any file in the website or on GitHub.


## 3. Broker connection (SnapTrade OAuth, read-only)
1. SQL Editor → paste everything in `broker.sql` → Run. (Creates the private token tables.)
2. Edge Functions → Secrets → add `SNAPTRADE_CLIENT_ID` and `SNAPTRADE_CLIENT_SECRET` (from SnapTrade → OAuth Apps). Never put these in the website files or GitHub.
3. Edge Functions → Deploy a new function → Via editor:
   - Name `snaptrade`, paste `functions/snaptrade/index.ts`, leave **Verify JWT ON**, Deploy.
   - Name `snaptrade-callback`, paste `functions/snaptrade-callback/index.ts`, turn **Verify JWT OFF**, Deploy. (SnapTrade's redirect arrives with no login header; the one-time `state` value protects it.)
4. In SnapTrade → OAuth Apps → your app, the redirect URI must be exactly
   `https://oansdalmgvrhlkqpdhpv.supabase.co/functions/v1/snaptrade-callback`
5. Upload the website files to GitHub, open quillstrike.com/import.html, click **Connect broker**.


## 4. Paid plans (Stripe). Do this in Stripe TEST mode first.
1. Create a Stripe account at stripe.com (business type: individual / sole proprietor is fine; use your EIN). Stay in **Test mode** (toggle top right).
2. Product catalog → Add product "Quillstrike Pro". Add two recurring prices: **$14.99 / month** and **$150 / year**. Copy each price ID (starts with `price_`).
3. Settings → Billing → **Customer portal** → turn it on (allow cancel, update card, invoice history).
4. SQL Editor → paste `billing.sql` → Run.
5. Edge Functions → Secrets → add: `STRIPE_SECRET_KEY` (starts `sk_test_`), `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`. Optional: `STRIPE_TRIAL_DAYS` (for example 30 for a free first month).
6. Deploy three functions (file must be named `index.ts`, **Verify JWT OFF** for all three; each checks the user or the Stripe signature itself): `stripe-checkout`, `stripe-portal`, `stripe-webhook`.
7. Stripe → Developers → Webhooks → Add endpoint: URL `https://oansdalmgvrhlkqpdhpv.supabase.co/functions/v1/stripe-webhook`, events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy its signing secret (`whsec_`) into a Supabase secret `STRIPE_WEBHOOK_SECRET`.
8. In `vendor/config.js` set `billing: true`, upload to GitHub, and test with Stripe's test card 4242 4242 4242 4242 (any future date, any CVC). Your plan on Settings should change to Pro within seconds.
9. To go live: switch Stripe to Live mode, repeat steps 2, 3, 5 and 7 with live keys and prices, and replace the secrets.
