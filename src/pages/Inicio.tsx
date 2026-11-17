import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { ESTADOS, colorEstado } from "./Cotizaciones";

type Reciente = {
  id: string;
  numero: number;
  estado: string;
  created_at: string;
  clientes: { nombre: string; apellido: string | null } | null;
};
type Datos = {
  cotMes: number;
  cotMesAnt: number;
  cliMes: number;
  cliMesAnt: number;
  porEstado: Record<string, number>;
  totalCot: number;
  totalCli: number;
  recientes: Reciente[];
};

const contar = (tabla: "cotizaciones" | "clientes", desde?: Date, hasta?: Date, estado?: string) => {
  let q = supabase.from(tabla).select("*", { count: "exact", head: true });
  if (desde) q = q.gte("created_at", desde.toISOString());
  if (hasta) q = q.lt("created_at", hasta.toISOString());
  if (estado) q = q.eq("estado", estado);
  return q.then((r) => r.count ?? 0);
};

function Variacion({ actual, previo }: { actual: number; previo: number }) {
  if (previo === 0 && actual === 0) return <p className="mt-1 text-xs text-zinc-500">Sin movimiento</p>;
  if (previo === 0) return <p className="mt-1 text-xs text-emerald-400">Mes anterior: 0</p>;
  const pct = Math.round(((actual - previo) / previo) * 100);
  return (
    <p className={`mt-1 text-xs ${pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
      {pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}% vs. mes anterior ({previo})
    </p>
  );
}

function Tarjeta({ titulo, valor, children }: { titulo: string; valor: string | number; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{titulo}</p>
      <p className="mt-2 text-3xl font-bold">{valor}</p>
      {children}
    </div>
  );
}

export default function Inicio() {
  const { perfil } = useAuth();
  const esAdmin = perfil?.rol === "admin";
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioAnt = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    Promise.all([
      contar("cotizaciones", inicioMes),
      contar("cotizaciones", inicioAnt, inicioMes),
      contar("clientes", inicioMes),
      contar("clientes", inicioAnt, inicioMes),
      contar("cotizaciones"),
      contar("clientes"),
      ...Object.keys(ESTADOS).map((e) => contar("cotizaciones", undefined, undefined, e)),
      supabase
        .from("cotizaciones")
        .select("id,numero,estado,created_at,clientes(nombre,apellido)")
        .order("created_at", { ascending: false })
        .limit(6),
    ])
      .then((r) => {
        const estados = Object.keys(ESTADOS);
        const porEstado: Record<string, number> = {};
        estados.forEach((e, i) => (porEstado[e] = r[6 + i] as number));
        const rec = r[6 + estados.length] as { data: unknown; error: { message: string } | null };
        if (rec.error) throw new Error(rec.error.message);
        setD({
          cotMes: r[0] as number,
          cotMesAnt: r[1] as number,
          cliMes: r[2] as number,
          cliMesAnt: r[3] as number,
          totalCot: r[4] as number,
          totalCli: r[5] as number,
          porEstado,
          recientes: (rec.data as Reciente[]) ?? [],
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const mes = new Date().toLocaleDateString("es-VE", { month: "long", year: "numeric" });
  const cerradas = d ? d.porEstado.aceptada + d.porEstado.rechazada : 0;
  const tasa = d && cerradas > 0 ? Math.round((d.porEstado.aceptada / cerradas) * 100) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inicio</h1>
        <p className="text-sm capitalize text-zinc-400">
          {mes}
          {esAdmin ? " · todos los asesores" : ""}
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Tarjeta titulo="Cotizaciones del mes" valor={d ? d.cotMes : "…"}>
          {d && <Variacion actual={d.cotMes} previo={d.cotMesAnt} />}
        </Tarjeta>
        <Tarjeta titulo="Clientes nuevos del mes" valor={d ? d.cliMes : "…"}>
          {d && <Variacion actual={d.cliMes} previo={d.cliMesAnt} />}
        </Tarjeta>
        <Tarjeta titulo="Total cotizaciones" valor={d ? d.totalCot : "…"} />
        <Tarjeta titulo="Total clientes" valor={d ? d.totalCli : "…"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Cotizaciones por estado</h2>
            {tasa !== null && <span className="text-xs text-zinc-400">Aceptación: {tasa}% de las cerradas</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(ESTADOS).map(([k, n]) => (
              <div key={k} className="rounded-lg border border-zinc-800 p-3">
                <span className={`rounded-full px-2 py-0.5 text-xs ${colorEstado[k] ?? ""}`}>{n}</span>
                <p className="mt-2 text-2xl font-bold">{d ? d.porEstado[k] : "…"}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Últimas cotizaciones</h2>
            <Link to="/cotizaciones" className="text-xs text-indigo-300 hover:underline">
              Ver todas
            </Link>
          </div>
          {d && d.recientes.length === 0 && <p className="text-sm text-zinc-400">Aún no hay cotizaciones.</p>}
          <div className="space-y-2">
            {(d?.recientes ?? []).map((c) => (
              <Link
                key={c.id}
                to={`/cotizaciones/${c.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 p-2.5 text-sm hover:border-zinc-600"
              >
                <span className="truncate">
                  #{c.numero} · {[c.clientes?.nombre, c.clientes?.apellido].filter(Boolean).join(" ") || "Sin cliente"}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${colorEstado[c.estado] ?? ""}`}>
                  {ESTADOS[c.estado] ?? c.estado}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/cotizaciones/nueva"
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
        >
          + Nueva cotización
        </Link>
        <Link to="/clientes/nuevo" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800">
          + Nuevo cliente
        </Link>
      </div>
    </div>
  );
}
