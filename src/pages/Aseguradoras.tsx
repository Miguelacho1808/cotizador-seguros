import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Plan = { id: string; nombre: string; tipo: string; activo: boolean };
type Aseguradora = { id: string; nombre: string; ciudad: string | null; activa: boolean; planes: Plan[] };

const TIPO: Record<string, string> = { hcm: "HCM", emca: "Emergencia médica", amy: "Adulto mayor" };

export default function Aseguradoras() {
  const [lista, setLista] = useState<Aseguradora[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("aseguradoras")
      .select("id,nombre,ciudad,activa,planes(id,nombre,tipo,activo)")
      .order("nombre")
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setLista((data as unknown as Aseguradora[]) ?? []);
      });
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Aseguradoras</h1>
      {error && <p className="text-red-400">{error}</p>}
      {lista && lista.length === 0 && (
        <p className="text-zinc-400">Aún no hay aseguradoras. Importa el tarifario desde la sección Tarifario.</p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lista?.map((a) => (
          <div key={a.id} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div>
              <p className="text-lg font-semibold">{a.nombre}</p>
              <p className="text-xs text-zinc-500">
                {a.ciudad ?? "Sin ciudad"} · {a.activa ? "Activa" : "Inactiva"}
              </p>
            </div>
            <ul className="space-y-1 text-sm">
              {a.planes.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span>{p.nombre}</span>
                  <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-300">
                    {TIPO[p.tipo] ?? p.tipo}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
