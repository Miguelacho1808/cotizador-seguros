-- Cotizador de seguros, versión Salud: esquema inicial
-- (copia de la migración ya aplicada en el proyecto de Supabase)

create type public.tipo_plan as enum ('hcm','emca','amy');
create type public.modalidad_tarifa as enum ('por_persona','por_grupo');
create type public.rol_usuario as enum ('admin','asesor');
create type public.estado_cotizacion as enum ('borrador','enviada','aceptada','rechazada');
create type public.tipo_cotizacion as enum ('nueva_poliza','renovacion');
create type public.tipo_grupo as enum ('individual','pareja','familiar');

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- Usuarios
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  apellido text not null default '',
  username text unique,
  telefono text,
  whatsapp text,
  rol public.rol_usuario not null default 'asesor',
  activo boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin' and activo);
$$;
create or replace function public.usuario_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo);
$$;
revoke execute on function public.es_admin() from public, anon;
revoke execute on function public.usuario_activo() from public, anon;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.usuario_activo() to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre, apellido, username)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'nombre',''),
          coalesce(new.raw_user_meta_data->>'apellido',''),
          nullif(new.raw_user_meta_data->>'username',''));
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Organización (una sola fila)
create table public.organizacion (
  id boolean primary key default true check (id),
  nombre text not null default 'Mi organización',
  rif text,
  licencia text,
  telefono text,
  direccion text,
  logo_url text
);
insert into public.organizacion default values;

-- Catálogos
create table public.aseguradoras (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  nombre_corto text,
  ciudad text,
  pais text default 'Venezuela',
  fundada_en int,
  orden int not null default 0,
  estatus_integracion text not null default 'por_integrar'
    check (estatus_integracion in ('por_integrar','en_revision','integrado','premier_partner')),
  comision_pct numeric(5,2),
  rating numeric(2,1) check (rating between 0 and 5),
  activa boolean not null default true,
  logo_url text,
  portal_url text,
  email_contacto text,
  direccion text,
  ejecutivo_cuenta text,
  cuotas text[] not null default '{anual,semestral,trimestral,mensual}',
  renovacion_habilitada boolean not null default false,
  recargo_renovacion_pct numeric(5,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.addons (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden int not null default 0
);
insert into public.addons (nombre, orden) values
  ('Viajes',1),('Funerario',2),('AMD',3),('Maternidad',4),
  ('Funerario II',5),('Maternidad II',6),('Serv. Adicionales',7),('AMP',8);

create table public.beneficios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden int not null default 0
);
insert into public.beneficios (nombre, orden) values
  ('Hospitalización y Cirugía',1),('Sin deducible en Venezuela',2),('Entrega de Medicamentos',3),
  ('Cartas Avales y Reembolsos',4),('Cobertura Nacional',5),('Servicio de APS',6),
  ('Emergencias 24/7',7),('Servicio de Ambulancia',8),('Seguro Funerario',9),
  ('Asistente en Viaje Internacional',10),('Suma asegurada compartida',11);

create table public.planes (
  id uuid primary key default gen_random_uuid(),
  aseguradora_id uuid not null references public.aseguradoras(id) on delete cascade,
  nombre text not null,
  tipo public.tipo_plan not null,
  area text not null default 'salud',
  modalidad public.modalidad_tarifa not null default 'por_persona',
  cuotas text[],
  recomendado boolean not null default false,
  mas_vendido boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (aseguradora_id, nombre)
);
create index on public.planes (aseguradora_id);

create table public.plan_addons (
  plan_id uuid not null references public.planes(id) on delete cascade,
  addon_id uuid not null references public.addons(id) on delete cascade,
  edad_min int,
  edad_max int,
  suma_asegurada numeric(12,2),
  primary key (plan_id, addon_id)
);
create index on public.plan_addons (addon_id);

create table public.plan_beneficios (
  plan_id uuid not null references public.planes(id) on delete cascade,
  beneficio_id uuid not null references public.beneficios(id) on delete cascade,
  estado text not null default 'incluido' check (estado in ('incluido','opcional','no_ofrecido')),
  primary key (plan_id, beneficio_id)
);
create index on public.plan_beneficios (beneficio_id);

-- Beneficios provisionales: todos incluidos salvo suma asegurada compartida (corregir luego por plan)
create or replace function public.plan_beneficios_por_defecto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.plan_beneficios (plan_id, beneficio_id, estado)
  select new.id, b.id,
         case when b.nombre = 'Suma asegurada compartida' then 'no_ofrecido' else 'incluido' end
  from public.beneficios b;
  return new;
end $$;
revoke execute on function public.plan_beneficios_por_defecto() from public, anon, authenticated;
create trigger planes_beneficios_por_defecto after insert on public.planes
  for each row execute function public.plan_beneficios_por_defecto();

create table public.tarifas (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.planes(id) on delete cascade,
  cobertura_monto numeric(12,2) not null check (cobertura_monto > 0),
  edad_min int not null,
  edad_max int not null,
  prima_base numeric(12,2) not null check (prima_base >= 0),
  deducible numeric(12,2) not null default 0,
  activa boolean not null default true,
  check (edad_min <= edad_max),
  unique (plan_id, cobertura_monto, edad_min, edad_max, deducible)
);

-- Add-ons por fila de tarifa; sin fila = no disponible
create table public.tarifa_addons (
  tarifa_id uuid not null references public.tarifas(id) on delete cascade,
  addon_id uuid not null references public.addons(id) on delete cascade,
  valor_original text not null,
  incluido boolean not null default false,
  costo numeric(12,2),
  primary key (tarifa_id, addon_id)
);
create index on public.tarifa_addons (addon_id);

-- Operación
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellido text,
  cedula text,
  telefono text,
  email text,
  asesor_id uuid references public.perfiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.clientes (asesor_id);

create table public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  cliente_id uuid references public.clientes(id) on delete set null,
  asesor_id uuid not null references public.perfiles(id) default auth.uid(),
  area text not null default 'salud',
  tipo public.tipo_cotizacion not null default 'nueva_poliza',
  grupo public.tipo_grupo not null default 'individual',
  estado public.estado_cotizacion not null default 'borrador',
  canal text,
  token_publico text not null unique
    default replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.cotizaciones (asesor_id);
create index on public.cotizaciones (cliente_id);
create trigger cotizaciones_updated_at before update on public.cotizaciones
  for each row execute function public.set_updated_at();

create table public.cotizacion_asegurados (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  nombre text not null default '',
  edad int not null check (edad between 0 and 120),
  sexo char(1) not null check (sexo in ('M','F')),
  es_titular boolean not null default false,
  orden int not null default 0
);
create index on public.cotizacion_asegurados (cotizacion_id);

-- Copia de precios al cotizar: la cotización no cambia si luego cambia el tarifario
create table public.cotizacion_planes (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  plan_id uuid references public.planes(id) on delete set null,
  aseguradora_nombre text not null,
  plan_nombre text not null,
  cobertura_monto numeric(12,2) not null,
  deducible numeric(12,2) not null default 0,
  addons text[] not null default '{}',
  prima_anual numeric(12,2) not null,
  prima_semestral numeric(12,2) not null,
  prima_trimestral numeric(12,2) not null,
  prima_mensual numeric(12,2) not null,
  desglose jsonb not null default '[]',
  favorito boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.cotizacion_planes (cotizacion_id);

-- Seguridad por filas
alter table public.perfiles enable row level security;
alter table public.organizacion enable row level security;
alter table public.aseguradoras enable row level security;
alter table public.addons enable row level security;
alter table public.beneficios enable row level security;
alter table public.planes enable row level security;
alter table public.plan_addons enable row level security;
alter table public.plan_beneficios enable row level security;
alter table public.tarifas enable row level security;
alter table public.tarifa_addons enable row level security;
alter table public.clientes enable row level security;
alter table public.cotizaciones enable row level security;
alter table public.cotizacion_asegurados enable row level security;
alter table public.cotizacion_planes enable row level security;

revoke all on all tables in schema public from anon;

-- perfiles: cada quien ve el suyo; admin ve todos; solo puede editar datos de contacto
create policy perfiles_select on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or (select public.es_admin()));
create policy perfiles_update on public.perfiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, delete on public.perfiles from authenticated;
revoke update on public.perfiles from authenticated;
grant update (nombre, apellido, username, telefono, whatsapp) on public.perfiles to authenticated;

create or replace function public.admin_actualizar_usuario(p_id uuid, p_rol public.rol_usuario, p_activo boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'No autorizado'; end if;
  update public.perfiles set rol = p_rol, activo = p_activo where id = p_id;
end $$;
revoke execute on function public.admin_actualizar_usuario(uuid, public.rol_usuario, boolean) from public, anon;
grant execute on function public.admin_actualizar_usuario(uuid, public.rol_usuario, boolean) to authenticated;

-- catálogos: lectura para usuarios activos, escritura solo admin
do $$
declare t text;
begin
  foreach t in array array['organizacion','aseguradoras','addons','beneficios','planes',
                           'plan_addons','plan_beneficios','tarifas','tarifa_addons']
  loop
    execute format('create policy %I on public.%I for select to authenticated using ((select public.usuario_activo()))', t||'_lectura', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.es_admin()))', t||'_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()))', t||'_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.es_admin()))', t||'_delete', t);
  end loop;
end $$;

-- clientes y cotizaciones: dueño o admin
create policy clientes_acceso on public.clientes for all to authenticated
  using ((select public.usuario_activo()) and (asesor_id = (select auth.uid()) or (select public.es_admin())))
  with check ((select public.usuario_activo()) and (asesor_id = (select auth.uid()) or (select public.es_admin())));

create policy cotizaciones_acceso on public.cotizaciones for all to authenticated
  using ((select public.usuario_activo()) and (asesor_id = (select auth.uid()) or (select public.es_admin())))
  with check ((select public.usuario_activo()) and (asesor_id = (select auth.uid()) or (select public.es_admin())));

create policy cotizacion_asegurados_acceso on public.cotizacion_asegurados for all to authenticated
  using (exists (select 1 from public.cotizaciones c where c.id = cotizacion_id))
  with check (exists (select 1 from public.cotizaciones c where c.id = cotizacion_id));

create policy cotizacion_planes_acceso on public.cotizacion_planes for all to authenticated
  using (exists (select 1 from public.cotizaciones c where c.id = cotizacion_id))
  with check (exists (select 1 from public.cotizaciones c where c.id = cotizacion_id));

-- Enlace público: solo por token, sin abrir las tablas a usuarios anónimos
create or replace function public.obtener_cotizacion_compartida(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'numero', c.numero,
    'fecha', c.created_at,
    'grupo', c.grupo,
    'cliente', (select jsonb_build_object('nombre', cl.nombre, 'apellido', cl.apellido)
                from public.clientes cl where cl.id = c.cliente_id),
    'asegurados', coalesce((select jsonb_agg(jsonb_build_object('nombre', a.nombre, 'edad', a.edad,
                    'sexo', a.sexo, 'titular', a.es_titular) order by a.orden)
                  from public.cotizacion_asegurados a where a.cotizacion_id = c.id), '[]'::jsonb),
    'planes', coalesce((select jsonb_agg((to_jsonb(p) - 'cotizacion_id' - 'plan_id') order by p.prima_anual)
                from public.cotizacion_planes p where p.cotizacion_id = c.id), '[]'::jsonb),
    'asesor', (select jsonb_build_object('nombre', pf.nombre, 'apellido', pf.apellido,
                'whatsapp', coalesce(pf.whatsapp, pf.telefono))
               from public.perfiles pf where pf.id = c.asesor_id),
    'organizacion', (select to_jsonb(o) - 'id' from public.organizacion o limit 1)
  )
  from public.cotizaciones c
  where c.token_publico = p_token;
$$;
revoke execute on function public.obtener_cotizacion_compartida(text) from public;
grant execute on function public.obtener_cotizacion_compartida(text) to anon, authenticated;
