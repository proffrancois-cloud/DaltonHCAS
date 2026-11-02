-- Application data is accessible only through the authenticated Edge API.
create table public.hcas_state (
  id integer primary key check (id = 1),
  revision bigint not null default 0,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create table public.hcas_accounts (
  auth_id uuid primary key references auth.users(id),
  account_id text not null unique,
  must_change_password boolean not null default true
);
create table public.hcas_audit (
  id bigint generated always as identity primary key,
  actor_id text not null,
  action text not null,
  resource_id text,
  created_at timestamptz not null default now()
);
alter table public.hcas_state enable row level security;
alter table public.hcas_accounts enable row level security;
alter table public.hcas_audit enable row level security;
revoke all on public.hcas_state, public.hcas_accounts, public.hcas_audit from anon, authenticated;
grant all on public.hcas_state, public.hcas_accounts, public.hcas_audit to service_role;
grant usage, select on sequence public.hcas_audit_id_seq to service_role;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hcas-iep', 'hcas-iep', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create or replace function private.hcas_due_goal_alerts() returns void
language plpgsql security definer set search_path = '' as $$
declare
  school jsonb; goal jsonb; alerts jsonb; recipients jsonb;
  notification_key text; changed boolean := false;
  school_today text := to_char(now() at time zone 'Asia/Taipei', 'YYYY-MM-DD');
begin
  select payload into school from public.hcas_state where id = 1 for update;
  if school is null then return; end if;
  alerts := coalesce(school->'notifications', '[]'::jsonb);
  for goal in select value from jsonb_array_elements(coalesce(school->'smartGoals', '[]'::jsonb)) loop
    if goal->>'status' = 'active' and goal->>'dueDate' <= school_today then
      notification_key := 'goal-due:' || (goal->>'id') || ':' || (goal->>'dueDate');
      if not exists (select 1 from jsonb_array_elements(alerts) a where a->>'key' = notification_key) then
        select jsonb_agg(distinct recipient) into recipients from (
          select t->>'id' as recipient from jsonb_array_elements(school->'teachers') t
            where t->>'role' in ('super-admin', 'teacher-supervising')
          union select goal->>'studentId'
        ) r;
        alerts := alerts || jsonb_build_array(jsonb_build_object(
          'key', notification_key, 'kind', 'goal-due', 'studentId', goal->>'studentId',
          'goalId', goal->>'id', 'recipientIds', recipients, 'readBy', '{}'::jsonb,
          'createdAt', (goal->>'dueDate') || 'T00:00:00+08:00'));
        changed := true;
      end if;
    end if;
  end loop;
  if changed then
    update public.hcas_state set payload = jsonb_set(school, '{notifications}', alerts),
      revision = revision + 1, updated_at = now() where id = 1;
  end if;
end;
$$;
revoke all on function private.hcas_due_goal_alerts() from public, anon, authenticated;
create extension if not exists pg_cron;
select cron.schedule('hcas-goal-deadlines', '*/15 * * * *', 'select private.hcas_due_goal_alerts()');
