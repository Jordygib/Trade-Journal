-- Quillstrike broker connections (SnapTrade OAuth). Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.
-- Tokens live ONLY here and are readable only by the server functions (service role). No policies = no access from the browser.
create table if not exists public.broker_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'snaptrade',
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  status text not null default 'active' check (status in ('active', 'needs_reconnect')),
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text
);
alter table public.broker_connections enable row level security;
revoke all on public.broker_connections from anon, authenticated;

create table if not exists public.broker_oauth_state (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  verifier text not null,
  created_at timestamptz not null default now()
);
alter table public.broker_oauth_state enable row level security;
revoke all on public.broker_oauth_state from anon, authenticated;
