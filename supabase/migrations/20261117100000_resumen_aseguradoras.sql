-- Resumen por aseguradora para la pantalla de Aseguradoras:
-- cuántas sumas aseguradas distintas cotiza y qué add-ons (activos) ofrece
-- (marcados en el plan o con precio en alguna tarifa).
-- security invoker: respeta las políticas RLS de quien consulta.
create or replace function public.resumen_aseguradoras()
returns table (aseguradora_id uuid, coberturas int, addons text[])
language sql
stable
security invoker
set search_path = public
as $$
  select
    a.id,
    (select count(distinct t.cobertura_monto)::int
       from public.planes p
       join public.tarifas t on t.plan_id = p.id
      where p.aseguradora_id = a.id and t.activa),
    coalesce((select array_agg(x.nombre order by x.orden)
                from (select ad.nombre, ad.orden
                        from public.planes p
                        join public.plan_addons pa on pa.plan_id = p.id
                        join public.addons ad on ad.id = pa.addon_id
                       where p.aseguradora_id = a.id and ad.activo
                      union
                      select ad.nombre, ad.orden
                        from public.planes p
                        join public.tarifas t on t.plan_id = p.id and t.activa
                        join public.tarifa_addons ta on ta.tarifa_id = t.id
                        join public.addons ad on ad.id = ta.addon_id
                       where p.aseguradora_id = a.id and ad.activo) x), '{}')
  from public.aseguradoras a;
$$;
