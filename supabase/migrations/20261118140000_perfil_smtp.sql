-- SMTP personal del asesor para enviar cotizaciones desde su propio correo.
-- La contraseña nunca se lee desde el navegador: solo la función enviar-correo (service role) puede leerla.
create table public.perfil_smtp (
  perfil_id uuid primary key references public.perfiles(id) on delete cascade,
  remitente text not null,
  nombre text,
  host text not null,
  puerto int not null default 465,
  usuario text not null,
  clave text,
  firma text,
  verificado boolean not null default false,
  clave_guardada boolean generated always as (clave is not null) stored,
  updated_at timestamptz not null default now()
);
alter table public.perfil_smtp enable row level security;
create policy perfil_smtp_propio on public.perfil_smtp for all to authenticated
  using (perfil_id = (select auth.uid())) with check (perfil_id = (select auth.uid()));

revoke all on public.perfil_smtp from anon, authenticated;
grant select (perfil_id, remitente, nombre, host, puerto, usuario, firma, verificado, clave_guardada, updated_at)
  on public.perfil_smtp to authenticated;
grant insert (perfil_id, remitente, nombre, host, puerto, usuario, clave, firma) on public.perfil_smtp to authenticated;
grant update (remitente, nombre, host, puerto, usuario, clave, firma) on public.perfil_smtp to authenticated;
grant delete on public.perfil_smtp to authenticated;

-- Si cambia la configuración de conexión, hay que volver a probarla
create or replace function public.perfil_smtp_reset() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.verificado := false;
    elsif (new.remitente, new.host, new.puerto, new.usuario, new.clave)
          is distinct from (old.remitente, old.host, old.puerto, old.usuario, old.clave) then
      new.verificado := false;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke execute on function public.perfil_smtp_reset() from public, anon, authenticated;
create trigger perfil_smtp_reset before insert or update on public.perfil_smtp
  for each row execute function public.perfil_smtp_reset();
