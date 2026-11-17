import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { telefonoWhatsApp } from "../lib/telefono";
import Avatar from "../components/Avatar";

type Fila = {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  created_at: string;
  perfiles: { nombre: string | null; apellido: string | null; avatar_url: string | null } | null;
  cotizaciones: { count: number }[];
};

const PAGINA = 100;
const compacto = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n));
const rango = (d: Date, h: Date) =>
  supabase
    .from("clientes")
    .select("*", { count: "exact", head: true })
    .gte("created_at", d.toISOString())
    .lt("created_at", h.toISOString())
    .then((r) => r.count ?? 0);

/** +58 414 263 5235 si es un número venezolano de 12 dígitos; si no, tal cual. */
const verTelefono = (t: string | null) => {
  if (!t) return "–";
  const n = telefonoWhatsApp(t);
  return n && /^58\d{10}$/.test(n) ? `+58 ${n.slice(2, 5)} ${n.slice(5, 8)} ${n.slice(8)}` : t;
};

export default function Clientes() {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [registros, setRegistros] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [limite, setLimite] = useState(PAGINA);
  const [kpi, setKpi] = useState<{ total: number; mes: number; ant: number } | null>(null);

  useEffect(() => {
    const h = new Date();
    const mes = new Date(h.getFullYear(), h.getMonth(), 1);
    const ant = new Date(h.getFullYear(), h.getMonth() - 1, 1);
    const sig = new Date(h.getFullYear(), h.getMonth() + 1, 1);
    Promise.all([
      supabase.from("clientes").select("*", { count: "exact", head: true }).then((r) => r.count ?? 0),
      rango(mes, sig),
      rango(ant, mes),
    ]).then(([total, m, a]) => setKpi({ total, mes: m, ant: a }));
  }, []);

  useEffect(() => {
    let vigente = true;
    const t = setTimeout(async () => {
      const txt = q.trim().replace(/[%,()]/g, " ").trim();
      let consulta = supabase
        .from("clientes")
        .select("id,nombre,apellido,telefono,created_at,perfiles(nombre,apellido,avatar_url),cotizaciones(count)", {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .limit(limite);
      if (txt)
        consulta = consulta.or(
          `nombre.ilike.%${txt}%,apellido.ilike.%${txt}%,cedula.ilike.%${txt}%,telefono.ilike.%${txt}%,email.ilike.%${txt}%`,
        );
      const r = await consulta;
      if (!vigente) return;
      if (r.error) setError(r.error.message);
      else {
        setError(null);
        setFilas((r.data as unknown as Fila[]) ?? []);
        setRegistros(r.count ?? 0);
      }
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [q, limite]);

  const varia = kpi && kpi.ant > 0 ? Math.round(((kpi.mes - kpi.ant) / kpi.ant) * 100) : null;
  const tarjeta = "rounded-xl border border-zinc-800 bg-zinc-900 p-4";
  const rotulo = "text-[11px] font-semibold uppercase tracking-wider text-zinc-400";
  const th = "px-3 py-3 text-left text-xs font-semibold text-zinc-300";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Operación</p>
          <h1 className="text-4xl font-extrabold">Clientes</h1>
        </div>
        <Link
          to="/clientes/nuevo"
          className="rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-white"
        >
          + Nuevo cliente
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={tarjeta}>
          <p className={rotulo}>Total</p>
          <p className="mt-1 text-4xl font-extrabold text-sky-200">{kpi ? compacto(kpi.total) : "…"}</p>
        </div>
        <div className={tarjeta}>
          <p className={rotulo}>Este mes</p>
          <p className="mt-1 text-4xl font-extrabold text-emerald-400">{kpi ? kpi.mes : "…"}</p>
          {varia !== null && (
            <span
              className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] ${
                varia >= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
              }`}
            >
              {varia >= 0 ? "↗ +" : "↘ "}
              {varia}%
            </span>
          )}
        </div>
        <div className={tarjeta}>
          <p className={rotulo}>Mes ant.</p>
          <p className="mt-1 text-4xl font-extrabold text-fuchsia-500">{kpi ? kpi.ant : "…"}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimite(PAGINA);
          }}
          placeholder="Buscar por nombre, teléfono o email"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
        />
        <span className="shrink-0 text-xs text-zinc-400">
          {registros !== null ? `${registros.toLocaleString("es-VE")} registros` : ""}
        </span>
      </div>

      {error && <p className="text-red-400">{error}</p>}
      {!filas && !error && <p className="text-zinc-400">Cargando…</p>}
      {filas && filas.length === 0 && <p className="text-zinc-400">No hay clientes que coincidan.</p>}

      {filas && filas.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-zinc-800/60">
              <tr>
                <th className={th}>Cliente</th>
                <th className={th}>Teléfono</th>
                <th className={th}>Asesor</th>
                <th className={th}>Registrado</th>
                <th className={th}>Cotiz.</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const asesor = [f.perfiles?.nombre, f.perfiles?.apellido].filter(Boolean).join(" ");
                const n = f.cotizaciones?.[0]?.count ?? 0;
                return (
                  <tr key={f.id} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                    <td className="px-3 py-3 font-semibold">
                      <Link to={`/clientes/${f.id}`} className="hover:underline">
                        {[f.nombre, f.apellido].filter(Boolean).join(" ")}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-300">{verTelefono(f.telefono)}</td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2">
                        <Avatar url={f.perfiles?.avatar_url ?? null} nombre={asesor} tam="h-6 w-6 text-[10px]" />
                        <span className="whitespace-nowrap text-zinc-300">{asesor || "—"}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-300">
                      {new Date(f.created_at).toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
                        {n}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <Link
                        to={`/clientes/${f.id}`}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800"
                      >
                        Ver detalle
                      </Link>{" "}
                      <Link
                        to={`/cotizaciones/nueva?cliente=${f.id}`}
                        className="rounded-lg border border-indigo-400/50 px-3 py-1.5 text-xs text-indigo-300 hover:bg-indigo-500/10"
                      >
                        Cotizar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {filas && registros !== null && filas.length < registros && (
        <button
          onClick={() => setLimite((l) => l + PAGINA)}
          className="mx-auto block rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
        >
          Cargar más
        </button>
      )}
    </div>
  );
}
