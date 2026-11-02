-- Private transport data. All browser access goes through the authenticated API.
create table public.hcas_push_config (id integer primary key check(id=1), public_key text not null, private_key text not null, worker_token text not null);
create table public.hcas_push_subscriptions (
  id uuid primary key default gen_random_uuid(), account_id text not null,
  endpoint text not null unique, subscription jsonb not null, enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.hcas_push_outbox (
  id uuid primary key default gen_random_uuid(), subscription_id uuid not null references public.hcas_push_subscriptions(id) on delete cascade,
  account_id text not null, notification_key text not null, notice_id uuid not null,
  status text not null default 'pending', attempts integer not null default 0,
  available_at timestamptz not null default now(), claimed_at timestamptz, delivered_at timestamptz, last_status integer,
  unique(subscription_id,account_id,notification_key)
);
create index hcas_push_pending on public.hcas_push_outbox(available_at) where status in ('pending','sending');
alter table public.hcas_push_config enable row level security;
alter table public.hcas_push_subscriptions enable row level security;
alter table public.hcas_push_outbox enable row level security;
revoke all on public.hcas_push_config,public.hcas_push_subscriptions,public.hcas_push_outbox from public,anon,authenticated;
grant all on public.hcas_push_config,public.hcas_push_subscriptions,public.hcas_push_outbox to service_role;

-- Invoker permissions plus deny-all RLS prevent client access to queue claims.
create or replace function public.hcas_claim_push() returns setof public.hcas_push_outbox
language plpgsql set search_path='' as $$
begin
  update public.hcas_push_outbox set status='failed'
    where status='sending' and attempts>=6 and claimed_at<now()-interval '5 minutes';
  return query update public.hcas_push_outbox set status='sending',claimed_at=now(),attempts=attempts+1
  where id in (select id from public.hcas_push_outbox
    where (status='pending' and available_at<=now() or status='sending' and claimed_at<now()-interval '5 minutes') and attempts<6
    order by available_at for update skip locked limit 25)
  returning *;
end;
$$;
revoke all on function public.hcas_claim_push() from public,anon,authenticated;
grant execute on function public.hcas_claim_push() to service_role;

-- The same application rules run for interactive requests and scheduled dates.
create extension if not exists pg_net;
create or replace function private.hcas_run_followups() returns void
language plpgsql security definer set search_path='' as $$
declare secret text;
begin
  select worker_token into secret from public.hcas_push_config where id=1;
  if secret is null then return; end if;
  perform net.http_post(url:='https://zfedznaybchtukxjbdqt.supabase.co/functions/v1/hcas-api',
    headers:=jsonb_build_object('Content-Type','application/json','x-hcas-worker',secret),
    body:='{"action":"scheduled-followups"}'::jsonb,timeout_milliseconds:=10000);
end;
$$;
revoke all on function private.hcas_run_followups() from public,anon,authenticated;
select cron.unschedule(jobid) from cron.job where jobname='hcas-goal-deadlines';
select cron.schedule('hcas-followups-and-push','* * * * *','select private.hcas_run_followups()');
