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
