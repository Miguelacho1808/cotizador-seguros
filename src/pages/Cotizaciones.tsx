import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Fila = {
  id: string;
  numero: number;
  estado: string;
  grupo: string;
  tipo: string;
  created_at: string;
  clientes: { nombre: string; apellido: string | null } | null;
  cotizacion_planes: { id: string }[];
};

export const ESTADOS: Record<string, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
};

export const colorEstado: Record<string, string> = {
  borrador: "bg-zinc-500/20 text-zinc-300",
  enviada: "bg-sky-500/20 text-sky-300",
  aceptada: "bg-emerald-500/20 text-emerald-300",
  rechazada: "bg-red-500/20 text-red-300",
};

export default function Cotizaciones() {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase
      .from("cotizaciones")
      .select("id,numero,estado,grupo,tipo,created_at,clientes(nombre,apellido),cotizacion_planes(id)")
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setFilas((data as unknown as Fila[]) ?? []);
      });
  }, []);

  const visibles = (filas ?? []).filter((f) => {
    if (estado && f.estado !== estado) return false;
    const nombre = [f.clientes?.nombre, f.clientes?.apellido].filter(Boolean).join(" ").toLowerCase();
    return !q.trim() || nombre.includes(q.trim().toLowerCase()) || String(f.numero) === q.trim();
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Cotizaciones</h1>
        <Link
          to="/cotizaciones/nueva"
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
        >
          + Nueva cotización
        </Link>
      </div>
      <div className="flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por cliente o número…"
          className="w-full rounded-lg sm:w-72  border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
        />
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-red-400">{error}</p>}
      {filas && visibles.length === 0 && <p className="text-zinc-400">No hay cotizaciones para mostrar.</p>}
      <div className="space-y-2">
        {visibles.map((f) => (
          <Link
            key={f.id}
            to={`/cotizaciones/${f.id}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-indigo-400/60"
          >
            <div>
              <p className="font-semibold">
                #{f.numero} · {[f.clientes?.nombre, f.clientes?.apellido].filter(Boolean).join(" ") || "Sin cliente"}
              </p>
              <p className="text-xs text-zinc-500">
                {new Date(f.created_at).toLocaleDateString("es-VE")} · {f.grupo} ·{" "}
                {f.tipo === "renovacion" ? "renovación" : "nueva póliza"} · {f.cotizacion_planes.length} opciones
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs ${colorEstado[f.estado] ?? ""}`}>
              {ESTADOS[f.estado] ?? f.estado}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
