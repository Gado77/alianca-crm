-- Aliança CRM
-- Persistence, authentication authorization, RLS, audit and timeline foundation.
-- Review before applying to a real Supabase project.

create extension if not exists "pgcrypto";

do $$
begin
  create type public.user_role as enum ('admin', 'vendedor');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.lead_status as enum (
    'novo_lead',
    'aguardando_simulacao',
    'simulacao_realizada',
    'aguardando_cliente',
    'aprovado',
    'documentacao',
    'venda_finalizada',
    'perdido'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.lead_temperature as enum ('frio', 'morno', 'quente', 'perdido');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.lead_source as enum (
    'instagram',
    'facebook',
    'loja',
    'indicacao',
    'whatsapp',
    'evento',
    'site',
    'google',
    'manual',
    'outro'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_method as enum (
    'financiamento',
    'cartao',
    'a_vista',
    'consorcio',
    'outro'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.timeline_event_type as enum (
    'lead_created',
    'status_changed',
    'assigned_user_changed',
    'simulation_created',
    'simulation_corrected',
    'follow_up_scheduled',
    'follow_up_completed',
    'follow_up_postponed',
    'follow_up_updated',
    'note_added',
    'whatsapp_opened',
    'lead_lost',
    'sale_finished'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.simulation_result as enum ('pendente', 'aprovado', 'negado');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.follow_up_status as enum ('pendente', 'concluido', 'adiado', 'cancelado');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.follow_up_priority as enum ('baixa', 'media', 'alta', 'urgente');
exception when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.only_digits(value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(value, ''), '\D', '', 'g'), '');
$$;

create or replace function public.normalize_lead_contact()
returns trigger
language plpgsql
as $$
begin
  new.cpf = public.only_digits(new.cpf);
  new.phone = public.only_digits(new.phone);
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'vendedor',
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  cpf text not null,
  birth_date date,
  phone text not null,
  city text not null,
  email text,
  has_driver_license boolean not null default false,
  license_category text not null default 'nao_possui'
    check (license_category in ('a', 'ab', 'nao_possui')),
  status public.lead_status not null default 'novo_lead',
  temperature public.lead_temperature not null default 'morno',
  opportunity_score integer not null default 0 check (opportunity_score between 0 and 100),
  assigned_user_id uuid references public.profiles(id),
  active boolean not null default true,
  lost_reason text,
  source public.lead_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_contact_at timestamptz,
  constraint leads_cpf_digits check (cpf ~ '^\d{11}$'),
  constraint leads_phone_digits check (phone ~ '^\d{10,13}$')
);

create table if not exists public.lead_interests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  motorcycle_model text not null,
  desired_color text,
  intended_down_payment numeric(12,2),
  payment_method public.payment_method not null default 'financiamento',
  other_payment_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.banks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.simulations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  simulation_date date not null default current_date,
  bank_id uuid not null references public.banks(id),
  result public.simulation_result not null default 'pendente',
  denial_reason text,
  bank_response_code text,
  bank_response text,
  credit_score integer,
  proposed_down_payment numeric(12,2),
  approved_amount numeric(12,2),
  installment_count integer,
  installment_value numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint simulations_denial_reason_required check (
    result <> 'negado' or denial_reason is not null
  )
);

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  assigned_user_id uuid not null references public.profiles(id),
  reason text not null,
  due_at timestamptz not null,
  priority public.follow_up_priority not null default 'media',
  status public.follow_up_status not null default 'pendente',
  completed_at timestamptz,
  completion_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint follow_up_completion_required check (
    status <> 'concluido' or completed_at is not null
  )
);

create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_timeline_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type public.timeline_event_type not null,
  title text not null,
  description text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  previous_status public.lead_status,
  new_status public.lead_status not null,
  changed_by uuid references public.profiles(id),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value_json jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_active_idx on public.profiles(active);

create index if not exists leads_cpf_idx on public.leads(cpf);
create index if not exists leads_phone_idx on public.leads(phone);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_assigned_user_id_idx on public.leads(assigned_user_id);
create index if not exists leads_city_idx on public.leads(city);
create index if not exists leads_last_contact_at_idx on public.leads(last_contact_at);

create index if not exists lead_interests_lead_id_idx on public.lead_interests(lead_id);
create index if not exists lead_interests_motorcycle_model_idx on public.lead_interests(motorcycle_model);

create index if not exists banks_active_idx on public.banks(active);
create index if not exists banks_name_idx on public.banks(name);
create index if not exists simulations_lead_id_idx on public.simulations(lead_id);
create index if not exists simulations_created_by_idx on public.simulations(created_by);
create index if not exists simulations_bank_id_idx on public.simulations(bank_id);
create index if not exists simulations_result_idx on public.simulations(result);
create index if not exists simulations_last_by_lead_idx on public.simulations(lead_id, simulation_date desc, created_at desc);

create index if not exists follow_ups_lead_id_idx on public.follow_ups(lead_id);
create index if not exists follow_ups_assigned_user_id_idx on public.follow_ups(assigned_user_id);
create index if not exists follow_ups_due_at_idx on public.follow_ups(due_at);
create index if not exists follow_ups_status_due_at_idx on public.follow_ups(status, due_at);

create index if not exists lead_notes_lead_id_idx on public.lead_notes(lead_id);
create index if not exists lead_timeline_events_lead_id_created_at_idx on public.lead_timeline_events(lead_id, created_at desc);
create index if not exists lead_status_history_lead_id_created_at_idx on public.lead_status_history(lead_id, created_at desc);
create index if not exists activity_logs_user_id_created_at_idx on public.activity_logs(user_id, created_at desc);
create index if not exists activity_logs_entity_idx on public.activity_logs(entity_type, entity_id);

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p
  from public.profiles p
  where p.id = auth.uid()
    and p.active = true;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.active = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role = 'admin'
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
  );
$$;

create or replace function public.can_access_lead(target_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user()
    and (
      public.is_admin()
      or exists (
        select 1
        from public.leads l
        where l.id = target_lead_id
          and l.assigned_user_id = auth.uid()
          and l.active = true
      )
    );
$$;

create or replace function public.safe_activity_metadata(metadata jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(metadata, '{}'::jsonb) - 'cpf' - 'phone' - 'birth_date' - 'token' - 'access_token' - 'refresh_token';
$$;

create or replace function public.find_potential_duplicate_leads(input_cpf text, input_phone text)
returns table (
  id uuid,
  full_name text,
  masked_cpf text,
  masked_phone text,
  city text,
  status public.lead_status,
  duplicate_reason text
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select public.only_digits(input_cpf) as cpf, public.only_digits(input_phone) as phone
  )
  select
    l.id,
    l.full_name,
    '***.***.***-**' as masked_cpf,
    case
      when length(l.phone) >= 4 then repeat('*', greatest(length(l.phone) - 4, 0)) || right(l.phone, 4)
      else '****'
    end as masked_phone,
    l.city,
    l.status,
    concat_ws(
      ', ',
      case when l.cpf = n.cpf then 'cpf' end,
      case when l.phone = n.phone then 'telefone' end
    ) as duplicate_reason
  from public.leads l
  cross join normalized n
  where l.active = true
    and public.can_access_lead(l.id)
    and (
      (n.cpf is not null and l.cpf = n.cpf)
      or (n.phone is not null and l.phone = n.phone)
    );
$$;

create or replace function public.add_activity_log(
  entity_type text,
  entity_id uuid,
  action text,
  metadata_json jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_logs(user_id, entity_type, entity_id, action, metadata_json)
  values (auth.uid(), entity_type, entity_id, action, public.safe_activity_metadata(metadata_json));
end;
$$;

create or replace function public.add_timeline_event(
  lead_id uuid,
  event_type public.timeline_event_type,
  title text,
  description text default null,
  metadata_json jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lead_timeline_events(
    lead_id,
    actor_id,
    event_type,
    title,
    description,
    metadata_json
  )
  values (
    lead_id,
    auth.uid(),
    event_type,
    title,
    description,
    public.safe_activity_metadata(metadata_json)
  );
end;
$$;

create or replace function public.audit_lead_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.add_timeline_event(new.id, 'lead_created'::public.timeline_event_type, 'Lead criado', 'Lead cadastrado no CRM.');
    perform public.add_activity_log('lead', new.id, 'created', jsonb_build_object('source', new.source));
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.lead_status_history(lead_id, previous_status, new_status, changed_by, reason)
    values (new.id, old.status, new.status, auth.uid(), new.lost_reason);

    if new.status = 'perdido' then
      perform public.add_timeline_event(
        new.id,
        'lead_lost'::public.timeline_event_type,
        'Lead marcado como perdido',
        new.lost_reason,
        jsonb_build_object('previous_status', old.status, 'new_status', new.status)
      );
    elsif new.status = 'venda_finalizada' then
      perform public.add_timeline_event(
        new.id,
        'sale_finished'::public.timeline_event_type,
        'Venda finalizada',
        'Lead convertido em venda.',
        jsonb_build_object('previous_status', old.status, 'new_status', new.status)
      );
    else
      perform public.add_timeline_event(
        new.id,
        'status_changed'::public.timeline_event_type,
        'Status alterado',
        'Status alterado de ' || old.status::text || ' para ' || new.status::text || '.',
        jsonb_build_object('previous_status', old.status, 'new_status', new.status)
      );
    end if;
  end if;

  if old.assigned_user_id is distinct from new.assigned_user_id then
    perform public.add_timeline_event(
      new.id,
      'assigned_user_changed'::public.timeline_event_type,
      'Responsável alterado',
      'Responsável pelo lead foi atualizado.',
      jsonb_build_object('previous_assigned_user_id', old.assigned_user_id, 'new_assigned_user_id', new.assigned_user_id)
    );
  end if;

  perform public.add_activity_log('lead', new.id, 'updated', jsonb_build_object('status', new.status));
  return new;
end;
$$;

create or replace function public.validate_lead_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role public.user_role;
begin
  role := public.current_user_role();

  if role = 'admin' then
    return new;
  end if;

  if role is distinct from 'vendedor' then
    raise exception 'Usuário sem permissão para alterar lead.';
  end if;

  if old.assigned_user_id is distinct from new.assigned_user_id then
    raise exception 'Vendedor não pode alterar responsável do lead.';
  end if;

  if old.active is distinct from new.active then
    raise exception 'Vendedor não pode ativar ou desativar lead.';
  end if;

  if old.lost_reason is distinct from new.lost_reason or new.status = 'perdido' then
    raise exception 'Vendedor não pode marcar lead como perdido.';
  end if;

  if old.status is distinct from new.status then
    if not (
      (old.status = 'novo_lead' and new.status in ('aguardando_simulacao', 'aguardando_cliente'))
      or (old.status = 'aguardando_simulacao' and new.status in ('simulacao_realizada', 'aguardando_cliente'))
      or (old.status = 'simulacao_realizada' and new.status in ('aguardando_cliente', 'aprovado'))
      or (old.status = 'aguardando_cliente' and new.status in ('aguardando_simulacao', 'simulacao_realizada', 'aprovado'))
      or (old.status = 'aprovado' and new.status = 'documentacao')
      or (old.status = 'documentacao' and new.status = 'venda_finalizada')
    ) then
      raise exception 'Transição de status não permitida para vendedor.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.audit_simulation_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bank_name text;
  lead_assigned_user_id uuid;
begin
  select b.name into bank_name
  from public.banks b
  where b.id = new.bank_id;

  select l.assigned_user_id into lead_assigned_user_id
  from public.leads l
  where l.id = new.lead_id;

  perform public.add_timeline_event(
    new.lead_id,
    'simulation_created'::public.timeline_event_type,
    'Simulação criada',
    'Simulação registrada em ' || coalesce(bank_name, 'banco não identificado') || ' com resultado ' || new.result::text || '.',
    jsonb_build_object(
      'simulation_id', new.id,
      'bank_id', new.bank_id,
      'bank_name', bank_name,
      'result', new.result,
      'denial_reason', new.denial_reason,
      'bank_response_code', new.bank_response_code,
      'bank_response', new.bank_response
    )
  );

  perform public.add_activity_log(
    'simulation',
    new.id,
    'created',
    jsonb_build_object('lead_id', new.lead_id, 'bank_id', new.bank_id, 'result', new.result)
  );

  if new.result = 'negado' and lead_assigned_user_id is not null then
    insert into public.follow_ups(lead_id, assigned_user_id, reason, due_at, priority, status)
    values (
      new.lead_id,
      lead_assigned_user_id,
      'Retorno de simulacao negada: ' || new.denial_reason,
      now() + interval '2 days',
      'alta',
      'pendente'
    );
  end if;

  return new;
end;
$$;

create or replace function public.audit_simulation_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.add_activity_log(
    'simulation',
    new.id,
    'corrected',
    jsonb_build_object('lead_id', new.lead_id, 'previous_result', old.result, 'new_result', new.result)
  );
  perform public.add_timeline_event(
    new.lead_id,
    'simulation_corrected'::public.timeline_event_type,
    'Simulação corrigida',
    'Correção registrada sem apagar o histórico.',
    jsonb_build_object('simulation_id', new.id)
  );
  return new;
end;
$$;

create or replace function public.audit_follow_up_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_name public.timeline_event_type;
  event_title text;
begin
  if tg_op = 'INSERT' then
    event_name := 'follow_up_scheduled'::public.timeline_event_type;
    event_title := 'Retorno agendado';
  elsif old.status is distinct from new.status and new.status = 'concluido' then
    event_name := 'follow_up_completed'::public.timeline_event_type;
    event_title := 'Retorno concluído';
  elsif old.status is distinct from new.status and new.status = 'adiado' then
    event_name := 'follow_up_postponed'::public.timeline_event_type;
    event_title := 'Retorno adiado';
  else
    event_name := 'follow_up_updated'::public.timeline_event_type;
    event_title := 'Retorno atualizado';
  end if;

  perform public.add_timeline_event(
    new.lead_id,
    event_name,
    event_title,
    new.reason,
    jsonb_build_object('follow_up_id', new.id, 'due_at', new.due_at, 'status', new.status)
  );

  perform public.add_activity_log('follow_up', new.id, event_name::text, jsonb_build_object('lead_id', new.lead_id, 'status', new.status));
  return new;
end;
$$;

create or replace function public.audit_note_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.add_timeline_event(new.lead_id, 'note_added'::public.timeline_event_type, 'Observação adicionada', null, jsonb_build_object('note_id', new.id));
  perform public.add_activity_log('lead_note', new.id, 'created', jsonb_build_object('lead_id', new.lead_id));
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists leads_normalize_contact on public.leads;
create trigger leads_normalize_contact
before insert or update of cpf, phone on public.leads
for each row execute function public.normalize_lead_contact();

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists leads_validate_update_permissions on public.leads;
create trigger leads_validate_update_permissions
before update on public.leads
for each row execute function public.validate_lead_update_permissions();

drop trigger if exists lead_interests_set_updated_at on public.lead_interests;
create trigger lead_interests_set_updated_at
before update on public.lead_interests
for each row execute function public.set_updated_at();

drop trigger if exists banks_set_updated_at on public.banks;
create trigger banks_set_updated_at
before update on public.banks
for each row execute function public.set_updated_at();

drop trigger if exists simulations_set_updated_at on public.simulations;
create trigger simulations_set_updated_at
before update on public.simulations
for each row execute function public.set_updated_at();

drop trigger if exists follow_ups_set_updated_at on public.follow_ups;
create trigger follow_ups_set_updated_at
before update on public.follow_ups
for each row execute function public.set_updated_at();

drop trigger if exists lead_notes_set_updated_at on public.lead_notes;
create trigger lead_notes_set_updated_at
before update on public.lead_notes
for each row execute function public.set_updated_at();

drop trigger if exists leads_audit_insert on public.leads;
create trigger leads_audit_insert
after insert on public.leads
for each row execute function public.audit_lead_changes();

drop trigger if exists leads_audit_update on public.leads;
create trigger leads_audit_update
after update on public.leads
for each row execute function public.audit_lead_changes();

drop trigger if exists simulations_audit_insert on public.simulations;
create trigger simulations_audit_insert
after insert on public.simulations
for each row execute function public.audit_simulation_insert();

drop trigger if exists simulations_audit_update on public.simulations;
create trigger simulations_audit_update
after update on public.simulations
for each row execute function public.audit_simulation_update();

drop trigger if exists follow_ups_audit_insert on public.follow_ups;
create trigger follow_ups_audit_insert
after insert on public.follow_ups
for each row execute function public.audit_follow_up_changes();

drop trigger if exists follow_ups_audit_update on public.follow_ups;
create trigger follow_ups_audit_update
after update on public.follow_ups
for each row execute function public.audit_follow_up_changes();

drop trigger if exists lead_notes_audit_insert on public.lead_notes;
create trigger lead_notes_audit_insert
after insert on public.lead_notes
for each row execute function public.audit_note_insert();

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.lead_interests enable row level security;
alter table public.banks enable row level security;
alter table public.simulations enable row level security;
alter table public.follow_ups enable row level security;
alter table public.lead_notes enable row level security;
alter table public.lead_timeline_events enable row level security;
alter table public.lead_status_history enable row level security;
alter table public.activity_logs enable row level security;
alter table public.settings enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert"
on public.profiles for insert
to authenticated
with check (public.is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "leads_select_admin_or_assigned" on public.leads;
create policy "leads_select_admin_or_assigned"
on public.leads for select
to authenticated
using (public.is_active_user() and (public.is_admin() or (assigned_user_id = auth.uid() and active = true)));

drop policy if exists "leads_insert_active_user" on public.leads;
create policy "leads_insert_active_user"
on public.leads for insert
to authenticated
with check (
  public.is_active_user()
  and (
    public.is_admin()
    or assigned_user_id = auth.uid()
    or assigned_user_id is null
  )
);

drop policy if exists "leads_update_admin_or_assigned" on public.leads;
create policy "leads_update_admin_or_assigned"
on public.leads for update
to authenticated
using (public.is_active_user() and (public.is_admin() or assigned_user_id = auth.uid()))
with check (
  public.is_active_user()
  and (
    public.is_admin()
  or (
    assigned_user_id = auth.uid()
    and status <> 'perdido'
  )
  )
);

drop policy if exists "lead_interests_select_accessible_lead" on public.lead_interests;
create policy "lead_interests_select_accessible_lead"
on public.lead_interests for select
to authenticated
using (public.can_access_lead(lead_id));

drop policy if exists "lead_interests_insert_accessible_lead" on public.lead_interests;
create policy "lead_interests_insert_accessible_lead"
on public.lead_interests for insert
to authenticated
with check (public.can_access_lead(lead_id));

drop policy if exists "lead_interests_update_accessible_lead" on public.lead_interests;
create policy "lead_interests_update_accessible_lead"
on public.lead_interests for update
to authenticated
using (public.can_access_lead(lead_id))
with check (public.can_access_lead(lead_id));

drop policy if exists "banks_select_authenticated" on public.banks;
create policy "banks_select_authenticated"
on public.banks for select
to authenticated
using (public.is_active_user() and (active = true or public.is_admin()));

drop policy if exists "banks_admin_write" on public.banks;
create policy "banks_admin_write"
on public.banks for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "simulations_select_accessible_lead" on public.simulations;
create policy "simulations_select_accessible_lead"
on public.simulations for select
to authenticated
using (public.can_access_lead(lead_id));

drop policy if exists "simulations_insert_accessible_lead" on public.simulations;
create policy "simulations_insert_accessible_lead"
on public.simulations for insert
to authenticated
with check (public.can_access_lead(lead_id) and created_by = auth.uid());

drop policy if exists "simulations_admin_update_only" on public.simulations;
create policy "simulations_admin_update_only"
on public.simulations for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "follow_ups_select_admin_or_assigned" on public.follow_ups;
create policy "follow_ups_select_admin_or_assigned"
on public.follow_ups for select
to authenticated
using (public.is_admin() or assigned_user_id = auth.uid() or public.can_access_lead(lead_id));

drop policy if exists "follow_ups_insert_accessible_lead" on public.follow_ups;
create policy "follow_ups_insert_accessible_lead"
on public.follow_ups for insert
to authenticated
with check (public.can_access_lead(lead_id) and (public.is_admin() or assigned_user_id = auth.uid()));

drop policy if exists "follow_ups_update_admin_or_assigned" on public.follow_ups;
create policy "follow_ups_update_admin_or_assigned"
on public.follow_ups for update
to authenticated
using (public.is_admin() or assigned_user_id = auth.uid())
with check (public.is_admin() or assigned_user_id = auth.uid());

drop policy if exists "lead_notes_select_accessible_lead" on public.lead_notes;
create policy "lead_notes_select_accessible_lead"
on public.lead_notes for select
to authenticated
using (public.can_access_lead(lead_id));

drop policy if exists "lead_notes_insert_accessible_lead" on public.lead_notes;
create policy "lead_notes_insert_accessible_lead"
on public.lead_notes for insert
to authenticated
with check (public.can_access_lead(lead_id) and author_id = auth.uid());

drop policy if exists "lead_notes_update_admin_or_author" on public.lead_notes;
create policy "lead_notes_update_admin_or_author"
on public.lead_notes for update
to authenticated
using (public.is_admin() or author_id = auth.uid())
with check (public.is_admin() or author_id = auth.uid());

drop policy if exists "timeline_select_accessible_lead" on public.lead_timeline_events;
create policy "timeline_select_accessible_lead"
on public.lead_timeline_events for select
to authenticated
using (public.can_access_lead(lead_id));

drop policy if exists "timeline_insert_active_user" on public.lead_timeline_events;
create policy "timeline_insert_active_user"
on public.lead_timeline_events for insert
to authenticated
with check (public.can_access_lead(lead_id));

drop policy if exists "timeline_admin_update_only" on public.lead_timeline_events;
create policy "timeline_admin_update_only"
on public.lead_timeline_events for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "status_history_select_accessible_lead" on public.lead_status_history;
create policy "status_history_select_accessible_lead"
on public.lead_status_history for select
to authenticated
using (public.can_access_lead(lead_id));

drop policy if exists "status_history_insert_active_user" on public.lead_status_history;
create policy "status_history_insert_active_user"
on public.lead_status_history for insert
to authenticated
with check (public.can_access_lead(lead_id));

drop policy if exists "activity_logs_admin_select" on public.activity_logs;
create policy "activity_logs_admin_select"
on public.activity_logs for select
to authenticated
using (public.is_admin());

drop policy if exists "activity_logs_insert_active_user" on public.activity_logs;
create policy "activity_logs_insert_active_user"
on public.activity_logs for insert
to authenticated
with check (public.is_active_user() and user_id = auth.uid());

drop policy if exists "settings_admin_select" on public.settings;
create policy "settings_admin_select"
on public.settings for select
to authenticated
using (public.is_admin());

drop policy if exists "settings_admin_write" on public.settings;
create policy "settings_admin_write"
on public.settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant usage on schema public to authenticated, service_role;
grant usage on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.leads to authenticated;
grant select, insert, update on public.lead_interests to authenticated;
grant select, insert, update, delete on public.banks to authenticated;
grant select, insert, update on public.simulations to authenticated;
grant select, insert, update on public.follow_ups to authenticated;
grant select, insert, update on public.lead_notes to authenticated;
grant select, insert, update on public.lead_timeline_events to authenticated;
grant select, insert on public.lead_status_history to authenticated;
grant select, insert on public.activity_logs to authenticated;
grant select, insert, update, delete on public.settings to authenticated;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

revoke all on public.activity_logs from anon;
revoke all on public.settings from anon;
revoke all on public.profiles from anon;
revoke all on public.leads from anon;
revoke all on public.lead_interests from anon;
revoke all on public.banks from anon;
revoke all on public.simulations from anon;
revoke all on public.follow_ups from anon;
revoke all on public.lead_notes from anon;
revoke all on public.lead_timeline_events from anon;
revoke all on public.lead_status_history from anon;

insert into public.banks(name, active)
values
  ('Banco PAN', true),
  ('Banco BV', true),
  ('Santander', true)
on conflict (name) do nothing;
