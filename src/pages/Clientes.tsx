import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Fila = {
  id: string;
  nombre: string;
  apellido: string | null;
  cedula: string | null;
  telefono: string | null;
  email: string | null;
  cotizaciones: { id: string }[];
};

export default function Clientes() {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase
      .from("clientes")
      .select("id,nombre,apellido,cedula,telefono,email,cotizaciones(id)")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setFilas((data as unknown as Fila[]) ?? []);
      });
  }, []);

  const txt = q.trim().toLowerCase();
  const visibles = (filas ?? []).filter(
    (f) =>
      !txt ||
      [f.nombre, f.apellido, f.cedula, f.telefono, f.email].some((v) => v?.toLowerCase().includes(txt)),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Clientes</h1>
        <Link
          to="/clientes/nuevo"
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
        >
          + Nuevo cliente
        </Link>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, cédula, teléfono o email…"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
      />

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!filas && !error && <p className="text-zinc-400">Cargando…</p>}
      {filas && visibles.length === 0 && <p className="text-zinc-400">No hay clientes que coincidan.</p>}

      <div className="space-y-2">
        {visibles.map((f) => (
          <Link
            key={f.id}
            to={`/clientes/${f.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600"
          >
            <div>
              <p className="font-semibold">{[f.nombre, f.apellido].filter(Boolean).join(" ")}</p>
              <p className="text-sm text-zinc-400">
                {[f.cedula, f.telefono, f.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
              </p>
            </div>
            <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
              {f.cotizaciones.length} cotización{f.cotizaciones.length === 1 ? "" : "es"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
