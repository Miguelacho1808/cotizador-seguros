-- Add-ons restringidos por sexo (Maternidad solo se cobra a asegurados de sexo femenino)
alter table public.addons add column if not exists solo_sexo char(1) check (solo_sexo in ('M','F'));
update public.addons set solo_sexo = 'F' where nombre ilike 'Maternidad%';
