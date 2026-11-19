import { useEffect, useState } from "react";
import { supabase } from "./supabase";

let cache: { t: number; v: number[] } | null = null;

/** Sumas aseguradas activas del catálogo de Configuraciones → Coberturas (con caché corta). */
export async function montosCatalogo(): Promise<number[]> {
  if (cache && Date.now() - cache.t < 30_000) return cache.v;
  const r = await supabase.from("coberturas_catalogo").select("monto").eq("activo", true);
  const v = ((r.data as { monto: number }[] | null) ?? []).map((x) => Number(x.monto)).sort((a, b) => a - b);
  if (!r.error) cache = { t: Date.now(), v };
  return v;
}

export function useMontosCatalogo(): number[] {
  const [m, setM] = useState<number[]>(cache?.v ?? []);
  useEffect(() => {
    let vivo = true;
    montosCatalogo().then((v) => vivo && setM(v));
    return () => {
      vivo = false;
    };
  }, []);
  return m;
}

/** Opciones del selector: el catálogo más el valor actual si ya no está en él (para no perderlo al editar). */
export const opcionesMonto = (catalogo: number[], actual: number | null) =>
  actual && !catalogo.includes(actual) ? [...catalogo, actual].sort((a, b) => a - b) : catalogo;
