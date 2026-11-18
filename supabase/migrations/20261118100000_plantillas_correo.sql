create table public.plantillas_correo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  asunto text not null,
  cuerpo text not null,
  predeterminada boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.plantillas_correo enable row level security;
create policy plantillas_correo_lectura on public.plantillas_correo for select to authenticated
  using ((select public.usuario_activo()));
create policy plantillas_correo_admin on public.plantillas_correo for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

insert into public.plantillas_correo (nombre, asunto, cuerpo, predeterminada) values
('Envío de cotización',
 'Tu cotización de seguro de salud #{numero}',
 E'Hola {cliente},\n\nFue un gusto atenderte. Te comparto tu cotización de seguro de salud #{numero} con {aseguradoras}, desde {desde} al año.\n\nPuedes verla aquí: {enlace}\n\nQuedo atento a cualquier duda para avanzar con la contratación.\n\nSaludos,\n{asesor}\n{empresa}',
 true),
('Seguimiento',
 'Seguimiento a tu cotización #{numero}',
 E'Hola {cliente},\n\n¿Pudiste revisar la cotización #{numero}? Te la dejo nuevamente: {enlace}\n\nSi quieres comparar otras sumas aseguradas o deducibles, con gusto la ajusto.\n\nSaludos,\n{asesor}\n{empresa}',
 false);
