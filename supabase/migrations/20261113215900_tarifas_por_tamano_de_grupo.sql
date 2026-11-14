-- Planes con tarifa por grupo (p. ej. Hispana Salud Familiar: grupo de 3 a 6 personas, prima del grupo completo)
alter table public.planes
  add column grupo_min smallint,
  add column grupo_max smallint,
  add constraint planes_grupo_valido check (
    (grupo_min is null and grupo_max is null)
    or (grupo_min is not null and grupo_max is not null and grupo_min >= 1 and grupo_min <= grupo_max)
  );

-- 0 = no aplica (tarifa por persona). En planes por grupo, número de personas del grupo.
alter table public.tarifas
  add column tamano_grupo smallint not null default 0 check (tamano_grupo >= 0);

do $$
declare nombre_restriccion text;
begin
  select conname into nombre_restriccion
  from pg_constraint
  where conrelid = 'public.tarifas'::regclass and contype = 'u';
  if nombre_restriccion is not null then
    execute format('alter table public.tarifas drop constraint %I', nombre_restriccion);
  end if;
end $$;

alter table public.tarifas
  add constraint tarifas_clave_unica
  unique (plan_id, cobertura_monto, edad_min, edad_max, deducible, tamano_grupo);
