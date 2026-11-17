import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

type Plan = { id: string; nombre: string; tipo: string; activo: boolean; area: string };
type Aseguradora = {
  id: string;
  nombre: string;
  logo_url: string | null;
  ciudad: string | null;
  fundada_en: number | null;
  activa: boolean;
  estatus_integracion: string;
  comision_pct: number | null;
  rating: number | null;
  planes: Plan[];
};
type Resumen = { aseguradora_id: string; coberturas: number; addons: string[] };

const TIPO: Record<string, string> = { hcm: "HCM", emca: "Emergencia médica", amy: "Adulto mayor" };
const ORDEN_TIPOS = ["hcm", "emca", "amy"];
const ESTATUS: Record<string, { texto: string; cls: string }> = {
  premier_partner: { texto: "Premier partner", cls: "bg-violet-200 text-violet-900" },
  integrado: { texto: "Integrado", cls: "bg-emerald-200 text-emerald-900" },
  en_revision: { texto: "En revisión", cls: "bg-amber-200 text-amber-900" },
  por_integrar: { texto: "Por integrar", cls: "bg-sky-200 text-sky-900" },
};
const AREA: Record<string, { texto: string; cls: string }> = {
  salud: { texto: "♡ Salud", cls: "bg-rose-100 text-rose-700" },
  hogar: { texto: "⌂ Hogar", cls: "bg-emerald-100 text-emerald-700" },
};
type Filtro = "todos" | "activas" | "inactivas";

export default function Aseguradoras() {
  const { perfil } = useAuth();
  const navigate = useNavigate();
  const [lista, setLista] = useState<Aseguradora[] | null>(null);
  const [resumen, setResumen] = useState<Record<string, Resumen>>({});
  const [filtro, setFiltro] = useState<Filtro>("activas");
  const [error, setError] = useState<string | null>(null);
  const esAdmin = perfil?.rol === "admin";

  const cargar = () => {
    supabase
      .from("aseguradoras")
      .select("id,nombre,logo_url,ciudad,fundada_en,activa,estatus_integracion,comision_pct,rating,planes(id,nombre,tipo,activo,area)")
      .order("nombre")
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setLista((data as unknown as Aseguradora[]) ?? []);
      });
    supabase.rpc("resumen_aseguradoras").then(({ data }) => {
      const m: Record<string, Resumen> = {};
      for (const r of (data as Resumen[]) ?? []) m[r.aseguradora_id] = r;
      setResumen(m);
    });
  };
  useEffect(cargar, []);

  const nueva = async () => {
    const nombre = window.prompt("Nombre de la nueva aseguradora");
    if (!nombre || !nombre.trim()) return;
    const r = await supabase.from("aseguradoras").insert({ nombre: nombre.trim() }).select("id").single();
    if (r.error) setError(r.error.message);
    else navigate(`/aseguradoras/${(r.data as { id: string }).id}`);
  };

  const eliminar = async (a: Aseguradora) => {
    const ok = window.confirm(
      `Vas a eliminar "${a.nombre}" con sus ${a.planes.length} planes y TODAS sus tarifas. No se puede deshacer. ¿Continuar?`,
    );
    if (!ok) return;
    const r = await supabase.from("aseguradoras").delete().eq("id", a.id);
    if (r.error) setError(r.error.message);
    else cargar();
  };

  const k = useMemo(() => {
    const act = (lista ?? []).filter((a) => a.activa);
    const comis = act.map((a) => a.comision_pct).filter((x): x is number => x !== null && x !== undefined);
    return {
      activas: act.length,
      total: lista?.length ?? 0,
      planes: act.reduce((n, a) => n + a.planes.filter((p) => p.activo).length, 0),
      comision: comis.length ? comis.reduce((x, y) => x + Number(y), 0) / comis.length : null,
      integradas: act.filter((a) => ["integrado", "premier_partner"].includes(a.estatus_integracion)).length,
    };
  }, [lista]);

  const visibles = (lista ?? []).filter((a) => (filtro === "todos" ? true : filtro === "activas" ? a.activa : !a.activa));
  const tarjeta = "rounded-xl border border-zinc-800 bg-zinc-900 p-4";
  const rotulo = "text-[11px] font-semibold uppercase tracking-wider text-zinc-400";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Catálogo</p>
          <h1 className="text-4xl font-extrabold">
            Empresas <em className="text-indigo-400">aseguradoras</em>
          </h1>
          <p className="mt-1 text-sm text-zinc-400">Las compañías con las que trabajas y sus planes activos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-zinc-700 text-sm">
            {(["todos", "activas", "inactivas"] as Filtro[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`px-4 py-2 capitalize ${
                  filtro === f ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {esAdmin && (
            <button
              onClick={nueva}
              className="rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-white"
            >
              + Nueva aseguradora
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={tarjeta}>
          <p className={rotulo}>Aseguradoras activas</p>
          <p className="mt-1 text-3xl font-extrabold">
            {lista ? k.activas : "…"} <span className="text-xs font-semibold text-emerald-400">de {k.total} registradas</span>
          </p>
        </div>
        <div className={tarjeta}>
          <p className={rotulo}>Planes vigentes</p>
          <p className="mt-1 text-3xl font-extrabold">
            {lista ? k.planes : "…"} <span className="text-xs font-semibold text-indigo-400">en catálogo</span>
          </p>
        </div>
        <div className={tarjeta}>
          <p className={rotulo}>Comisión media</p>
          <p className="mt-1 text-3xl font-extrabold">
            {k.comision !== null ? `${k.comision.toFixed(1)}%` : "—"}{" "}
            <span className="text-xs font-semibold text-zinc-400">promedio activas</span>
          </p>
        </div>
        <div className={tarjeta}>
          <p className={rotulo}>Integradas</p>
          <p className="mt-1 text-3xl font-extrabold">
            {lista ? k.integradas : "…"} <span className="text-xs font-semibold text-sky-400">con integración</span>
          </p>
        </div>
      </div>

      {error && <p className="text-red-400">{error}</p>}
      {lista && visibles.length === 0 && (
        <p className="text-zinc-400">
          {lista.length === 0
            ? "Aún no hay aseguradoras. Importa el tarifario desde la sección Tarifario."
            : "No hay aseguradoras en este filtro."}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {visibles.map((a) => {
          const st = ESTATUS[a.estatus_integracion] ?? ESTATUS.por_integrar;
          const res = resumen[a.id];
          const areas = [...new Set(a.planes.map((p) => p.area || "salud"))];
          return (
            <div key={a.id} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
              <div className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-white p-1">
                  {a.logo_url ? (
                    <img src={a.logo_url} alt={a.nombre} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs font-bold text-zinc-500">{a.nombre.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-extrabold">{a.nombre}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>● {st.texto}</span>
                    {!a.activa && (
                      <span className="rounded-full bg-zinc-700 px-2.5 py-0.5 text-xs font-semibold text-zinc-200">Inactiva</span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400">
                    {[a.fundada_en, a.ciudad].filter(Boolean).join(" · ") || "Sin ciudad"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 border-t border-zinc-800 p-4 text-sm">
                {[
                  ["Planes", a.planes.length],
                  ["Coberturas", res ? res.coberturas : "…"],
                  ["Add-ons", res ? res.addons.length : "…"],
                  ["Rating", a.rating ?? "—"],
                ].map(([t, v]) => (
                  <div key={t as string}>
                    <p className="text-xs text-zinc-400">{t}</p>
                    <p className="text-lg font-bold">{v}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2 border-t border-zinc-800 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Áreas activas</p>
                <div className="flex flex-wrap gap-2">
                  {areas.map((ar) => (
                    <span
                      key={ar}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${AREA[ar]?.cls ?? "bg-zinc-200 text-zinc-700"}`}
                    >
                      {AREA[ar]?.texto ?? ar}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t border-zinc-800 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Planes ({a.planes.length})
                </p>
                {ORDEN_TIPOS.map((tipo) => {
                  const deTipo = a.planes.filter((p) => p.tipo === tipo).sort((x, y) => x.nombre.localeCompare(y.nombre));
                  if (deTipo.length === 0) return null;
                  return (
                    <div key={tipo} className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
                        {TIPO[tipo] ?? tipo} <span className="text-zinc-500">({deTipo.length})</span>
                      </p>
                      <ul className="space-y-1 text-sm">
                        {deTipo.map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-zinc-800/50 px-2 py-1">
                            {esAdmin ? (
                              <Link to={`/planes/${p.id}`} className="hover:text-indigo-300 hover:underline">
                                {p.nombre}
                              </Link>
                            ) : (
                              <span>{p.nombre}</span>
                            )}
                            {!p.activo && <span className="text-xs text-zinc-500">Inactivo</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
                {a.planes.length === 0 && <p className="text-sm text-zinc-500">Sin planes.</p>}
              </div>

              <div className="space-y-2 border-t border-zinc-800 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Add-ons disponibles ({res ? res.addons.length : "…"})
                </p>
                <div className="flex flex-wrap gap-2">
                  {(res?.addons ?? []).map((n) => (
                    <span key={n} className="rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-0.5 text-xs font-semibold">
                      {n}
                    </span>
                  ))}
                  {res && res.addons.length === 0 && <span className="text-sm text-zinc-500">Ninguno</span>}
                </div>
              </div>

              {esAdmin && (
                <div className="flex justify-end gap-2 border-t border-zinc-800 p-3">
                  <button
                    onClick={() => eliminar(a)}
                    aria-label={`Eliminar ${a.nombre}`}
                    title="Eliminar"
                    className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
                  >
                    🗑
                  </button>
                  <Link
                    to={`/aseguradoras/${a.id}`}
                    title="Ver y editar"
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
                  >
                    Ver / editar
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
