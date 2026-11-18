alter table public.plantillas_correo add column if not exists html text;
alter table public.plantillas_correo add column if not exists bloques jsonb;
alter table public.plantillas_correo add column if not exists updated_at timestamptz not null default now();

update public.plantillas_correo set nombre='Plantilla Salud', predeterminada=true,
  asunto='Tu cotización de seguro de salud #{numero}', bloques='[{"id": "h1", "tipo": "header", "titulo": "{{org_nombre}}", "subtitulo": "SEGUROS DE PERSONAS", "logo": true}, {"id": "s1", "tipo": "saludo", "titulo": "Hola, {{cliente_nombre}}", "texto": "Te compartimos tu cotización #{{cotizacion_numero}} de seguros de personas.\nPuedes ver el detalle completo de los planes comparados en el enlace."}, {"id": "t1", "tipo": "tabla", "titulo": "Planes cotizados"}, {"id": "b1", "tipo": "boton", "texto": "Ver cotización", "enlace": "{{enlace}}"}, {"id": "f1", "tipo": "footer", "texto": "Habla con: {{asesor_nombre}} · WhatsApp: {{asesor_whatsapp}}"}]'::jsonb, updated_at=now()
  where nombre='Envío de cotización';
update public.plantillas_correo set nombre='Plantilla Salud Renovaciones', predeterminada=false,
  asunto='Renovación de tu seguro de salud · cotización #{numero}',
  bloques='[{"id": "h1", "tipo": "header", "titulo": "{{org_nombre}}", "subtitulo": "SEGUROS DE PERSONAS", "logo": true}, {"id": "s1", "tipo": "saludo", "titulo": "Hola, {{cliente_nombre}}", "texto": "Se acerca la renovación de tu póliza. Te compartimos la cotización #{{cotizacion_numero}} con las opciones actualizadas."}, {"id": "t1", "tipo": "tabla", "titulo": "Planes cotizados"}, {"id": "b1", "tipo": "boton", "texto": "Ver cotización", "enlace": "{{enlace}}"}, {"id": "f1", "tipo": "footer", "texto": "Habla con: {{asesor_nombre}} · WhatsApp: {{asesor_whatsapp}}"}]'::jsonb, updated_at=now()
  where nombre='Seguimiento';
