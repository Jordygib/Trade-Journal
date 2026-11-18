-- Quillstrike paid plans (Stripe). Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists plan_status text;
alter table public.profiles add column if not exists plan_period_end timestamptz;
create unique index if not exists profiles_stripe_customer_idx on public.profiles (stripe_customer_id) where stripe_customer_id is not null;

-- Members must never be able to give themselves a paid plan. Only the server (service role) and the SQL Editor may change these columns.
create or replace function public.profiles_protect_billing() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.plan := 'free'; new.stripe_customer_id := null; new.stripe_subscription_id := null; new.plan_status := null; new.plan_period_end := null;
    else
      new.plan := old.plan; new.stripe_customer_id := old.stripe_customer_id; new.stripe_subscription_id := old.stripe_subscription_id;
      new.plan_status := old.plan_status; new.plan_period_end := old.plan_period_end;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_billing on public.profiles;
create trigger profiles_protect_billing before insert or update on public.profiles for each row execute function public.profiles_protect_billing();
