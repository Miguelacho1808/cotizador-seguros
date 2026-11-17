-- Totales del tarifario para la pantalla de admin (security invoker: respeta RLS).
create or replace function public.kpis_tarifario()
returns table (registros bigint, aseguradoras bigint, coberturas numeric[])
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*) from public.tarifas),
    (select count(distinct p.aseguradora_id) from public.tarifas t join public.planes p on p.id = t.plan_id),
    coalesce((select array_agg(distinct cobertura_monto order by cobertura_monto) from public.tarifas), '{}');
$$;
