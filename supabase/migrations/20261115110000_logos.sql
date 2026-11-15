-- Logos de aseguradoras y de la organización: bucket público (lectura) y escritura solo admin
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy "logos: admin sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and (select public.es_admin()));
create policy "logos: admin actualiza" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and (select public.es_admin()))
  with check (bucket_id = 'logos' and (select public.es_admin()));
create policy "logos: admin borra" on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and (select public.es_admin()));

-- Logos iniciales (archivos en /public/logos del proyecto)
update public.aseguradoras set logo_url = case nombre
  when 'Estar Seguros' then '/logos/estar-seguros.png'
  when 'Hispana de Seguros' then '/logos/hispana.png'
  when 'La Internacional de Seguro' then '/logos/la-internacional.png'
  when 'Mapfre Seguros' then '/logos/mapfre.png'
  when 'Mercantil Panama' then '/logos/mercantil-panama.png'
  when 'Mercantil Seguros' then '/logos/mercantil-seguros.png'
  when 'Oceanica de Seguros' then '/logos/oceanica.png'
  when 'Seguros Caracas' then '/logos/seguros-caracas.png'
  when 'Seguros Venezuela' then '/logos/seguros-venezuela.png'
  else logo_url end
where logo_url is null;

-- La Mundial aún no existe: al crearla recibe su logo automáticamente
create or replace function public.logo_por_defecto() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.logo_url is null and new.nombre ilike '%mundial%' then
    new.logo_url := '/logos/la-mundial.jpg';
  end if;
  return new;
end $$;
create trigger aseguradoras_logo_por_defecto before insert on public.aseguradoras
  for each row execute function public.logo_por_defecto();

-- El enlace público incluye el logo de cada aseguradora
create or replace function public.obtener_cotizacion_compartida(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'numero', c.numero,
    'fecha', c.created_at,
    'grupo', c.grupo,
    'tipo', c.tipo,
    'cliente', (select jsonb_build_object('nombre', cl.nombre, 'apellido', cl.apellido)
                from public.clientes cl where cl.id = c.cliente_id),
    'asegurados', coalesce((select jsonb_agg(jsonb_build_object('nombre', a.nombre, 'edad', a.edad,
                    'sexo', a.sexo, 'titular', a.es_titular) order by a.orden)
                  from public.cotizacion_asegurados a where a.cotizacion_id = c.id), '[]'::jsonb),
    'planes', coalesce((select jsonb_agg(
                  (to_jsonb(p) - 'cotizacion_id' - 'plan_id')
                  || jsonb_build_object(
                       'logo_url', (select ase.logo_url from public.planes pl
                                    join public.aseguradoras ase on ase.id = pl.aseguradora_id
                                    where pl.id = p.plan_id),
                       'beneficios', coalesce((
                         select jsonb_agg(jsonb_build_object('nombre', b.nombre, 'estado', pb.estado) order by b.orden)
                         from public.plan_beneficios pb join public.beneficios b on b.id = pb.beneficio_id
                         where pb.plan_id = p.plan_id), '[]'::jsonb))
                  order by p.prima_anual)
                from public.cotizacion_planes p where p.cotizacion_id = c.id), '[]'::jsonb),
    'asesor', (select jsonb_build_object('nombre', pf.nombre, 'apellido', pf.apellido,
                'whatsapp', coalesce(pf.whatsapp, pf.telefono))
               from public.perfiles pf where pf.id = c.asesor_id),
    'organizacion', (select to_jsonb(o) - 'id' from public.organizacion o limit 1)
  )
  from public.cotizaciones c
  where c.token_publico = p_token;
$$;
