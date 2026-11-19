-- Toda tarifa registra su suma asegurada en el catálogo de coberturas (si no existía).
create or replace function public.tarifa_registra_cobertura() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.coberturas_catalogo (monto) values (new.cobertura_monto) on conflict do nothing;
  return new;
end $$;
revoke execute on function public.tarifa_registra_cobertura() from public, anon, authenticated;
create trigger tarifa_registra_cobertura after insert or update of cobertura_monto on public.tarifas
  for each row execute function public.tarifa_registra_cobertura();
