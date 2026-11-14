-- El correo vive en auth.users (no accesible desde el cliente); se copia al perfil para la gestión de usuarios
alter table public.perfiles add column email text;
update public.perfiles p set email = u.email from auth.users u where u.id = p.id;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre, apellido, username)
  values (new.id,
          new.email,
          coalesce(new.raw_user_meta_data->>'nombre',''),
          coalesce(new.raw_user_meta_data->>'apellido',''),
          nullif(new.raw_user_meta_data->>'username',''));
  return new;
end $$;
