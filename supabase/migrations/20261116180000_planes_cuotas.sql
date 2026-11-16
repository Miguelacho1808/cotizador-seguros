-- Las cuotas disponibles pasan de la aseguradora a cada plan (hay planes con cuotas distintas)
alter table public.planes add column if not exists cuotas text[] not null default '{anual,semestral,trimestral,mensual}';
update public.planes p set cuotas = a.cuotas from public.aseguradoras a where a.id = p.aseguradora_id and a.cuotas is not null and cardinality(a.cuotas) > 0;
