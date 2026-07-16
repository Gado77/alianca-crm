delete from public.banks b
where b.name = 'Outro'
  and not exists (
    select 1 from public.simulations s where s.bank_id = b.id
  );
