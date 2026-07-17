create or replace function public.audit_simulation_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bank_name text;
  lead_assigned_user_id uuid;
  follow_up_due_at timestamptz;
  follow_up_priority public.follow_up_priority := 'media';
  follow_up_reason text;
  denial_text text;
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
    denial_text := lower(coalesce(new.denial_reason, '') || ' ' || coalesce(new.bank_response, '') || ' ' || coalesce(new.notes, ''));

    if denial_text like '%ineleg%' then
      follow_up_due_at := now() + interval '6 months';
      follow_up_priority := 'baixa';
      follow_up_reason := 'Tentar nova simulação em 6 meses: cliente não elegível';
    elsif denial_text like '%score%' then
      follow_up_due_at := now() + interval '60 days';
      follow_up_priority := 'media';
      follow_up_reason := 'Tentar nova simulação em 60 dias: score baixo';
    elsif denial_text like '%entrada%' then
      follow_up_due_at := now() + interval '15 days';
      follow_up_priority := 'alta';
      follow_up_reason := 'Retornar sobre entrada e tentar nova simulação';
    elsif denial_text like '%salario%' or denial_text like '%salário%' then
      follow_up_due_at := now() + interval '7 days';
      follow_up_priority := 'alta';
      follow_up_reason := 'Retornar após salário para nova simulação';
    else
      follow_up_due_at := now() + interval '30 days';
      follow_up_priority := 'media';
      follow_up_reason := 'Retornar para avaliar nova simulação';
    end if;

    insert into public.follow_ups(lead_id, assigned_user_id, reason, due_at, priority, status)
    values (
      new.lead_id,
      lead_assigned_user_id,
      follow_up_reason,
      follow_up_due_at,
      follow_up_priority,
      'pendente'
    );
  end if;

  return new;
end;
$$;
