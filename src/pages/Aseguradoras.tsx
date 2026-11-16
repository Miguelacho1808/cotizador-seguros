import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

type Plan = { id: string; nombre: string; tipo: string; activo: boolean };
type Aseguradora = { id: string; nombre: string; logo_url: string | null; ciudad: string | null; activa: boolean; planes: Plan[] };

const TIPO: Record<string, string> = { hcm: "HCM", emca: "Emergencia médica", amy: "Adulto mayor" };
const ORDEN_TIPOS = ["hcm", "emca", "amy"];

export default function Aseguradoras() {
  const { perfil } = useAuth();
  const navigate = useNavigate();
  const [lista, setLista] = useState<Aseguradora[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esAdmin = perfil?.rol === "admin";

  useEffect(() => {
    supabase
      .from("aseguradoras")
      .select("id,nombre,logo_url,ciudad,activa,planes(id,nombre,tipo,activo)")
      .order("nombre")
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setLista((data as unknown as Aseguradora[]) ?? []);
      });
  }, []);

  const nueva = async () => {
    const nombre = window.prompt("Nombre de la nueva aseguradora");
    if (!nombre || !nombre.trim()) return;
    const r = await supabase.from("aseguradoras").insert({ nombre: nombre.trim() }).select("id").single();
    if (r.error) setError(r.error.message);
    else navigate(`/aseguradoras/${(r.data as { id: string }).id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Aseguradoras</h1>
        {esAdmin && (
          <button
            onClick={nueva}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
          >
            + Nueva aseguradora
          </button>
        )}
      </div>
      {error && <p className="text-red-400">{error}</p>}
      {lista && lista.length === 0 && (
        <p className="text-zinc-400">Aún no hay aseguradoras. Importa el tarifario desde la sección Tarifario.</p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lista?.map((a) => (
          <div key={a.id} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            {a.logo_url && (
              <div className="flex h-16 items-center justify-center rounded-lg bg-white p-2">
                <img src={a.logo_url} alt={a.nombre} className="max-h-full max-w-full object-contain" />
              </div>
            )}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">{a.nombre}</p>
                <p className="text-xs text-zinc-500">
                  {a.ciudad ?? "Sin ciudad"} · {a.activa ? "Activa" : "Inactiva"}
                </p>
              </div>
              {esAdmin && (
                <Link to={`/aseguradoras/${a.id}`} className="text-sm text-indigo-300 hover:underline">
                  Editar
                </Link>
              )}
            </div>
            <div className="space-y-3">
              {ORDEN_TIPOS.map((tipo) => {
                const deTipo = a.planes.filter((p) => p.tipo === tipo).sort((x, y) => x.nombre.localeCompare(y.nombre));
                if (deTipo.length === 0) return null;
                return (
                  <div key={tipo} className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
                      {TIPO[tipo] ?? tipo} <span className="text-zinc-500">({deTipo.length})</span>
                    </p>
                    <ul className="space-y-1 text-sm">
                      {deTipo.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-zinc-800/50 px-2 py-1">
                          {esAdmin ? (
                            <Link to={`/planes/${p.id}`} className="hover:text-indigo-300 hover:underline">
                              {p.nombre}
                            </Link>
                          ) : (
                            <span>{p.nombre}</span>
                          )}
                          {!p.activo && <span className="text-xs text-zinc-500">Inactivo</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {a.planes.length === 0 && <p className="text-sm text-zinc-500">Sin planes.</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
