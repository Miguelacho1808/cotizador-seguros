import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import DocumentoCotizacion, { type PlanDoc } from "../components/DocumentoCotizacion";

const usd = (n: number) => `$${Number(n).toLocaleString("es-VE")}`;

type Plan = PlanDoc & { id: string };
type Datos = {
  numero: number;
  fecha: string;
  grupo: string;
  tipo: string;
  cliente: { nombre: string; apellido: string | null } | null;
  asegurados: { nombre: string; edad: number; sexo: string; titular: boolean }[];
  planes: Plan[];
  asesor: { nombre: string; apellido: string | null; whatsapp: string | null } | null;
  organizacion: { nombre: string; rif: string | null; telefono: string | null; logo_url?: string | null } | null;
};

const GRUPO: Record<string, string> = { individual: "Plan Individual", pareja: "Plan Pareja", familiar: "Plan Familiar" };

export default function Compartida() {
  const { token } = useParams();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [estado, setEstado] = useState<"cargando" | "no" | "ok">("cargando");
  const [verPdf, setVerPdf] = useState(false);

  useEffect(() => {
    supabase.rpc("obtener_cotizacion_compartida", { p_token: token }).then(({ data, error }) => {
      if (error || !data) setEstado("no");
      else {
        setDatos(data as Datos);
        setEstado("ok");
      }
    });
  }, [token]);

  const calc = useMemo(() => {
    if (!datos) return null;
    const planes = datos.planes;
    if (planes.length === 0) return null;
    const masBarata = [...planes].sort((a, b) => a.prima_mensual - b.prima_mensual)[0];
    const menorCob = Math.min(...planes.map((p) => p.cobertura_monto));
    const mayorCob = Math.max(...planes.map((p) => p.cobertura_monto));
    const esencial = planes
      .filter((p) => p.cobertura_monto === menorCob)
      .sort((a, b) => a.prima_mensual - b.prima_mensual)[0];
    const prima =
      menorCob !== mayorCob
        ? planes.filter((p) => p.cobertura_monto === mayorCob).sort((a, b) => a.prima_mensual - b.prima_mensual)[0]
        : null;
    const porAseg = new Map<string, Plan[]>();
    for (const p of planes) porAseg.set(p.aseguradora_nombre, [...(porAseg.get(p.aseguradora_nombre) ?? []), p]);
    const grupos = [...porAseg.entries()].map(([nombre, lista]) => ({
      nombre,
      logo: lista[0].logo_url ?? null,
      lista: [...lista].sort((a, b) => a.cobertura_monto - b.cobertura_monto || a.prima_anual - b.prima_anual),
    }));
    return { masBarata, esencial, prima, grupos };
  }, [datos]);

  if (estado === "cargando") return <p className="p-8 text-center text-zinc-400">Cargando cotización…</p>;
  if (estado === "no" || !datos || !calc)
    return <p className="p-8 text-center text-zinc-400">Esta cotización no existe o el enlace no es válido.</p>;

  const cliente = [datos.cliente?.nombre, datos.cliente?.apellido].filter(Boolean).join(" ");
  const tel = (datos.asesor?.whatsapp ?? datos.organizacion?.telefono ?? "").replace(/\D/g, "");
  const fecha = new Date(datos.fecha).toLocaleDateString("es-VE");

  const wa = (texto: string) => (tel ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` : undefined);
  const textoOpcion = (p: Plan) =>
    `Hola, soy ${cliente}. Me interesa la opción ${p.aseguradora_nombre} (${p.plan_nombre}) con cobertura de USD ${p.cobertura_monto.toLocaleString("es-VE")} a ${usd(p.prima_mensual)}/mes, de la cotización #${datos.numero}.`;
  const textoInfo = `Hola, soy ${cliente}. Quisiera más información sobre mi cotización #${datos.numero}.`;

  const Boton = ({ p, clase, texto }: { p: Plan; clase: string; texto: string }) => {
    const href = wa(textoOpcion(p));
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`block rounded-lg py-2.5 text-center text-sm font-bold text-white ${clase} ${href ? "" : "pointer-events-none opacity-50"}`}
      >
        {texto}
      </a>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-24 text-slate-900" style={{ colorScheme: "light" }}>
      <div className="mx-auto max-w-xl">
        <header className="flex items-center justify-between gap-3 bg-slate-900 px-4 py-5 text-white">
          <div className="flex h-14 w-24 items-center justify-center rounded-lg bg-white p-1.5">
            {datos.organizacion?.logo_url ? (
              <img src={datos.organizacion.logo_url} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-center text-[10px] font-bold leading-tight text-slate-800">
                {datos.organizacion?.nombre}
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">♡ Cotización de Salud</p>
            <p className="text-xs text-slate-300">
              #{datos.numero} · {fecha}
            </p>
            <span className="mt-1 inline-block rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-900">
              {GRUPO[datos.grupo] ?? datos.grupo}
            </span>
          </div>
        </header>

        <section className="space-y-2 bg-white px-4 py-4">
          <p className="text-lg font-bold">{cliente}</p>
          <div className="flex flex-wrap gap-2">
            {datos.asegurados.map((a, i) => (
              <span key={i} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                {a.nombre.split(" ")[0]} · {a.edad}/{a.sexo}
              </span>
            ))}
          </div>
        </section>

        <div className="space-y-5 p-4">
          <section className="overflow-hidden rounded-2xl bg-slate-900 text-white shadow-lg">
            <div className="space-y-2 p-4">
              <span className="inline-block rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold">
                ★ Mejor precio
              </span>
              <p className="text-xl font-bold">{calc.masBarata.aseguradora_nombre}</p>
              <p className="text-sm text-slate-300">
                {calc.masBarata.plan_nombre} · Cobertura USD {calc.masBarata.cobertura_monto.toLocaleString("es-VE")}
              </p>
            </div>
            <div className="space-y-3 bg-slate-800 p-4">
              <p className="text-center text-4xl font-extrabold">
                {usd(calc.masBarata.prima_mensual)} <span className="text-sm font-normal text-slate-300">/mes</span>
              </p>
              <Boton p={calc.masBarata} clase="bg-emerald-500 hover:bg-emerald-600" texto="Asegurarme ahora →" />
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-bold">Opciones rápidas</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 rounded-xl border-2 border-emerald-400 bg-white p-3">
                <span className="inline-block rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  Plan Esencial
                </span>
                <p className="text-xs text-slate-600">Lo justo y necesario para estar protegido</p>
                <p className="text-[10px] text-slate-400">Cobertura USD {calc.esencial.cobertura_monto.toLocaleString("es-VE")}</p>
                <p className="text-xl font-extrabold">
                  {usd(calc.esencial.prima_mensual)} <span className="text-[10px] font-normal text-slate-400">/mes</span>
                </p>
                <p className="text-[10px] text-slate-400">{calc.esencial.aseguradora_nombre}</p>
                <Boton p={calc.esencial} clase="bg-emerald-500 hover:bg-emerald-600 !py-1.5 !text-xs" texto="Elegir Plan Esencial →" />
              </div>
              {calc.prima && (
                <div className="space-y-1.5 rounded-xl border-2 border-fuchsia-400 bg-white p-3">
                  <span className="inline-block rounded-full bg-fuchsia-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    Protección Prima
                  </span>
                  <p className="text-xs text-slate-600">Máxima tranquilidad y protección</p>
                  <p className="text-[10px] text-slate-400">Cobertura USD {calc.prima.cobertura_monto.toLocaleString("es-VE")}</p>
                  <p className="text-xl font-extrabold">
                    {usd(calc.prima.prima_mensual)} <span className="text-[10px] font-normal text-slate-400">/mes</span>
                  </p>
                  <p className="text-[10px] text-slate-400">{calc.prima.aseguradora_nombre}</p>
                  <Boton p={calc.prima} clase="bg-fuchsia-500 hover:bg-fuchsia-600 !py-1.5 !text-xs" texto="Obtener Prot. Prima →" />
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-bold">Opciones cotizadas</p>
            {calc.grupos.map((g) => (
              <div key={g.nombre} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex h-14 items-center justify-center rounded-xl border border-slate-100 bg-white p-2">
                  {g.logo ? (
                    <img src={g.logo} alt={g.nombre} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-lg font-bold text-slate-800">{g.nombre}</span>
                  )}
                </div>
                {g.lista.map((p) => (
                  <div key={p.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold">USD {p.cobertura_monto.toLocaleString("es-VE")}</p>
                        <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          {p.plan_nombre}
                        </span>
                        {Number(p.deducible) > 0 && (
                          <span className="ml-1 text-[10px] text-slate-400">Deducible {usd(p.deducible)}</span>
                        )}
                      </div>
                      <p className="text-2xl font-extrabold">
                        {usd(p.prima_mensual)} <span className="text-[10px] font-normal text-slate-400">/mes</span>
                      </p>
                    </div>
                    <details className="border-t border-dashed border-slate-200 pt-2 text-xs text-slate-600">
                      <summary className="cursor-pointer text-sky-600">+ Ver desglose por persona</summary>
                      <ul className="mt-2 space-y-1">
                        {(p.desglose?.porPersona ?? []).map((x, i) => (
                          <li key={i} className="flex justify-between">
                            <span>
                              {x.nombre.split(" ")[0]} · {x.edad} años
                            </span>
                            <span>{x.base === null ? "Grupo" : usd(x.base + x.addons)}/año</span>
                          </li>
                        ))}
                        <li className="flex justify-between border-t border-slate-100 pt-1 font-semibold">
                          <span>Anual</span>
                          <span>{usd(p.prima_anual)}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Semestral</span>
                          <span>{usd(p.prima_semestral)}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Trimestral</span>
                          <span>{usd(p.prima_trimestral)}</span>
                        </li>
                      </ul>
                      {p.addons.length > 0 && <p className="mt-1 text-slate-400">Incluye: {p.addons.join(", ")}</p>}
                    </details>
                    <Boton p={p} clase="bg-emerald-500 hover:bg-emerald-600" texto="Seleccionar esta opción" />
                  </div>
                ))}
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <button
              onClick={() => setVerPdf(!verPdf)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700"
            >
              {verPdf ? "Ocultar comparativa" : "Ver comparativa y beneficios (PDF)"}
            </button>
            {verPdf && (
              <>
                <button
                  onClick={() => window.print()}
                  className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white print:hidden"
                >
                  Imprimir / Guardar PDF
                </button>
                <div className="overflow-x-auto rounded-xl bg-white">
                  <DocumentoCotizacion
                    d={{
                      numero: datos.numero,
                      fecha: datos.fecha,
                      tipo: datos.tipo,
                      organizacion: datos.organizacion?.nombre ?? null,
                      organizacionLogo: datos.organizacion?.logo_url ?? null,
                      cliente,
                      asegurados: datos.asegurados,
                      planes: datos.planes,
                    }}
                  />
                </div>
              </>
            )}
          </section>

          {datos.asesor && (
            <p className="text-center text-xs text-slate-500">
              Tu asesor: <strong>{[datos.asesor.nombre, datos.asesor.apellido].filter(Boolean).join(" ")}</strong>
            </p>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-slate-100 via-slate-100 to-transparent p-3 print:hidden">
        <a
          href={wa(textoInfo)}
          target="_blank"
          rel="noopener noreferrer"
          className={`mx-auto block max-w-xl rounded-xl bg-sky-500 py-3 text-center text-sm font-bold text-white shadow-lg ${tel ? "" : "pointer-events-none opacity-50"}`}
        >
          Obtener más información 👋
        </a>
      </div>
    </div>
  );
}
