import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { ESTADOS, colorEstado } from "./Cotizaciones";
import { BarrasH, BarrasV, Lineas } from "../components/graficos";

type Fila = {
  estado: string;
  created_at: string;
  cotizacion_planes: { cobertura_monto: number }[];
  cotizacion_asegurados: { edad: number }[];
};
type Reciente = {
  id: string;
  numero: number;
  estado: string;
  clientes: { nombre: string; apellido: string | null } | null;
};
type Periodo = { total: number; aceptadas: number; rechazadas: number; clientes: number };

const DIA = 86400000;
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => {
  const [a, m, d] = s.split("-").map(Number);
  return new Date(a, m - 1, d);
};
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const usd = (n: number) => `$${n.toLocaleString("es-VE")}`;

/** Trae todas las filas por páginas (el servidor entrega máx. 1000 por consulta). */
async function traerTodas(desde: Date, hasta: Date): Promise<Fila[]> {
  const salida: Fila[] = [];
  for (let i = 0; i < 10; i++) {
    const r = await supabase
      .from("cotizaciones")
      .select("estado,created_at,cotizacion_planes(cobertura_monto),cotizacion_asegurados(edad)")
      .gte("created_at", desde.toISOString())
      .lt("created_at", hasta.toISOString())
      .order("created_at", { ascending: true })
      .range(i * 1000, i * 1000 + 999);
    if (r.error) throw new Error(r.error.message);
    const f = (r.data as unknown as Fila[]) ?? [];
    salida.push(...f);
    if (f.length < 1000) break;
  }
  return salida;
}

const contar = (tabla: "cotizaciones" | "clientes", desde: Date, hasta: Date, estado?: string) => {
  let q = supabase
    .from(tabla)
    .select("*", { count: "exact", head: true })
    .gte("created_at", desde.toISOString())
    .lt("created_at", hasta.toISOString());
  if (estado) q = q.eq("estado", estado);
  return q.then((r) => r.count ?? 0);
};

const periodo = async (d: Date, h: Date): Promise<Periodo> => {
  const [total, aceptadas, rechazadas, clientes] = await Promise.all([
    contar("cotizaciones", d, h),
    contar("cotizaciones", d, h, "aceptada"),
    contar("cotizaciones", d, h, "rechazada"),
    contar("clientes", d, h),
  ]);
  return { total, aceptadas, rechazadas, clientes };
};

function Delta({ actual, previo }: { actual: number; previo: number }) {
  if (previo === 0) return <p className="mt-2 text-[11px] text-zinc-500">Período anterior: 0</p>;
  const pct = Math.round(((actual - previo) / previo) * 100);
  const sube = pct >= 0;
  return (
    <p
      className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[11px] ${
        sube ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
      }`}
    >
      {sube ? "▲" : "▼"} {Math.abs(pct)}% vs período ant.
    </p>
  );
}

function Tarjeta({ titulo, valor, color, children }: { titulo: string; valor: ReactNode; color?: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs text-zinc-400">{titulo}</p>
      <p className="mt-1 text-4xl font-extrabold" style={color ? { color } : undefined}>
        {valor}
      </p>
      {children}
    </div>
  );
}

function Panel({ titulo, sub, children, className = "" }: { titulo: string; sub?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-zinc-800 bg-zinc-900 p-4 ${className}`}>
      <h2 className="font-semibold">{titulo}</h2>
      {sub && <p className="mb-3 text-xs text-zinc-500">{sub}</p>}
      {children}
    </section>
  );
}

export default function Inicio() {
  const { perfil } = useAuth();
  const esAdmin = perfil?.rol === "admin";
  const hoy = new Date();
  const [desde, setDesde] = useState(fmt(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
  const [hasta, setHasta] = useState(fmt(hoy));
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [act, setAct] = useState<Periodo | null>(null);
  const [prev, setPrev] = useState<Periodo | null>(null);
  const [tend, setTend] = useState<{ mes: string; total: number; acept: number }[] | null>(null);
  const [recientes, setRecientes] = useState<Reciente[]>([]);
  const [error, setError] = useState<string | null>(null);

  const d0 = useMemo(() => parse(desde), [desde]);
  const d1 = useMemo(() => new Date(parse(hasta).getTime() + DIA), [hasta]); // fin exclusivo
  const valido = !isNaN(d0.getTime()) && !isNaN(d1.getTime()) && d1 > d0;

  useEffect(() => {
    if (!valido) return;
    let vigente = true;
    setError(null);
    setFilas(null);
    const largo = d1.getTime() - d0.getTime();
    const p0 = new Date(d0.getTime() - largo);
    Promise.all([traerTodas(d0, d1), periodo(d0, d1), periodo(p0, d0)])
      .then(([f, a, p]) => {
        if (!vigente) return;
        setFilas(f);
        setAct(a);
        setPrev(p);
      })
      .catch((e) => vigente && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      vigente = false;
    };
  }, [d0, d1, valido]);

  // Tendencia de los últimos 6 meses y últimas cotizaciones (no dependen del filtro)
  useEffect(() => {
    const ahora = new Date();
    Promise.all(
      [5, 4, 3, 2, 1, 0].map(async (i) => {
        const a = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
        const b = new Date(ahora.getFullYear(), ahora.getMonth() - i + 1, 1);
        const [total, acept] = await Promise.all([contar("cotizaciones", a, b), contar("cotizaciones", a, b, "aceptada")]);
        return { mes: `${MESES[a.getMonth()]} ${String(a.getFullYear()).slice(2)}`, total, acept };
      }),
    ).then(setTend);
    supabase
      .from("cotizaciones")
      .select("id,numero,estado,clientes(nombre,apellido)")
      .order("created_at", { ascending: false })
      .limit(6)
      .then((r) => setRecientes((r.data as unknown as Reciente[]) ?? []));
  }, []);

  const preset = (tipo: "mes" | "trimestre" | "anual") => {
    const h = new Date();
    const ini =
      tipo === "mes"
        ? new Date(h.getFullYear(), h.getMonth(), 1)
        : tipo === "trimestre"
          ? new Date(h.getFullYear(), h.getMonth() - 2, 1)
          : new Date(h.getFullYear(), 0, 1);
    setDesde(fmt(ini));
    setHasta(fmt(h));
  };

  const calc = useMemo(() => {
    const f = filas ?? [];
    const dias: number[] = [];
    const etDias: string[] = [];
    const nDias = Math.min(400, Math.round((d1.getTime() - d0.getTime()) / DIA));
    for (let i = 0; i < nDias; i++) {
      dias.push(0);
      const d = new Date(d0.getTime() + i * DIA);
      etDias.push(`${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const horas = Array.from({ length: 24 }, () => 0);
    const cob = new Map<number, number>();
    const edades = [0, 0, 0, 0, 0, 0, 0];
    for (const c of f) {
      const t = new Date(c.created_at);
      const di = Math.floor((new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() - d0.getTime()) / DIA);
      if (di >= 0 && di < dias.length) dias[di]++;
      horas[t.getHours()]++;
      for (const p of c.cotizacion_planes) cob.set(Number(p.cobertura_monto), (cob.get(Number(p.cobertura_monto)) ?? 0) + 1);
      for (const a of c.cotizacion_asegurados) {
        const e = a.edad;
        edades[e < 18 ? 0 : e < 30 ? 1 : e < 40 ? 2 : e < 50 ? 3 : e < 60 ? 4 : e < 70 ? 5 : 6]++;
      }
    }
    const topHoras = [...horas.keys()].sort((a, b) => horas[b] - horas[a]).slice(0, 3).filter((h) => horas[h] > 0).sort((a, b) => a - b);
    const coberturas = [...cob.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    return { dias, etDias, horas, topHoras, coberturas, edades };
  }, [filas, d0, d1]);

  const h = hoy.getHours();
  const saludo = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  const nombre = perfil?.nombre || "";
  const tasa = act && act.total > 0 ? Math.round((act.aceptadas / act.total) * 100) : 0;
  const mesTxt = hoy.toLocaleDateString("es-VE", { month: "long", year: "numeric" });
  const fechaCls =
    "rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs outline-none focus:border-indigo-400 [color-scheme:dark]";
  const btnCls = "rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800";

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <p className="text-xs capitalize text-zinc-500">
          {mesTxt} · {esAdmin ? "Vista global · todos los asesores" : "Tu actividad"}
        </p>
        <h1 className="mt-1 text-4xl font-extrabold leading-tight">
          {saludo},
          <br />
          <em className="text-zinc-100">{nombre || "bienvenido"}.</em>
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} className={fechaCls} />
        <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} className={fechaCls} />
        <button onClick={() => preset("mes")} className={btnCls}>
          Este mes
        </button>
        <button onClick={() => preset("trimestre")} className={btnCls}>
          Trimestre
        </button>
        <button onClick={() => preset("anual")} className={btnCls}>
          Anual
        </button>
      </div>
      {!valido && <p className="text-sm text-red-400">Rango de fechas inválido.</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tarjeta titulo="Cotizaciones" valor={act ? act.total : "…"}>
          {act && prev && <Delta actual={act.total} previo={prev.total} />}
        </Tarjeta>
        <Tarjeta titulo="Aceptadas" valor={act ? act.aceptadas : "…"} color="#22c55e">
          {act && prev && <Delta actual={act.aceptadas} previo={prev.aceptadas} />}
        </Tarjeta>
        <Tarjeta titulo="Rechazadas" valor={act ? act.rechazadas : "…"}>
          {act && prev && <Delta actual={act.rechazadas} previo={prev.rechazadas} />}
        </Tarjeta>
        <Tarjeta titulo="Tasa global" valor={act ? `${tasa}%` : "…"} color="#d946ef">
          <p className="mt-2 text-[11px] text-zinc-500">Aceptadas ÷ cotizaciones</p>
        </Tarjeta>
        <Tarjeta titulo="Clientes nuevos" valor={act ? act.clientes : "…"}>
          {act && prev && <Delta actual={act.clientes} previo={prev.clientes} />}
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Actividad diaria" sub="Cotizaciones por día en el rango elegido">
          {filas ? <Lineas etiquetas={calc.etDias} series={[{ nombre: "Cotizaciones", color: "#6366f1", valores: calc.dias }]} /> : <p className="text-sm text-zinc-500">Cargando…</p>}
        </Panel>
        <Panel
          titulo="Horas pico"
          sub={calc.topHoras.length ? `Mayor actividad: ${calc.topHoras.map((x) => `${String(x).padStart(2, "0")}:00`).join(", ")}` : "Cotizaciones por hora del día"}
        >
          {filas ? (
            <BarrasV
              datos={calc.horas.map((v, i) => ({ etiqueta: String(i).padStart(2, "0"), valor: v }))}
              resaltarTop={3}
              cadaEtiqueta={4}
            />
          ) : (
            <p className="text-sm text-zinc-500">Cargando…</p>
          )}
        </Panel>
      </div>

      <Panel titulo="Tendencia mensual" sub="Cotizaciones por fecha de creación, últimos 6 meses">
        {tend ? (
          <Lineas
            etiquetas={tend.map((t) => t.mes)}
            series={[
              { nombre: "Total", color: "#6366f1", valores: tend.map((t) => t.total) },
              { nombre: "Aceptadas", color: "#14b8a6", valores: tend.map((t) => t.acept) },
            ]}
          />
        ) : (
          <p className="text-sm text-zinc-500">Cargando…</p>
        )}
        <div className="mt-1 flex gap-4 text-xs text-zinc-400">
          <span><span className="mr-1 inline-block h-2 w-3 rounded bg-indigo-500" />Total</span>
          <span><span className="mr-1 inline-block h-2 w-3 rounded bg-teal-500" />Aceptadas</span>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Coberturas más cotizadas" sub="Montos de cobertura por frecuencia">
          {filas ? <BarrasH datos={calc.coberturas.map(([m, n]) => ({ etiqueta: usd(m), valor: n }))} /> : <p className="text-sm text-zinc-500">Cargando…</p>}
        </Panel>
        <Panel titulo="Distribución de edades" sub="Personas cotizadas por rango de edad">
          {filas ? (
            <BarrasV
              color="#6366f1"
              datos={["0-17", "18-29", "30-39", "40-49", "50-59", "60-69", "70+"].map((e, i) => ({ etiqueta: e, valor: calc.edades[i] }))}
            />
          ) : (
            <p className="text-sm text-zinc-500">Cargando…</p>
          )}
        </Panel>
      </div>

      <Panel titulo="Últimas cotizaciones">
        {recientes.length === 0 && <p className="text-sm text-zinc-400">Aún no hay cotizaciones.</p>}
        <div className="grid gap-2 md:grid-cols-2">
          {recientes.map((c) => (
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
      </Panel>
    </div>
  );
}
