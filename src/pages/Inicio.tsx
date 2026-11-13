import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const TABLAS = [
  { tabla: "aseguradoras", etiqueta: "Aseguradoras" },
  { tabla: "planes", etiqueta: "Planes" },
  { tabla: "tarifas", etiqueta: "Tarifas" },
  { tabla: "clientes", etiqueta: "Clientes" },
  { tabla: "cotizaciones", etiqueta: "Cotizaciones" },
] as const;

export default function Inicio() {
  const [conteos, setConteos] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    Promise.all(TABLAS.map((t) => supabase.from(t.tabla).select("*", { count: "exact", head: true }))).then(
      (resultados) => {
        const salida: Record<string, number> = {};
        resultados.forEach((r, i) => {
          salida[TABLAS[i].tabla] = r.count ?? 0;
        });
        setConteos(salida);
      },
    );
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Inicio</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {TABLAS.map((t) => (
          <div key={t.tabla} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{t.etiqueta}</p>
            <p className="mt-2 text-3xl font-bold">{conteos ? conteos[t.tabla] : "…"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
