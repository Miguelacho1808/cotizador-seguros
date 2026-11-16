// Documento imprimible de la cotización (hoja blanca): primas por aseguradora y comparativa de beneficios.
// Se usa en el detalle (para imprimir/PDF) y en el enlace público.

import { cuotasDelPlan } from "../lib/calculo";

export type PlanDoc = {
  aseguradora_nombre: string;
  plan_nombre: string;
  cobertura_monto: number;
  deducible: number;
  addons: string[];
  prima_anual: number;
  prima_semestral: number;
  prima_trimestral: number;
  prima_mensual: number;
  desglose?: {
    porPersona?: { nombre: string; edad: number; base: number | null; addons: number }[];
    cuotas?: string[];
    destacado?: boolean;
  } | null;
  beneficios: { nombre: string; estado: string }[];
  logo_url?: string | null;
};

export type DatosDoc = {
  numero: number;
  fecha: string;
  tipo: string;
  organizacion: string | null;
  organizacionLogo?: string | null;
  cliente: string;
  asegurados: { nombre: string; edad: number; sexo: string }[];
  planes: PlanDoc[];
};

const usd = (n: number) => `$${Number(n).toLocaleString("es-VE")}`;
const AZUL = "#12284c";
const CELESTE = "#dbeafe";

type Grupo = { clave: string; aseguradora: string; plan: string; planes: PlanDoc[]; logo: string | null };

function agrupar(planes: PlanDoc[]): Grupo[] {
  const m = new Map<string, Grupo>();
  for (const p of planes) {
    const clave = `${p.aseguradora_nombre}|${p.plan_nombre}`;
    const g = m.get(clave) ?? { clave, aseguradora: p.aseguradora_nombre, plan: p.plan_nombre, planes: [], logo: p.logo_url ?? null };
    g.planes.push(p);
    m.set(clave, g);
  }
  return [...m.values()]
    .map((g) => ({ ...g, planes: [...g.planes].sort((a, b) => a.cobertura_monto - b.cobertura_monto) }))
    .sort((a, b) => a.aseguradora.localeCompare(b.aseguradora));
}

function Bloque({ g, repetida }: { g: Grupo; repetida: boolean }) {
  const personas = g.planes[0].desglose?.porPersona ?? [];
  const esGrupo = personas.length > 0 && personas.every((p) => p.base === null);
  const filas = esGrupo
    ? [{ etiqueta: `Grupo (${personas.length} personas)`, valores: g.planes.map((p) => sumaPersonas(p)) }]
    : personas.map((pp, i) => ({
        etiqueta: `${pp.edad} años`,
        valores: g.planes.map((p) => {
          const x = p.desglose?.porPersona?.[i];
          return x ? (x.base ?? 0) + x.addons : null;
        }),
      }));
  const addons = [...new Set(g.planes.flatMap((p) => p.addons))];
  // Formas de pago del plan (varían por plan); "Inicial 40% + 4 cuotas" se divide en dos filas
  const filasCuotas = cuotasDelPlan(g.planes[0].prima_anual, g.planes[0].desglose?.cuotas).flatMap((c) => {
    const valorDe = (p: PlanDoc) => cuotasDelPlan(p.prima_anual, g.planes[0].desglose?.cuotas).find((x) => x.clave === c.clave)!;
    if (c.clave === "inicial_40_4")
      return [
        { clave: `${c.clave}_i`, nombre: "Inicial 40%", valor: (p: PlanDoc) => valorDe(p).inicial ?? 0 },
        { clave: `${c.clave}_c`, nombre: "4 cuotas de", valor: (p: PlanDoc) => valorDe(p).valor },
      ];
    return [{ clave: c.clave, nombre: c.nombre, valor: (p: PlanDoc) => valorDe(p).valor }];
  });
  const celda = "px-2 py-1 text-right";
  const etiqueta = "px-2 py-1 text-left";

  return (
    <div className="sin-corte overflow-hidden rounded border border-zinc-300 text-[11px] text-zinc-800">
      <div className="px-2 py-2 text-center" style={{ background: AZUL, color: "#fff" }}>
        {g.logo ? (
          <div className="mx-auto flex h-10 w-40 items-center justify-center rounded bg-white px-2 py-1">
            <img src={g.logo} alt={g.aseguradora} className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <p className="text-sm font-bold">{g.aseguradora}</p>
        )}
        {(repetida || g.logo) && <p className="mt-0.5 text-[10px] opacity-80">{repetida ? g.plan : g.aseguradora}</p>}
      </div>
      <table className="w-full">
        <thead>
          <tr className="font-semibold">
            <td className={etiqueta}>Coberturas</td>
            {g.planes.map((p, i) => (
              <td key={i} className={celda}>
                {usd(p.cobertura_monto)}
              </td>
            ))}
          </tr>
          <tr className="text-zinc-500">
            <td className={etiqueta}>Deducible</td>
            {g.planes.map((p, i) => (
              <td key={i} className={celda}>
                {Number(p.deducible) > 0 ? usd(p.deducible) : "—"}
              </td>
            ))}
          </tr>
          <tr className="text-zinc-500">
            <td className={etiqueta}>{esGrupo ? "" : "Edad"}</td>
            {g.planes.map((_, i) => (
              <td key={i} className={celda}>
                Prima Anual
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              <td className={etiqueta}>{f.etiqueta}</td>
              {f.valores.map((v, j) => (
                <td key={j} className={celda}>
                  {v === null ? "—" : usd(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tbody>
          <tr>
            <td colSpan={g.planes.length + 1} className="px-2 pb-0 pt-2 font-bold">
              Total Primas
            </td>
          </tr>
          {filasCuotas.map((f, k) => (
            <tr key={f.clave} style={k % 2 === 0 ? { background: CELESTE } : undefined} className="font-semibold">
              <td className={etiqueta}>{f.nombre}</td>
              {g.planes.map((p, i) => (
                <td key={i} className={celda}>
                  {usd(f.valor(p))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {addons.length > 0 && <p className="px-2 py-1 text-[10px] text-zinc-500">Incluye add-ons: {addons.join(", ")}</p>}
    </div>
  );
}

function sumaPersonas(p: PlanDoc): number | null {
  const x = p.desglose?.porPersona;
  if (!x || x.length === 0) return p.prima_anual;
  return x.reduce((s, y) => s + (y.base ?? 0) + y.addons, 0);
}

function Marca({ estado }: { estado: string | undefined }) {
  if (estado === "incluido") return <span className="font-bold text-emerald-600">✓</span>;
  if (estado === "opcional") return <span className="text-[10px] font-semibold text-amber-600">Opcional</span>;
  if (estado === "no_ofrecido") return <span className="font-bold text-red-500">✗</span>;
  return <span className="text-zinc-400">—</span>;
}

export default function DocumentoCotizacion({ d }: { d: DatosDoc }) {
  const grupos = agrupar(d.planes);
  const conteo = new Map<string, number>();
  grupos.forEach((g) => conteo.set(g.aseguradora, (conteo.get(g.aseguradora) ?? 0) + 1));
  const beneficios = [...new Set(d.planes.flatMap((p) => p.beneficios.map((b) => b.nombre)))];
  // Orden de beneficios: el de la primera aseguradora que los trae
  const orden = (d.planes.find((p) => p.beneficios.length > 0)?.beneficios ?? []).map((b) => b.nombre);
  beneficios.sort((a, b) => (orden.indexOf(a) + 1 || 999) - (orden.indexOf(b) + 1 || 999));

  return (
    <div className="hoja mx-auto w-full max-w-[860px] space-y-4 bg-white p-5 text-zinc-800 print:max-w-none print:space-y-3 print:p-[10mm]">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 pb-2" style={{ borderColor: AZUL }}>
        <div>
          <p className="text-lg font-bold" style={{ color: AZUL }}>
            Cotización de Salud #{d.numero}
          </p>
          <p className="text-xs text-zinc-600">
            {d.cliente} · {new Date(d.fecha).toLocaleDateString("es-VE")} ·{" "}
            {d.tipo === "renovacion" ? "Renovación" : "Nueva póliza"}
          </p>
        </div>
        {d.organizacionLogo ? (
          <img src={d.organizacionLogo} alt={d.organizacion ?? ""} className="max-h-12 max-w-[180px] object-contain" />
        ) : (
          d.organizacion && <p className="text-sm font-semibold text-zinc-600">{d.organizacion}</p>
        )}
      </div>
      <p className="text-xs text-zinc-600">
        Asegurados: {d.asegurados.map((a) => `${a.nombre} (${a.edad} años)`).join(", ")}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
        {grupos.map((g) => (
          <Bloque key={g.clave} g={g} repetida={(conteo.get(g.aseguradora) ?? 0) > 1} />
        ))}
      </div>

      {beneficios.length > 0 && (
        <div className="sin-corte overflow-hidden rounded border border-zinc-300 text-[11px]">
          <p className="px-3 py-2 text-xs font-bold tracking-wide" style={{ background: CELESTE, color: "#1d4ed8" }}>
            BENEFICIOS DE SALUD POR ASEGURADORA
          </p>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 text-left">
                <th className="px-3 py-2">Beneficio</th>
                {grupos.map((g) => (
                  <th key={g.clave} className="px-2 py-2 text-center">
                    {g.logo ? (
                      <img src={g.logo} alt={g.aseguradora} className="mx-auto mb-0.5 h-6 max-w-[90px] object-contain" />
                    ) : (
                      g.aseguradora
                    )}
                    {(conteo.get(g.aseguradora) ?? 0) > 1 && (
                      <span className="block text-[10px] font-normal text-zinc-500">{g.plan}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {beneficios.map((n) => (
                <tr key={n} className="border-b border-zinc-100">
                  <td className="px-3 py-1.5 print:py-0.5">{n}</td>
                  {grupos.map((g) => (
                    <td key={g.clave} className="px-2 py-1.5 text-center print:py-0.5">
                      <Marca estado={g.planes[0].beneficios.find((b) => b.nombre === n)?.estado} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
