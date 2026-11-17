import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Avatar from "../components/Avatar";

type Fila = {
  id: string;
  numero: number;
  estado: string;
  grupo: string;
  tipo: string;
  created_at: string;
  area: string;
  canal: string | null;
  clientes: { nombre: string; apellido: string | null } | null;
  perfiles: { nombre: string | null; apellido: string | null; avatar_url: string | null } | null;
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

const PAGINA = 100;
const compacto = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n));
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const rango = (d: Date, h: Date) =>
  supabase
    .from("cotizaciones")
    .select("*", { count: "exact", head: true })
    .gte("created_at", d.toISOString())
    .lt("created_at", h.toISOString())
    .then((r) => r.count ?? 0);

export default function Cotizaciones() {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState("");
  const [grupo, setGrupo] = useState("");
  const [q, setQ] = useState("");
  const [filtros, setFiltros] = useState(false);
  const [limite, setLimite] = useState(PAGINA);
  const [kpi, setKpi] = useState<{ total: number; mes: number; ant: number; canal: string } | null>(null);

  useEffect(() => {
    const h = new Date();
    const mes = new Date(h.getFullYear(), h.getMonth(), 1);
    const ant = new Date(h.getFullYear(), h.getMonth() - 1, 1);
    const manana = new Date(h.getFullYear(), h.getMonth() + 1, 1);
    Promise.all([
      supabase.from("cotizaciones").select("*", { count: "exact", head: true }).then((r) => r.count ?? 0),
      rango(mes, manana),
      rango(ant, mes),
      supabase.from("cotizaciones").select("canal").not("canal", "is", null).order("created_at", { ascending: false }).limit(1000),
    ]).then(([total, m, a, c]) => {
      const cuenta = new Map<string, number>();
      for (const x of (c.data as { canal: string }[]) ?? []) cuenta.set(x.canal, (cuenta.get(x.canal) ?? 0) + 1);
      const top = [...cuenta.entries()].sort((x, y) => y[1] - x[1])[0];
      setKpi({ total, mes: m, ant: a, canal: top ? top[0] : "—" });
    });
  }, []);

  // Búsqueda y filtros en el servidor (hay miles de cotizaciones)
  useEffect(() => {
    let vigente = true;
    const t = setTimeout(async () => {
      const txt = q.trim().replace(/[%,()]/g, " ").trim();
      let consulta = supabase
        .from("cotizaciones")
        .select(
          "id,numero,estado,grupo,tipo,area,canal,created_at,clientes(nombre,apellido),perfiles(nombre,apellido,avatar_url),cotizacion_planes(id)",
        )
        .order("created_at", { ascending: false })
        .limit(limite);
      if (estado) consulta = consulta.eq("estado", estado);
      if (grupo) consulta = consulta.eq("grupo", grupo);
      if (txt) {
        const filtro: string[] = [];
        if (/^#?\d+$/.test(txt)) filtro.push(`numero.eq.${txt.replace("#", "")}`);
        const cl = await supabase
          .from("clientes")
          .select("id")
          .or(`nombre.ilike.%${txt}%,apellido.ilike.%${txt}%`)
          .limit(200);
        const ids = ((cl.data as { id: string }[]) ?? []).map((c) => c.id);
        if (ids.length) filtro.push(`cliente_id.in.(${ids.join(",")})`);
        if (filtro.length === 0) {
          if (vigente) setFilas([]);
          return;
        }
        consulta = consulta.or(filtro.join(","));
      }
      const r = await consulta;
      if (!vigente) return;
      if (r.error) setError(r.error.message);
      else {
        setError(null);
        setFilas((r.data as unknown as Fila[]) ?? []);
      }
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [q, estado, grupo, limite]);

  const varia = kpi && kpi.ant > 0 ? Math.round(((kpi.mes - kpi.ant) / kpi.ant) * 100) : null;
  const tarjeta = "rounded-xl border border-zinc-800 bg-zinc-900 p-4";
  const rotulo = "text-[11px] font-semibold uppercase tracking-wider text-zinc-400";
  const th = "px-3 py-3 text-left text-xs font-semibold text-zinc-300";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Operación</p>
          <h1 className="text-4xl font-extrabold">Cotizaciones</h1>
        </div>
        <Link
          to="/cotizaciones/nueva"
          className="rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-white"
        >
          + Nueva cotización
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
              {varia >= 0 ? "↗" : "↘"} {varia >= 0 ? "+" : ""}
              {varia}%
            </span>
          )}
        </div>
        <div className={tarjeta}>
          <p className={rotulo}>Mes ant.</p>
          <p className="mt-1 text-4xl font-extrabold text-fuchsia-500">{kpi ? kpi.ant : "…"}</p>
        </div>
        <div className={tarjeta}>
          <p className={rotulo}>Canal top</p>
          <p className="mt-1 text-3xl font-extrabold leading-tight text-indigo-300">{kpi ? kpi.canal : "…"}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimite(PAGINA);
          }}
          placeholder="Buscar cliente o #…"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
        />
        <button
          onClick={() => setFiltros((v) => !v)}
          aria-label="Filtros"
          className={`rounded-xl border px-3.5 text-sm ${
            estado || grupo ? "border-indigo-400 text-indigo-300" : "border-zinc-800 bg-zinc-900 text-zinc-300"
          }`}
        >
          ⚲ Filtros
        </button>
      </div>
      {filtros && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
          <select
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value);
              setLimite(PAGINA);
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            {Object.entries(ESTADOS).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
          <select
            value={grupo}
            onChange={(e) => {
              setGrupo(e.target.value);
              setLimite(PAGINA);
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
          >
            <option value="">Todos los planes</option>
            <option value="individual">Individual</option>
            <option value="pareja">Pareja</option>
            <option value="familiar">Familiar</option>
          </select>
          {(estado || grupo) && (
            <button
              onClick={() => {
                setEstado("");
                setGrupo("");
              }}
              className="text-sm text-zinc-400 hover:text-zinc-100"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {error && <p className="text-red-400">{error}</p>}
      {!filas && !error && <p className="text-zinc-400">Cargando…</p>}
      {filas && filas.length === 0 && <p className="text-zinc-400">No hay cotizaciones para mostrar.</p>}

      {filas && filas.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-zinc-800/60">
              <tr>
                <th className={th}>#</th>
                <th className={th}>Área</th>
                <th className={th}>Cliente</th>
                <th className={th}>Plan</th>
                <th className={th}>Canal</th>
                <th className={th}>Estado</th>
                <th className={th}>Asesor</th>
                <th className={th}>Fecha</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const asesor = [f.perfiles?.nombre, f.perfiles?.apellido].filter(Boolean).join(" ") || "—";
                return (
                  <tr key={f.id} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                    <td className="px-3 py-3 font-bold">#{f.numero}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-semibold text-red-400">
                        {cap(f.area ?? "salud")}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      {[f.clientes?.nombre, f.clientes?.apellido].filter(Boolean).join(" ") || "Sin cliente"}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
                        {cap(f.grupo)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-zinc-300">{f.canal ?? "–"}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorEstado[f.estado] ?? ""}`}>
                        {ESTADOS[f.estado] ?? f.estado}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2">
                        <Avatar url={f.perfiles?.avatar_url ?? null} nombre={asesor === "—" ? "" : asesor} tam="h-6 w-6 text-[10px]" />
                        <span className="whitespace-nowrap text-zinc-300">{asesor}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-300">
                      {new Date(f.created_at).toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        to={`/cotizaciones/${f.id}`}
                        className="whitespace-nowrap rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {filas && filas.length >= limite && (
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
