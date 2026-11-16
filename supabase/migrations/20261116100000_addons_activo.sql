-- Add-ons archivables: los archivados se ocultan en el editor de planes y en el cotizador,
-- pero sus precios (tarifa_addons) y su oferta en planes (plan_addons) se conservan.
alter table public.addons add column if not exists activo boolean not null default true;
update public.addons set activo = false where nombre in ('Funerario II','Maternidad II','Serv. Adicionales','AMP');
