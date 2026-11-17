const EJE = "#71717a";
const REJILLA = "#27272a";

/** Valor "redondo" para el tope del eje Y. */
function tope(max: number) {
  if (max <= 4) return 4;
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 1.5, 2, 3, 4, 5, 6, 8, 10]) if (m * mag >= max) return m * mag;
  return max;
}

function Vacio({ alto }: { alto: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-zinc-500" style={{ height: alto }}>
      Sin datos en este período
    </div>
  );
}

export type Serie = { nombre: string; color: string; valores: number[] };

/** Líneas con área suave. Todas las series comparten las etiquetas del eje X. */
export function Lineas({ etiquetas, series, alto = 190 }: { etiquetas: string[]; series: Serie[]; alto?: number }) {
  const W = 600;
  const H = alto;
  const p = { l: 34, r: 10, t: 10, b: 24 };
  const maxReal = Math.max(0, ...series.flatMap((s) => s.valores));
  if (etiquetas.length === 0 || maxReal === 0) return <Vacio alto={alto} />;
  const max = tope(maxReal);
  const n = etiquetas.length;
  const x = (i: number) => p.l + (n === 1 ? (W - p.l - p.r) / 2 : (i * (W - p.l - p.r)) / (n - 1));
  const y = (v: number) => p.t + (1 - v / max) * (H - p.t - p.b);
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const paso = Math.max(1, Math.ceil(n / 7));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {marcas.map((m) => (
        <g key={m}>
          <line x1={p.l} x2={W - p.r} y1={y(m)} y2={y(m)} stroke={REJILLA} />
          <text x={p.l - 6} y={y(m) + 3} textAnchor="end" fontSize="10" fill={EJE}>
            {m}
          </text>
        </g>
      ))}
      {etiquetas.map((e, i) =>
        i % paso === 0 ? (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill={EJE}>
            {e}
          </text>
        ) : null,
      )}
      {series.map((s, k) => {
        const d = s.valores.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
        const area = `${d} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`;
        return (
          <g key={s.nombre}>
            {k === 0 && <path d={area} fill={s.color} opacity="0.12" />}
            <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
            {s.valores.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="6" fill="transparent">
                <title>{`${etiquetas[i]} · ${s.nombre}: ${v}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export type Barra = { etiqueta: string; valor: number; color?: string };

/** Barras verticales; `resaltar` colorea las N barras más altas. */
export function BarrasV({
  datos,
  color = "#14b8a6",
  resaltarTop = 0,
  colorTop = "#f59e0b",
  alto = 190,
  cadaEtiqueta = 1,
}: {
  datos: Barra[];
  color?: string;
  resaltarTop?: number;
  colorTop?: string;
  alto?: number;
  cadaEtiqueta?: number;
}) {
  const W = 600;
  const H = alto;
  const p = { l: 34, r: 10, t: 10, b: 24 };
  const max = tope(Math.max(0, ...datos.map((d) => d.valor)));
  if (datos.length === 0 || datos.every((d) => d.valor === 0)) return <Vacio alto={alto} />;
  const ancho = (W - p.l - p.r) / datos.length;
  const y = (v: number) => p.t + (1 - v / max) * (H - p.t - p.b);
  const top = new Set(
    resaltarTop > 0
      ? [...datos.keys()].sort((a, b) => datos[b].valor - datos[a].valor).slice(0, resaltarTop).filter((i) => datos[i].valor > 0)
      : [],
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const m = Math.round(max * f);
        return (
          <g key={f}>
            <line x1={p.l} x2={W - p.r} y1={y(m)} y2={y(m)} stroke={REJILLA} />
            <text x={p.l - 6} y={y(m) + 3} textAnchor="end" fontSize="10" fill={EJE}>
              {m}
            </text>
          </g>
        );
      })}
      {datos.map((d, i) => (
        <g key={i}>
          <rect
            x={p.l + i * ancho + ancho * 0.15}
            y={y(d.valor)}
            width={ancho * 0.7}
            height={Math.max(0, y(0) - y(d.valor))}
            rx="2"
            fill={d.color ?? (top.has(i) ? colorTop : color)}
          >
            <title>{`${d.etiqueta}: ${d.valor}`}</title>
          </rect>
          {i % cadaEtiqueta === 0 && (
            <text x={p.l + i * ancho + ancho / 2} y={H - 6} textAnchor="middle" fontSize="10" fill={EJE}>
              {d.etiqueta}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

const PALETA = ["#6366f1", "#14b8a6", "#f59e0b", "#ec4899", "#38bdf8", "#a3e635"];

/** Barras horizontales con etiqueta a la izquierda. */
export function BarrasH({ datos }: { datos: Barra[] }) {
  if (datos.length === 0) return <Vacio alto={120} />;
  const max = Math.max(1, ...datos.map((d) => d.valor));
  return (
    <div className="space-y-2.5">
      {datos.map((d, i) => (
        <div key={d.etiqueta} className="flex items-center gap-3 text-xs">
          <span className="w-20 shrink-0 text-right text-zinc-400">{d.etiqueta}</span>
          <div className="h-5 flex-1 rounded bg-zinc-800/60">
            <div
              className="h-5 rounded"
              style={{ width: `${(d.valor / max) * 100}%`, background: d.color ?? PALETA[i % PALETA.length] }}
              title={`${d.etiqueta}: ${d.valor}`}
            />
          </div>
          <span className="w-8 shrink-0 text-zinc-300">{d.valor}</span>
        </div>
      ))}
    </div>
  );
}

const PALETA_DONA = ["#6366f1", "#14b8a6", "#f59e0b", "#818cf8", "#38bdf8", "#ec4899", "#a3e635"];

/** Dona con total al centro y leyenda con porcentajes. */
export function Dona({ datos, centro = "Total" }: { datos: { etiqueta: string; valor: number }[]; centro?: string }) {
  const total = datos.reduce((a, d) => a + d.valor, 0);
  if (total === 0) return <Vacio alto={150} />;
  const R = 60;
  const C = 2 * Math.PI * R;
  let acum = 0;
  return (
    <div>
      <svg viewBox="0 0 160 160" className="mx-auto h-44 w-44" role="img">
        <g transform="rotate(-90 80 80)">
          {datos.map((d, i) => {
            const largo = (d.valor / total) * C;
            const el = (
              <circle
                key={d.etiqueta}
                cx="80"
                cy="80"
                r={R}
                fill="none"
                stroke={PALETA_DONA[i % PALETA_DONA.length]}
                strokeWidth="22"
                strokeDasharray={`${largo} ${C - largo}`}
                strokeDashoffset={-acum}
              >
                <title>{`${d.etiqueta}: ${d.valor} (${Math.round((d.valor / total) * 100)}%)`}</title>
              </circle>
            );
            acum += largo;
            return el;
          })}
        </g>
        <text x="80" y="80" textAnchor="middle" fontSize="22" fontWeight="700" fill="currentColor">
          {total.toLocaleString("es-VE")}
        </text>
        <text x="80" y="96" textAnchor="middle" fontSize="9" fill={EJE}>
          {centro}
        </text>
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
        {datos.map((d, i) => (
          <span key={d.etiqueta}>
            <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: PALETA_DONA[i % PALETA_DONA.length] }} />
            {d.etiqueta} ({Math.round((d.valor / total) * 100)}%)
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barras agrupadas: una pareja (o más) de barras por categoría. */
export function BarrasAgrupadas({
  categorias,
  series,
  alto = 190,
}: {
  categorias: string[];
  series: { nombre: string; color: string; valores: number[] }[];
  alto?: number;
}) {
  const W = 600;
  const H = alto;
  const p = { l: 34, r: 10, t: 10, b: 24 };
  const maxReal = Math.max(0, ...series.flatMap((s) => s.valores));
  if (categorias.length === 0 || maxReal === 0) return <Vacio alto={alto} />;
  const max = tope(maxReal);
  const y = (v: number) => p.t + (1 - v / max) * (H - p.t - p.b);
  const ancho = (W - p.l - p.r) / categorias.length;
  const bw = (ancho * 0.7) / series.length;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const m = Math.round(max * f);
          return (
            <g key={f}>
              <line x1={p.l} x2={W - p.r} y1={y(m)} y2={y(m)} stroke={REJILLA} />
              <text x={p.l - 6} y={y(m) + 3} textAnchor="end" fontSize="10" fill={EJE}>
                {m}
              </text>
            </g>
          );
        })}
        {categorias.map((c, i) => (
          <g key={c}>
            {series.map((s, k) => (
              <rect
                key={s.nombre}
                x={p.l + i * ancho + ancho * 0.15 + k * bw}
                y={y(s.valores[i])}
                width={bw - 1}
                height={Math.max(0, y(0) - y(s.valores[i]))}
                rx="2"
                fill={s.color}
              >
                <title>{`${c} · ${s.nombre}: ${s.valores[i]}`}</title>
              </rect>
            ))}
            <text x={p.l + i * ancho + ancho / 2} y={H - 6} textAnchor="middle" fontSize="10" fill={EJE}>
              {c}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-zinc-400">
        {series.map((s) => (
          <span key={s.nombre}>
            <span className="mr-1 inline-block h-2 w-3 rounded" style={{ background: s.color }} />
            {s.nombre}
          </span>
        ))}
      </div>
    </div>
  );
}
