-- El enlace público ahora incluye los beneficios de cada plan (tabla comparativa) y el tipo de cotización
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
                  || jsonb_build_object('beneficios', coalesce((
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
