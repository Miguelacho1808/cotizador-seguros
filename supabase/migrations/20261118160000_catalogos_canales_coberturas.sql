-- Catálogos editables: canales de origen y coberturas (sumas aseguradas) activables.
create table public.canales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  orden int not null default 0
);
alter table public.canales enable row level security;
create policy canales_lectura on public.canales for select to authenticated using ((select public.usuario_activo()));
create policy canales_admin on public.canales for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
insert into public.canales (nombre, activo, orden) values
  ('Chatbot',true,1),('Email',true,2),('Presencial',false,3),('Redes Sociales',true,4),
  ('Referido',true,5),('Teléfono',false,6),('Web',true,7),('WhatsApp',true,8);

create table public.coberturas_catalogo (
  monto numeric primary key,
  activo boolean not null default true
);
alter table public.coberturas_catalogo enable row level security;
create policy coberturas_lectura on public.coberturas_catalogo for select to authenticated using ((select public.usuario_activo()));
create policy coberturas_admin on public.coberturas_catalogo for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
insert into public.coberturas_catalogo (monto) select distinct cobertura_monto from public.tarifas on conflict do nothing;
