-- Quillstrike new features: Plans, Session history, the Ask-your-journal daily limit, and the Position tracker.
-- Paste this whole script into Supabase → SQL Editor → New query, then click Run. Safe to run more than once.

-- 1) Plans (Plan vs. actual)
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  planned_for date not null default current_date,
  underlying text not null check (char_length(underlying) between 1 and 12),
  strategy text check (strategy is null or char_length(strategy) <= 20),
  max_loss numeric check (max_loss is null or max_loss >= 0),
  target numeric check (target is null or target >= 0),
  max_size integer check (max_size is null or max_size > 0),
  reason text check (reason is null or char_length(reason) <= 400),
  source text check (source is null or source in ('plans', 'session'))
);
create index if not exists plans_user_created_idx on public.plans (user_id, created_at desc);
alter table public.plans enable row level security;
drop policy if exists "plans: read own" on public.plans;
drop policy if exists "plans: add own" on public.plans;
drop policy if exists "plans: change own" on public.plans;
drop policy if exists "plans: delete own" on public.plans;
create policy "plans: read own" on public.plans for select to authenticated using (user_id = auth.uid());
create policy "plans: add own" on public.plans for insert to authenticated with check (user_id = auth.uid());
create policy "plans: change own" on public.plans for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "plans: delete own" on public.plans for delete to authenticated using (user_id = auth.uid());

-- 2) Trading sessions (Session mode history)
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  started_at timestamptz,
  ended_at timestamptz,
  pnl numeric not null default 0,
  trades integer not null default 0 check (trades >= 0),
  loss_cap numeric,
  max_trades integer,
  hit_cap boolean not null default false,
  breaks_taken integer not null default 0,
  tilt_dismissed integer not null default 0,
  overrides integer not null default 0,
  override_notes text[] not null default '{}',
  unique (user_id, day)
);
alter table public.sessions enable row level security;
drop policy if exists "sessions: read own" on public.sessions;
drop policy if exists "sessions: add own" on public.sessions;
drop policy if exists "sessions: change own" on public.sessions;
drop policy if exists "sessions: delete own" on public.sessions;
create policy "sessions: read own" on public.sessions for select to authenticated using (user_id = auth.uid());
create policy "sessions: add own" on public.sessions for insert to authenticated with check (user_id = auth.uid());
create policy "sessions: change own" on public.sessions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sessions: delete own" on public.sessions for delete to authenticated using (user_id = auth.uid());

-- 3) Ask your journal: questions used per day. Only the ask-journal function writes here.
create table if not exists public.ask_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, day)
);
alter table public.ask_usage enable row level security;
drop policy if exists "ask_usage: read own" on public.ask_usage;
create policy "ask_usage: read own" on public.ask_usage for select to authenticated using (user_id = auth.uid());

-- Adds one question to today's count and returns the new count, in a single safe step.
create or replace function public.ask_usage_bump(p_user uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.ask_usage (user_id, day, count) values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = public.ask_usage.count + 1
  returning count into n;
  return n;
end $$;
revoke all on function public.ask_usage_bump(uuid) from public, anon, authenticated;

-- 4) Position tracker (open positions you're tracking)
create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  underlying text not null check (char_length(underlying) between 1 and 12),
  strategy text check (strategy is null or char_length(strategy) <= 20),
  legs jsonb not null default '[]' check (jsonb_typeof(legs) = 'array' and jsonb_array_length(legs) <= 8),
  expiration date not null,
  entry_price numeric not null default 0,
  contracts integer not null default 1 check (contracts between 1 and 10000),
  iv numeric check (iv is null or (iv > 0 and iv < 5)),
  spot numeric check (spot is null or spot > 0),
  spot_at timestamptz,
  entry_spot numeric,
  alerts jsonb not null default '{}',
  trade_id uuid,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz
);
create index if not exists positions_user_status_idx on public.positions (user_id, status);
alter table public.positions enable row level security;
drop policy if exists "positions: read own" on public.positions;
drop policy if exists "positions: add own" on public.positions;
drop policy if exists "positions: change own" on public.positions;
drop policy if exists "positions: delete own" on public.positions;
create policy "positions: read own" on public.positions for select to authenticated using (user_id = auth.uid());
create policy "positions: add own" on public.positions for insert to authenticated with check (user_id = auth.uid());
create policy "positions: change own" on public.positions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "positions: delete own" on public.positions for delete to authenticated using (user_id = auth.uid());
