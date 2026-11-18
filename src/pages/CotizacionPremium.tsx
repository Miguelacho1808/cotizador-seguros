import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { telefonoWhatsApp } from "../lib/telefono";
import {
  AVISO_LEGAL,
  DETALLE,
  DETALLE_INTRO,
  DETALLE_NOTA,
  EXTRAS,
  NOTA_PRIMAS,
  PIE,
  PORTABILIDAD,
  PORTADA,
  PRINCIPALES,
  SERVICIO_SALUD,
  VIAJES,
  esMercantilPanama,
} from "../lib/premiumMercantilPanama";

type PlanRow = {
  plan_id: string | null;
  aseguradora_nombre: string;
  plan_nombre: string;
  cobertura_monto: number;
  deducible: number;
  prima_anual: number;
  desglose: { porPersona?: { nombre: string; edad: number; base: number | null; addons: number }[] } | null;
};
type Cot = {
  numero: number;
  created_at: string;
  clientes: { nombre: string; apellido: string | null; cedula: string | null; telefono: string | null; email: string | null } | null;
  perfiles: { nombre: string | null; apellido: string | null } | null;
  cotizacion_asegurados: { nombre: string; edad: number; sexo: string; es_titular: boolean; orden: number }[];
  cotizacion_planes: PlanRow[];
};

const AZUL = "#0a58ab";
const NAVY = "#0b1b3a";
const BANDA = "#f1f6fb";

// es-ES no agrupa los números de 4 cifras ("2508") y sí los de 5 o más ("10.000"), como la cotización de referencia
const n0 = (n: number) => Math.round(n).toLocaleString("es-ES", { maximumFractionDigits: 0 });
const us = (n: number) => `US$ ${n0(n)}`;

function Encabezado({ kicker, titulo, claro }: { kicker: string; titulo: string; claro?: boolean }) {
  return (
    <div className="mb-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: claro ? "#cfe2ff" : AZUL }}>
        {kicker}
      </p>
      <h2 className="mt-1 text-[28px] font-extrabold leading-tight" style={{ color: claro ? "#fff" : NAVY }}>
        {titulo}
      </h2>
      <div className="mt-3 h-[3px] w-12 rounded" style={{ background: claro ? "#fff" : AZUL }} />
    </div>
  );
}

function Seccion({ children, fondo, className = "" }: { children: ReactNode; fondo?: string; className?: string }) {
  return (
    <section className={`px-9 py-10 ${className}`} style={fondo ? { background: fondo } : undefined}>
      {children}
    </section>
  );
}

function Tarjeta({ etiqueta, valor, nota, oscura }: { etiqueta: string; valor: string; nota: string; oscura?: boolean }) {
  return (
    <div
      className="break-inside-avoid rounded-2xl border p-5"
      style={oscura ? { background: "rgba(255,255,255,.1)", borderColor: "rgba(255,255,255,.25)", color: "#fff" } : { background: "#fff", borderColor: "#dbe3ee" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: oscura ? "#cfe2ff" : AZUL }}>
        {etiqueta}
      </p>
      <p className="mt-2 text-[28px] font-extrabold leading-none" style={{ color: oscura ? "#fff" : NAVY }}>
        {valor}
      </p>
      <p className="mt-2 text-[13px]" style={{ color: oscura ? "#dbe7f7" : "#5b6b82" }}>
        {nota}
      </p>
    </div>
  );
}

const Icono = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={AZUL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
    <path d="M12 8.5v6M9 11.5h6" />
  </svg>
);

export default function CotizacionPremium() {
  const { id } = useParams();
  const [cot, setCot] = useState<Cot | null>(null);
  const [org, setOrg] = useState<{ nombre: string; logo_url: string | null } | null>(null);
  const [logoAseg, setLogoAseg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cada página impresa lleva su propio margen (el global del panel es 0) y se conservan los colores de fondo
  useEffect(() => {
    const st = document.createElement("style");
    st.textContent =
      "@media print{@page{size:A4;margin:12mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}";
    document.head.appendChild(st);
    return () => {
      st.remove();
    };
  }, []);

  useEffect(() => {
    supabase
      .from("cotizaciones")
      .select(
        "numero,created_at,clientes(nombre,apellido,cedula,telefono,email),perfiles(nombre,apellido),cotizacion_asegurados(nombre,edad,sexo,es_titular,orden),cotizacion_planes(plan_id,aseguradora_nombre,plan_nombre,cobertura_monto,deducible,prima_anual,desglose)",
      )
      .eq("id", id!)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (error) return setError(error.message);
        if (!data) return setError("Cotización no encontrada.");
        const c = data as unknown as Cot;
        setCot(c);
        const pid = c.cotizacion_planes.find((p) => esMercantilPanama(p.aseguradora_nombre))?.plan_id;
        if (pid) {
          const r = await supabase.from("planes").select("aseguradoras(logo_url)").eq("id", pid).maybeSingle();
          setLogoAseg((r.data as unknown as { aseguradoras: { logo_url: string | null } | null } | null)?.aseguradoras?.logo_url ?? null);
        }
      });
    supabase
      .from("organizacion")
      .select("nombre,logo_url")
      .maybeSingle()
      .then(({ data }) => setOrg((data as { nombre: string; logo_url: string | null } | null) ?? null));
  }, [id]);

  if (error) return <p className="p-6 text-red-500">{error}</p>;
  if (!cot) return <p className="p-6 text-zinc-500">Cargando…</p>;

  const planes = cot.cotizacion_planes
    .filter((p) => esMercantilPanama(p.aseguradora_nombre))
    .sort((a, b) => a.cobertura_monto - b.cobertura_monto || a.deducible - b.deducible);

  if (planes.length === 0)
    return (
      <div className="space-y-3 p-6">
        <p>Esta cotización no incluye planes de Mercantil Panamá.</p>
        <Link to={`/cotizaciones/${id}`} className="text-indigo-500 underline">
          ← Volver a la cotización
        </Link>
      </div>
    );

  const coberturas = [...new Set(planes.map((p) => p.cobertura_monto))];
  const maxCob = Math.max(...coberturas);
  const minCob = Math.min(...coberturas);
  const asegurados = [...cot.cotizacion_asegurados].sort((a, b) => a.orden - b.orden);
  const personas = planes[0].desglose?.porPersona ?? [];
  const hayAddons = planes.some((p) => (p.desglose?.porPersona ?? []).some((x) => x.addons > 0));
  const cliente = cot.clientes;
  const nombreCliente = [cliente?.apellido, cliente?.nombre].filter(Boolean).join(" ") || "—";
  const tel = telefonoWhatsApp(cliente?.telefono);
  const telTxt = tel && /^58\d{10}$/.test(tel) ? `+58 ${tel.slice(2, 5)} ${tel.slice(5, 8)} ${tel.slice(8)}` : (cliente?.telefono ?? "—");
  const ejecutivo = [cot.perfiles?.nombre, cot.perfiles?.apellido].filter(Boolean).join(" ") || "—";
  const sexo = (s: string) => (s === "F" ? "Femenino" : "Masculino");

  const filaTabla = "border-t border-slate-200";
  const celda = "px-4 py-3 text-right";
  const col1 = { background: "#dbeafe" };

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0" style={{ color: NAVY, fontFamily: "Inter, system-ui, 'Segoe UI', Roboto, sans-serif" }}>
      <div className="mx-auto max-w-[1013px] bg-white shadow-sm print:max-w-none print:shadow-none">
        {/* Portada */}
        <section className="grid items-center gap-8 px-9 py-12 md:grid-cols-2 print:grid-cols-2" style={{ background: "linear-gradient(135deg,#e7f0fb,#f8fbff)" }}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: AZUL }}>
              {PORTADA.kicker}
            </p>
            <h1 className="mt-3 text-[48px] font-extrabold leading-none" style={{ color: NAVY }}>
              {PORTADA.titulo}
            </h1>
            <p className="mt-4 text-[20px] font-bold" style={{ color: AZUL }}>
              {coberturas.length > 1 ? `Desde ${us(minCob)}` : us(maxCob)} / asegurado / año
            </p>
            <p className="mt-6 text-[16px] leading-relaxed text-slate-600">{PORTADA.descripcion}</p>
            <p className="mt-5 text-[14px] leading-relaxed text-slate-500">{PORTADA.saludo}</p>
          </div>
          <img
            src="/premium/familia.jpg"
            alt=""
            className="w-full rounded-3xl object-cover shadow-xl"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        </section>

        {/* 01 Datos */}
        <Seccion>
          <Encabezado kicker="01 · DATOS" titulo="Solicitante" />
          <div className="grid gap-x-6 gap-y-5 rounded-2xl border border-slate-200 p-6 sm:grid-cols-3 print:grid-cols-3">
            {[
              ["APELLIDO(S) Y NOMBRE(S)", nombreCliente],
              ["DOCUMENTO", cliente?.cedula || "—"],
              ["TELÉFONO", telTxt],
              ["EMAIL", cliente?.email || "—"],
              ["PAÍS DE RESIDENCIA", "Venezuela"],
              ["EJECUTIVO", ejecutivo],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{k}</p>
                <p className="mt-1 break-words text-[15px] font-semibold">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {asegurados.map((a, i) => (
              <div key={i} className="break-inside-avoid rounded-2xl border border-slate-200 px-5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {a.es_titular ? "TITULAR" : "DEPENDIENTE"}
                </p>
                <p className="mt-1 text-[14px] font-semibold">
                  {a.nombre} · {sexo(a.sexo)} · {a.edad} años
                </p>
              </div>
            ))}
          </div>
        </Seccion>

        {/* 02 Coberturas */}
        <Seccion fondo={BANDA}>
          <Encabezado kicker="02 · COBERTURAS" titulo="Beneficios principales" />
          <div className="grid gap-4 sm:grid-cols-3 print:grid-cols-3">
            <Tarjeta
              etiqueta="BENEFICIO MÁXIMO"
              valor={us(maxCob)}
              nota={coberturas.length > 1 ? "por Asegurado / Año Póliza (según opción)" : "por Asegurado / Año Póliza"}
            />
            {PRINCIPALES.map((p) => (
              <Tarjeta key={p.etiqueta} etiqueta={p.etiqueta} valor={p.valor} nota={p.nota} />
            ))}
          </div>
        </Seccion>

        {/* 03 Primas */}
        <Seccion>
          <Encabezado kicker="03 · PRIMAS ANUALES" titulo="Opciones de plan (US$)" />
          <p className="mb-4 text-[13px] text-slate-500">Montos referenciales. Los valores finales serán los que genere nuestro sistema al emitir el recibo.</p>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[560px] text-[14px]">
              <thead>
                <tr style={{ background: "#f3f6fa" }}>
                  <th className="px-4 py-3 text-left font-bold">País de residencia: Venezuela</th>
                  {planes.map((_, i) => (
                    <th key={i} className="px-4 py-3 text-right font-bold" style={i === 0 ? { background: AZUL, color: "#fff" } : undefined}>
                      Opción {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className={filaTabla}>
                  <td className="px-4 py-3 font-bold">Suma Asegurada (Cobertura)</td>
                  {planes.map((p, i) => (
                    <td key={i} className={`${celda} font-bold`} style={i === 0 ? col1 : undefined}>
                      {us(p.cobertura_monto)}
                    </td>
                  ))}
                </tr>
                <tr className={filaTabla}>
                  <td className="px-4 py-3">Deducible Local</td>
                  {planes.map((_, i) => (
                    <td key={i} className={celda} style={i === 0 ? col1 : undefined}>
                      US$ 0
                    </td>
                  ))}
                </tr>
                <tr className={filaTabla}>
                  <td className="px-4 py-3">Deducible Internacional</td>
                  {planes.map((p, i) => (
                    <td key={i} className={celda} style={i === 0 ? col1 : undefined}>
                      {us(p.deducible)}
                    </td>
                  ))}
                </tr>
                {personas.map((pp, k) => {
                  const a = asegurados[k];
                  return (
                    <tr key={k} className={filaTabla}>
                      <td className="px-4 py-3">
                        {pp.nombre} ({a ? a.sexo : "?"}, {pp.edad} años)
                      </td>
                      {planes.map((p, i) => (
                        <td key={i} className={celda} style={i === 0 ? col1 : undefined}>
                          {p.desglose?.porPersona?.[k]?.base != null ? us(p.desglose.porPersona[k].base as number) : "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {hayAddons && (
                  <tr className={filaTabla}>
                    <td className="px-4 py-3">Coberturas adicionales (add-ons)</td>
                    {planes.map((p, i) => (
                      <td key={i} className={celda} style={i === 0 ? col1 : undefined}>
                        {us((p.desglose?.porPersona ?? []).reduce((s, x) => s + x.addons, 0))}
                      </td>
                    ))}
                  </tr>
                )}
                <tr className="border-t-2 border-slate-300 font-bold">
                  <td className="px-4 py-3">Prima Total (USD)</td>
                  {planes.map((p, i) => (
                    <td key={i} className={celda} style={i === 0 ? col1 : undefined}>
                      {us(p.prima_anual)}
                    </td>
                  ))}
                </tr>
                <tr className={filaTabla}>
                  <td className="px-4 py-3">Impuesto (USD)</td>
                  {planes.map((_, i) => (
                    <td key={i} className={celda} style={i === 0 ? col1 : undefined}>
                      $0.00
                    </td>
                  ))}
                </tr>
                <tr className={`${filaTabla} font-bold`}>
                  <td className="px-4 py-3">TOTAL (USD)</td>
                  {planes.map((p, i) => (
                    <td key={i} className={celda} style={i === 0 ? col1 : undefined}>
                      {us(p.prima_anual)}
                    </td>
                  ))}
                </tr>
                <tr style={{ background: "#eef2f7" }}>
                  <td colSpan={planes.length + 1} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">
                    Frecuencias de pago
                  </td>
                </tr>
                {(
                  [
                    ["Mensual", 12],
                    ["Trimestral", 4],
                    ["Semestral", 2],
                    ["Anual", 1],
                  ] as [string, number][]
                ).map(([nombre, d]) => (
                  <tr key={nombre} className={`${filaTabla} ${nombre === "Anual" ? "font-bold" : ""}`}>
                    <td className="px-4 py-3">{nombre}</td>
                    {planes.map((p, i) => (
                      <td key={i} className={celda} style={i === 0 ? col1 : undefined}>
                        {us(p.prima_anual / d)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[11.5px] leading-relaxed text-slate-500">{NOTA_PRIMAS}</p>
        </Seccion>

        {/* 04 Detalle */}
        <Seccion fondo={BANDA}>
          <Encabezado kicker="04 · DETALLE" titulo="Descripción de coberturas y principales beneficios" />
          <div className="break-inside-avoid rounded-2xl border border-slate-200 bg-white p-6 text-[14.5px] leading-relaxed">
            {DETALLE_INTRO.map((t) => (
              <p key={t} className="mb-2">
                {t}
              </p>
            ))}
            <p className="mt-3 text-[13px] italic" style={{ color: AZUL }}>
              {DETALLE_NOTA}
            </p>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {DETALLE.map((d, i) => (
              <div key={d.titulo} className={`grid break-inside-avoid gap-4 px-6 py-5 md:grid-cols-[1fr_1.4fr] print:grid-cols-[1fr_1.4fr] ${i > 0 ? "border-t border-slate-200" : ""}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "#e6f0fb" }}>
                    <Icono />
                  </span>
                  <p className="pt-1 text-[14.5px] font-bold leading-snug">{d.titulo}</p>
                </div>
                <div className="space-y-1.5 text-[13.5px] leading-relaxed text-slate-600">
                  {d.lineas.map((l) => (
                    <p key={l}>{l}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Seccion>

        {/* 05 Extras */}
        <Seccion>
          <Encabezado kicker="05 · EXTRAS" titulo="Beneficios adicionales" />
          <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
            {EXTRAS.map((t) => (
              <div key={t} className="flex break-inside-avoid gap-3 rounded-2xl border border-slate-200 p-4 text-[14px] leading-relaxed text-slate-700">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: AZUL }} />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </Seccion>

        {/* 06 Salud */}
        <Seccion fondo={BANDA}>
          <Encabezado kicker="06 · SALUD" titulo="Servicio Integral de Salud" />
          <div className="grid gap-3 sm:grid-cols-3 print:grid-cols-3">
            {SERVICIO_SALUD.map((t) => (
              <div key={t} className="break-inside-avoid rounded-2xl border border-slate-200 bg-white px-4 py-4 text-[14px]">
                {t}
              </div>
            ))}
          </div>
        </Seccion>

        {/* 07 Viajes */}
        <Seccion fondo={AZUL} className="text-white">
          <Encabezado kicker="07 · COBERTURA GLOBAL" titulo="Cobertura de Asistencia en Viajes" claro />
          <p className="max-w-[760px] text-[15px] leading-relaxed text-blue-50">{VIAJES.texto}</p>
          <img
            src="/premium/viajes.jpg"
            alt=""
            className="mt-6 max-h-[360px] w-full rounded-2xl object-cover"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <div className="mt-6 inline-block break-inside-avoid rounded-2xl border px-5 py-4" style={{ background: "rgba(255,255,255,.1)", borderColor: "rgba(255,255,255,.25)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100">WhatsApp de emergencia</p>
            <p className="mt-1 text-[24px] font-extrabold">{VIAJES.whatsapp}</p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3 print:grid-cols-3">
            {VIAJES.tarjetas.map((t) => (
              <Tarjeta key={t.etiqueta} etiqueta={t.etiqueta} valor={t.valor} nota={t.nota} oscura />
            ))}
          </div>
        </Seccion>

        {/* 08 Portabilidad */}
        <Seccion>
          <Encabezado kicker="08 · PORTABILIDAD" titulo="Portabilidad de la Póliza" />
          <div className="break-inside-avoid rounded-2xl border border-slate-200 p-6 text-[15px] leading-relaxed text-slate-700">
            <p>{PORTABILIDAD.intro}</p>
            <ul className="my-4 grid gap-3 sm:grid-cols-2 print:grid-cols-2">
              {PORTABILIDAD.paises.map((p) => (
                <li key={p} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: AZUL }} />
                  {p}
                </li>
              ))}
            </ul>
            <p>{PORTABILIDAD.eeuu}</p>
          </div>
          <div className="mt-4 space-y-3 break-inside-avoid rounded-2xl border border-slate-200 p-6 text-[12.5px] leading-relaxed text-slate-500" style={{ background: BANDA }}>
            {AVISO_LEGAL.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        </Seccion>

        {/* Pie */}
        <footer className="flex break-inside-avoid flex-wrap items-center gap-6 border-t border-slate-200 px-9 py-6" style={{ background: "#f8fafc" }}>
          <div className="flex items-center gap-4">
            {org?.logo_url && <img src={org.logo_url} alt={org.nombre} className="h-12 object-contain" />}
            {org?.nombre && <span className="text-[12px] text-slate-500">{org.nombre}</span>}
            {logoAseg && <img src={logoAseg} alt="Mercantil" className="h-10 object-contain" />}
          </div>
          <div className="min-w-[260px] flex-1 text-[11px] leading-relaxed text-slate-500">
            <p className="font-semibold text-slate-700">{PIE[0]}</p>
            {PIE.slice(1).map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        </footer>
      </div>

      {/* Acciones (no se imprimen) */}
      <div className="fixed bottom-5 right-5 flex gap-3 print:hidden">
        <Link to={`/cotizaciones/${id}`} className="rounded-xl bg-white px-5 py-3 text-sm font-bold shadow-lg" style={{ color: NAVY }}>
          ← Volver
        </Link>
        <button onClick={() => window.print()} className="rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg" style={{ background: NAVY }}>
          Imprimir
        </button>
        <button onClick={() => window.print()} className="rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg" style={{ background: AZUL }}>
          Descargar PDF
        </button>
      </div>
    </div>
  );
}
