import { opcionesMonto, useMontosCatalogo } from "../lib/montosCatalogo";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { CUOTAS, CUOTAS_BASE } from "../lib/calculo";
import { Aviso, Boton, Campo, Casilla, Seccion, inputChico, inputCls, numero, type Mensaje } from "../components/ui";

const TIPOS: [string, string][] = [
  ["hcm", "HCM"],
  ["emca", "Emergencia médica"],
  ["amy", "Adulto mayor"],
];

type Addon = { id: string; nombre: string; orden: number };
type PlanDB = {
  id: string;
  aseguradora_id: string;
  nombre: string;
  tipo: string;
  modalidad: string;
  grupo_min: number | null;
  grupo_max: number | null;
  recomendado: boolean;
  mas_vendido: boolean;
  activo: boolean;
  cuotas?: string[] | null;
  aseguradoras: { id: string; nombre: string } | null;
};
type TarifaDB = {
  id: string;
  cobertura_monto: number;
  edad_min: number;
  edad_max: number;
  prima_base: number;
  deducible: number;
  tamano_grupo: number;
  tarifa_addons: { addon_id: string; valor_original: string }[];
};
type CfgAddon = { on: boolean; emin: string; emax: string; sa: string };

export default function PlanEditor() {
  const { id } = useParams();
  const { perfil } = useAuth();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<PlanDB | null>(null);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [beneficios, setBeneficios] = useState<{ id: string; nombre: string; orden?: number; activo: boolean }[]>([]);
  const [tarifas, setTarifas] = useState<TarifaDB[]>([]);
  const [cargado, setCargado] = useState(false);

  // formularios
  const [d, setD] = useState({ nombre: "", tipo: "hcm", modalidad: "por_persona", gmin: "", gmax: "" });
  const [cuotas, setCuotas] = useState<string[]>(CUOTAS_BASE);
  const [flags, setFlags] = useState({ recomendado: false, mas_vendido: false, activo: true });
  const [cfg, setCfg] = useState<Record<string, CfgAddon>>({});
  const [ben, setBen] = useState<Record<string, string>>({});
  const [ocultos, setOcultos] = useState<Record<string, boolean>>({});
  const [colsIds, setColsIds] = useState<string[]>([]);

  const [msgDatos, setMsgDatos] = useState<Mensaje | null>(null);
  const [msgAddons, setMsgAddons] = useState<Mensaje | null>(null);
  const [msgBen, setMsgBen] = useState<Mensaje | null>(null);
  const [msgGlobal, setMsgGlobal] = useState<Mensaje | null>(null);
  const [filtroMonto, setFiltroMonto] = useState("");
  const [nueva, setNueva] = useState(false);

  const cargar = useCallback(async () => {
    const [p, ad, pa, bn, pb, tf] = await Promise.all([
      supabase.from("planes").select("*, aseguradoras(id,nombre)").eq("id", id!).single(),
      supabase.from("addons").select("id,nombre,orden").eq("activo", true).order("orden"),
      supabase.from("plan_addons").select("addon_id,edad_min,edad_max,suma_asegurada").eq("plan_id", id!),
      supabase.from("beneficios").select("id,nombre,orden,activo").order("orden"),
      supabase.from("plan_beneficios").select("beneficio_id,estado,oculto").eq("plan_id", id!),
      supabase
        .from("tarifas")
        .select(
          "id,cobertura_monto,edad_min,edad_max,prima_base,deducible,tamano_grupo,tarifa_addons(addon_id,valor_original)",
        )
        .eq("plan_id", id!)
        .order("cobertura_monto")
        .order("tamano_grupo")
        .order("edad_min"),
    ]);
    if (p.error) {
      setMsgGlobal({ tipo: "error", texto: p.error.message });
      return;
    }
    const pl = p.data as unknown as PlanDB;
    const listaAddons = (ad.data as unknown as Addon[]) ?? [];
    const listaTarifas = (tf.data as unknown as TarifaDB[]) ?? [];
    const pAddons = (pa.data as unknown as {
      addon_id: string;
      edad_min: number | null;
      edad_max: number | null;
      suma_asegurada: number | null;
    }[]) ?? [];

    setPlan(pl);
    setAddons(listaAddons);
    setBeneficios((bn.data as unknown as { id: string; nombre: string; orden?: number; activo: boolean }[]) ?? []);
    setTarifas(listaTarifas);
    setD({
      nombre: pl.nombre,
      tipo: pl.tipo,
      modalidad: pl.modalidad,
      gmin: pl.grupo_min === null ? "" : String(pl.grupo_min),
      gmax: pl.grupo_max === null ? "" : String(pl.grupo_max),
    });
    setCuotas(pl.cuotas && pl.cuotas.length > 0 ? pl.cuotas : CUOTAS_BASE);
    setFlags({ recomendado: pl.recomendado, mas_vendido: pl.mas_vendido, activo: pl.activo });

    const nuevoCfg: Record<string, CfgAddon> = {};
    for (const a of listaAddons) {
      const fila = pAddons.find((x) => x.addon_id === a.id);
      nuevoCfg[a.id] = {
        on: Boolean(fila),
        emin: fila?.edad_min == null ? "" : String(fila.edad_min),
        emax: fila?.edad_max == null ? "" : String(fila.edad_max),
        sa: fila?.suma_asegurada == null ? "" : String(fila.suma_asegurada),
      };
    }
    setCfg(nuevoCfg);

    const estados: Record<string, string> = {};
    const ocul: Record<string, boolean> = {};
    for (const b of (pb.data as unknown as { beneficio_id: string; estado: string; oculto: boolean }[]) ?? []) {
      estados[b.beneficio_id] = b.estado;
      ocul[b.beneficio_id] = b.oculto;
    }
    setBen(estados);
    setOcultos(ocul);

    // Columnas de add-ons en la tabla de tarifas: solo los habilitados en el plan
    const usados = new Set<string>(pAddons.map((x) => x.addon_id));
    setColsIds(listaAddons.filter((a) => usados.has(a.id)).map((a) => a.id));
    setCargado(true);
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (perfil?.rol !== "admin") {
    return <p className="text-zinc-400">Solo los administradores pueden editar planes.</p>;
  }
  if (!cargado || !plan) return <div>{msgGlobal ? <Aviso mensaje={msgGlobal} /> : <p className="text-zinc-400">Cargando…</p>}</div>;

  const porGrupo = d.modalidad === "por_grupo";
  const cols = addons.filter((a) => colsIds.includes(a.id));
  const montos = [...new Set(tarifas.map((t) => Number(t.cobertura_monto)))].sort((a, b) => a - b);
  const visibles = filtroMonto ? tarifas.filter((t) => String(Number(t.cobertura_monto)) === filtroMonto) : tarifas;

  const guardarDatos = async () => {
    setMsgDatos(null);
    if (!d.nombre.trim()) {
      setMsgDatos({ tipo: "error", texto: "El nombre es obligatorio." });
      return;
    }
    const gmin = numero(d.gmin);
    const gmax = numero(d.gmax);
    if (porGrupo && (gmin === null || gmax === null || Number.isNaN(gmin) || Number.isNaN(gmax))) {
      setMsgDatos({ tipo: "error", texto: "Indica el tamaño mínimo y máximo del grupo." });
      return;
    }
    if (cuotas.length === 0) {
      setMsgDatos({ tipo: "error", texto: "Elige al menos una forma de pago (cuotas)." });
      return;
    }
    const r = await supabase
      .from("planes")
      .update({
        nombre: d.nombre.trim(),
        tipo: d.tipo,
        modalidad: d.modalidad,
        grupo_min: porGrupo ? gmin : null,
        grupo_max: porGrupo ? gmax : null,
        cuotas,
        ...flags,
      })
      .eq("id", id!);
    setMsgDatos(r.error ? { tipo: "error", texto: r.error.message } : { tipo: "ok", texto: "Guardado." });
  };

  const agregarAddon = async () => {
    setMsgAddons(null);
    const nombre = window.prompt("Nombre del nuevo add-on (ej. Odontología)")?.trim();
    if (!nombre) return;
    if (addons.some((a) => a.nombre.toLowerCase() === nombre.toLowerCase())) {
      setMsgAddons({ tipo: "error", texto: `"${nombre}" ya existe en la lista.` });
      return;
    }
    // Si existe archivado con ese nombre, se reactiva (conserva sus precios)
    const previo = await supabase.from("addons").select("id,nombre,orden,activo").ilike("nombre", nombre).maybeSingle();
    if (previo.error) {
      setMsgAddons({ tipo: "error", texto: previo.error.message });
      return;
    }
    let fila = previo.data as { id: string; nombre: string; orden: number; activo: boolean } | null;
    if (fila) {
      const r = await supabase.from("addons").update({ activo: true }).eq("id", fila.id);
      if (r.error) {
        setMsgAddons({ tipo: "error", texto: r.error.message });
        return;
      }
    } else {
      const orden = Math.max(0, ...addons.map((a) => a.orden)) + 1;
      const r = await supabase.from("addons").insert({ nombre, orden }).select("id,nombre,orden,activo").single();
      if (r.error) {
        setMsgAddons({ tipo: "error", texto: r.error.message });
        return;
      }
      fila = r.data as { id: string; nombre: string; orden: number; activo: boolean };
    }
    setAddons([...addons, { id: fila.id, nombre: fila.nombre, orden: fila.orden }].sort((a, b) => a.orden - b.orden));
    setCfg({ ...cfg, [fila.id]: { on: false, emin: "", emax: "", sa: "" } });
    setMsgAddons({ tipo: "ok", texto: `"${fila.nombre}" agregado. Actívalo en este plan y guarda; sus costos se cargan en la tabla de tarifas.` });
  };

  const guardarAddons = async () => {
    setMsgAddons(null);
    const activos: Record<string, unknown>[] = [];
    const quitar: string[] = [];
    for (const a of addons) {
      const c = cfg[a.id];
      if (!c || !c.on) {
        quitar.push(a.id);
        continue;
      }
      const emin = numero(c.emin);
      const emax = numero(c.emax);
      const sa = numero(c.sa);
      if ([emin, emax, sa].some((n) => n !== null && Number.isNaN(n))) {
        setMsgAddons({ tipo: "error", texto: `Valor numérico inválido en ${a.nombre}.` });
        return;
      }
      activos.push({ plan_id: id, addon_id: a.id, edad_min: emin, edad_max: emax, suma_asegurada: sa });
    }
    if (activos.length > 0) {
      const r = await supabase.from("plan_addons").upsert(activos, { onConflict: "plan_id,addon_id" });
      if (r.error) {
        setMsgAddons({ tipo: "error", texto: r.error.message });
        return;
      }
    }
    if (quitar.length > 0) {
      const r = await supabase.from("plan_addons").delete().eq("plan_id", id!).in("addon_id", quitar);
      if (r.error) {
        setMsgAddons({ tipo: "error", texto: r.error.message });
        return;
      }
    }
    await cargar();
    setMsgAddons({ tipo: "ok", texto: "Guardado." });
  };

  // Los beneficios son propios de cada plan: un beneficio "está" en el plan si tiene fila en plan_beneficios.
  const delPlan = beneficios.filter((b) => b.id in ben);
  const visiblesPlan = delPlan.filter((b) => !ocultos[b.id]);
  const ocultosPlan = delPlan.filter((b) => ocultos[b.id]);
  const disponibles = beneficios.filter((b) => !(b.id in ben));

  const guardarBeneficios = async () => {
    setMsgBen(null);
    const filas = delPlan.map((b) => ({
      plan_id: id,
      beneficio_id: b.id,
      estado: ben[b.id] ?? "incluido",
      oculto: Boolean(ocultos[b.id]),
    }));
    const r = await supabase.from("plan_beneficios").upsert(filas, { onConflict: "plan_id,beneficio_id" });
    setMsgBen(r.error ? { tipo: "error", texto: r.error.message } : { tipo: "ok", texto: "Guardado." });
  };

  const agregarBeneficio = async () => {
    setMsgBen(null);
    const sugeridos = disponibles.length > 0 ? `\n\nYa existen (no usados en este plan): ${disponibles.map((x) => x.nombre).join(", ")}` : "";
    const nombre = window.prompt(`Nombre del beneficio para ESTE plan (ej. Telemedicina)${sugeridos}`)?.trim();
    if (!nombre) return;
    const existente = beneficios.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase());
    if (existente && existente.id in ben) {
      setMsgBen({ tipo: "error", texto: `"${existente.nombre}" ya está en este plan.` });
      return;
    }
    let b = existente;
    if (!b) {
      const orden = Math.max(0, ...beneficios.map((x) => x.orden ?? 0)) + 1;
      const nuevo = await supabase.from("beneficios").insert({ nombre, orden }).select("id,nombre,orden,activo").single();
      if (nuevo.error) {
        setMsgBen({ tipo: "error", texto: nuevo.error.message });
        return;
      }
      b = nuevo.data as { id: string; nombre: string; orden: number; activo: boolean };
      setBeneficios([...beneficios, b]);
    }
    const r = await supabase
      .from("plan_beneficios")
      .upsert({ plan_id: id, beneficio_id: b.id, estado: "incluido", oculto: false }, { onConflict: "plan_id,beneficio_id" });
    if (r.error) {
      setMsgBen({ tipo: "error", texto: r.error.message });
      return;
    }
    setBen({ ...ben, [b.id]: "incluido" });
    setOcultos({ ...ocultos, [b.id]: false });
    setMsgBen({ tipo: "ok", texto: `"${b.nombre}" agregado solo a este plan (Incluido).` });
  };

  const ocultarBeneficio = async (b: { id: string; nombre: string }, oculto: boolean) => {
    setMsgBen(null);
    const r = await supabase.from("plan_beneficios").update({ oculto }).eq("plan_id", id!).eq("beneficio_id", b.id);
    if (r.error) {
      setMsgBen({ tipo: "error", texto: r.error.message });
      return;
    }
    setOcultos({ ...ocultos, [b.id]: oculto });
    setMsgBen({
      tipo: "ok",
      texto: oculto
        ? `"${b.nombre}" oculto solo en este plan: no sale en su PDF ni en su enlace. Los demás planes no cambian.`
        : `"${b.nombre}" se muestra de nuevo en este plan.`,
    });
  };

  const eliminarBeneficio = async (b: { id: string; nombre: string }) => {
    const ok = window.confirm(
      `Vas a quitar "${b.nombre}" de ESTE plan. Los demás planes no cambian. Si solo quieres dejar de mostrarlo, usa "Ocultar". ¿Quitar?`,
    );
    if (!ok) return;
    setMsgBen(null);
    const r = await supabase.from("plan_beneficios").delete().eq("plan_id", id!).eq("beneficio_id", b.id);
    if (r.error) {
      setMsgBen({ tipo: "error", texto: r.error.message });
      return;
    }
    const restoBen = { ...ben };
    const restoOc = { ...ocultos };
    delete restoBen[b.id];
    delete restoOc[b.id];
    setBen(restoBen);
    setOcultos(restoOc);
    setMsgBen({ tipo: "ok", texto: `"${b.nombre}" quitado de este plan. Puedes volver a agregarlo con "+ Agregar beneficio".` });
  };

  const eliminarPlan = async () => {
    const ok = window.confirm(
      `Vas a eliminar el plan "${plan.nombre}" con sus ${tarifas.length} tarifas. No se puede deshacer. ¿Continuar?`,
    );
    if (!ok) return;
    const r = await supabase.from("planes").delete().eq("id", id!);
    if (r.error) setMsgGlobal({ tipo: "error", texto: r.error.message });
    else navigate(`/aseguradoras/${plan.aseguradora_id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/aseguradoras/${plan.aseguradora_id}`} className="text-sm text-indigo-300 hover:underline">
          ← {plan.aseguradoras?.nombre ?? "Aseguradora"}
        </Link>
        <h1 className="mt-1 text-3xl font-bold">{plan.nombre}</h1>
        <Aviso mensaje={msgGlobal} />
      </div>

      <Seccion titulo="Datos del plan">
        <div className="grid gap-3 md:grid-cols-2">
          <Campo etiqueta="Nombre *">
            <input value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} className={inputCls} />
          </Campo>
          <Campo etiqueta="Tipo de plan">
            <select value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value })} className={inputCls}>
              {TIPOS.map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Modalidad de tarifa">
            <select
              value={d.modalidad}
              onChange={(e) => setD({ ...d, modalidad: e.target.value })}
              className={inputCls}
            >
              <option value="por_persona">Por persona (según edad)</option>
              <option value="por_grupo">Por grupo familiar (prima del grupo)</option>
            </select>
          </Campo>
          {porGrupo && (
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Personas mínimo">
                <input value={d.gmin} onChange={(e) => setD({ ...d, gmin: e.target.value })} className={inputCls} />
              </Campo>
              <Campo etiqueta="Personas máximo">
                <input value={d.gmax} onChange={(e) => setD({ ...d, gmax: e.target.value })} className={inputCls} />
              </Campo>
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm text-zinc-400">Cuotas disponibles en este plan</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {CUOTAS.map((c) => (
              <Casilla
                key={c.clave}
                etiqueta={c.nombre}
                checked={cuotas.includes(c.clave)}
                onChange={(on) => setCuotas(on ? [...cuotas, c.clave] : cuotas.filter((x) => x !== c.clave))}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Son las formas de pago que se muestran en la cotización y el PDF de este plan.
          </p>
        </div>
        <div className="flex flex-wrap gap-6">
          <Casilla
            etiqueta="Recomendado"
            checked={flags.recomendado}
            onChange={(v) => setFlags({ ...flags, recomendado: v })}
          />
          <Casilla
            etiqueta="Más vendido"
            checked={flags.mas_vendido}
            onChange={(v) => setFlags({ ...flags, mas_vendido: v })}
          />
          <Casilla etiqueta="Plan activo" checked={flags.activo} onChange={(v) => setFlags({ ...flags, activo: v })} />
        </div>
        <div className="flex items-center gap-3">
          <Boton onClick={guardarDatos}>Guardar datos</Boton>
          <Aviso mensaje={msgDatos} />
        </div>
      </Seccion>

      <Seccion
        titulo="Add-ons del plan"
        ayuda="Activa los add-ons que ofrece este plan. Los costos por tarifa se editan abajo."
      >
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Add-on</th>
                <th className="px-3 py-2">Ofrecido</th>
              </tr>
            </thead>
            <tbody>
              {addons.map((a) => {
                const c = cfg[a.id] ?? { on: false, emin: "", emax: "", sa: "" };
                const cambiar = (parcial: Partial<CfgAddon>) => setCfg({ ...cfg, [a.id]: { ...c, ...parcial } });
                return (
                  <tr key={a.id} className="border-t border-zinc-800">
                    <td className="px-3 py-2">
                      {a.nombre}
                      {c.on && (c.emin !== "" || c.emax !== "") && (
                        <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
                          solo {c.emin || 0}–{c.emax || "+"} años
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={c.on} onChange={(e) => cambiar({ on: e.target.checked })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Boton onClick={guardarAddons}>Guardar add-ons</Boton>
          <Boton variante="secundario" onClick={agregarAddon}>
            + Agregar add-on
          </Boton>
          <Aviso mensaje={msgAddons} />
        </div>
      </Seccion>

      <Seccion
        titulo="Beneficios"
        ayuda="Son propios de este plan: ocultar, quitar o agregar aquí no afecta a los demás planes. Aparecen en la tabla comparativa del PDF y del enlace."
      >
        <div className="grid gap-2 md:grid-cols-2">
          {visiblesPlan.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 px-3 py-2">
              <span className="text-sm">{b.nombre}</span>
              <div className="flex items-center gap-1.5">
              <select
                value={ben[b.id] ?? "incluido"}
                onChange={(e) => setBen({ ...ben, [b.id]: e.target.value })}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
              >
                <option value="incluido">Incluido</option>
                <option value="opcional">Opcional</option>
                <option value="no_ofrecido">No ofrecido</option>
              </select>
              <button
                type="button"
                onClick={() => ocultarBeneficio(b, true)}
                title="Ocultar solo en este plan (PDF y enlace)"
                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Ocultar
              </button>
              <button
                type="button"
                onClick={() => eliminarBeneficio(b)}
                title="Quitar de este plan"
                className="rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
              >
                Eliminar
              </button>
              </div>
            </div>
          ))}
        </div>
        {ocultosPlan.length > 0 && (
          <details className="rounded-lg border border-zinc-800 p-3 text-sm">
            <summary className="cursor-pointer text-zinc-400">
              Beneficios ocultos en este plan ({ocultosPlan.length})
            </summary>
            <div className="mt-2 space-y-2">
              {ocultosPlan
                .map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">{b.nombre}</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => ocultarBeneficio(b, false)}
                        className="rounded-md border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
                      >
                        Mostrar
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminarBeneficio(b)}
                        className="rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </details>
        )}
        <div className="flex items-center gap-3">
          <Boton onClick={guardarBeneficios}>Guardar beneficios</Boton>
          <Boton variante="secundario" onClick={agregarBeneficio}>
            + Agregar beneficio
          </Boton>
          <Aviso mensaje={msgBen} />
        </div>
      </Seccion>

      <Seccion
        titulo={`Tarifas (${tarifas.length})`}
        ayuda="Cada fila se guarda con su propio botón. En los add-ons: un número es el costo anual, “gratis” es incluido y vacío es no disponible."
      >
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filtroMonto}
            onChange={(e) => setFiltroMonto(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
          >
            <option value="">Todas las coberturas</option>
            {montos.map((m) => (
              <option key={m} value={String(m)}>
                ${m.toLocaleString("es-VE")}
              </option>
            ))}
          </select>
          <Boton variante="secundario" onClick={() => setNueva(true)} disabled={nueva}>
            + Agregar tarifa
          </Boton>
          <span className="text-sm text-zinc-500">
            {visibles.length} de {tarifas.length} filas
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-2 py-2">Cobertura</th>
                <th className="px-2 py-2">Edad desde</th>
                <th className="px-2 py-2">Edad hasta</th>
                {porGrupo && <th className="px-2 py-2">Personas</th>}
                <th className="px-2 py-2">{porGrupo ? "Prima grupo" : "Prima base"}</th>
                <th className="px-2 py-2">Deducible</th>
                {cols.map((a) => (
                  <th key={a.id} className="px-2 py-2">
                    {a.nombre}
                  </th>
                ))}
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {nueva && (
                <FilaTarifa
                  key="nueva"
                  t={null}
                  planId={id!}
                  cols={cols}
                  porGrupo={porGrupo}
                  onCambio={() => {
                    setNueva(false);
                    void cargar();
                  }}
                  onCancelar={() => setNueva(false)}
                />
              )}
              {visibles.map((t) => (
                <FilaTarifa
                  key={`${t.id}-${cols.map((c) => c.id).join(",")}`}
                  t={t}
                  planId={id!}
                  cols={cols}
                  porGrupo={porGrupo}
                  onCambio={() => void cargar()}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="Zona de peligro">
        <Boton variante="peligro" onClick={eliminarPlan}>
          Eliminar plan
        </Boton>
      </Seccion>
    </div>
  );
}

function FilaTarifa({
  t,
  planId,
  cols,
  porGrupo,
  onCambio,
  onCancelar,
}: {
  t: TarifaDB | null;
  planId: string;
  cols: Addon[];
  porGrupo: boolean;
  onCambio: () => void;
  onCancelar?: () => void;
}) {
  const [v, setV] = useState({
    monto: t ? String(Number(t.cobertura_monto)) : "",
    emin: t ? String(t.edad_min) : "",
    emax: t ? String(t.edad_max) : "",
    prima: t ? String(Number(t.prima_base)) : "",
    ded: t ? String(Number(t.deducible)) : "0",
    tam: t ? String(t.tamano_grupo) : porGrupo ? "3" : "0",
  });
  const [ad, setAd] = useState<Record<string, string>>(() =>
    Object.fromEntries(cols.map((c) => [c.id, t?.tarifa_addons.find((x) => x.addon_id === c.id)?.valor_original ?? ""])),
  );
  const [estado, setEstado] = useState<Mensaje | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const catalogo = useMontosCatalogo();

  const guardar = async () => {
    setEstado(null);
    const monto = numero(v.monto);
    const emin = numero(v.emin);
    const emax = numero(v.emax);
    const prima = numero(v.prima);
    const ded = numero(v.ded) ?? 0;
    const tam = porGrupo ? numero(v.tam) : 0;
    if (
      [monto, emin, emax, prima, ded, tam].some((n) => n === null || Number.isNaN(n)) ||
      (monto as number) <= 0 ||
      (prima as number) < 0 ||
      (emin as number) > (emax as number)
    ) {
      setEstado({ tipo: "error", texto: "Revisa los números (cobertura > 0, edades en orden, prima ≥ 0)." });
      return;
    }

    const upserts: Record<string, unknown>[] = [];
    const borrar: string[] = [];
    const fila = {
      plan_id: planId,
      cobertura_monto: monto,
      edad_min: emin,
      edad_max: emax,
      prima_base: prima,
      deducible: ded,
      tamano_grupo: tam,
    };

    setOcupado(true);
    let tarifaId = t?.id;
    if (tarifaId) {
      const r = await supabase.from("tarifas").update(fila).eq("id", tarifaId);
      if (r.error) {
        setOcupado(false);
        setEstado({ tipo: "error", texto: r.error.message });
        return;
      }
    } else {
      const r = await supabase.from("tarifas").insert(fila).select("id").single();
      if (r.error) {
        setOcupado(false);
        setEstado({ tipo: "error", texto: r.error.message });
        return;
      }
      tarifaId = (r.data as { id: string }).id;
    }

    for (const c of cols) {
      const texto = (ad[c.id] ?? "").trim();
      if (texto === "") {
        borrar.push(c.id);
        continue;
      }
      const incluido = texto.toLowerCase() === "gratis";
      const costo = incluido ? null : numero(texto);
      if (!incluido && (costo === null || Number.isNaN(costo))) {
        setOcupado(false);
        setEstado({ tipo: "error", texto: `Valor inválido en ${c.nombre}: usa un número, "gratis" o déjalo vacío.` });
        return;
      }
      upserts.push({ tarifa_id: tarifaId, addon_id: c.id, valor_original: texto, incluido, costo });
    }
    if (upserts.length > 0) {
      const r = await supabase.from("tarifa_addons").upsert(upserts, { onConflict: "tarifa_id,addon_id" });
      if (r.error) {
        setOcupado(false);
        setEstado({ tipo: "error", texto: r.error.message });
        return;
      }
    }
    if (borrar.length > 0) {
      const r = await supabase.from("tarifa_addons").delete().eq("tarifa_id", tarifaId!).in("addon_id", borrar);
      if (r.error) {
        setOcupado(false);
        setEstado({ tipo: "error", texto: r.error.message });
        return;
      }
    }
    setOcupado(false);
    setEstado({ tipo: "ok", texto: "✓" });
    if (!t) onCambio();
  };

  const eliminar = async () => {
    if (!t || !window.confirm("¿Eliminar esta tarifa?")) return;
    setOcupado(true);
    const r = await supabase.from("tarifas").delete().eq("id", t.id);
    setOcupado(false);
    if (r.error) setEstado({ tipo: "error", texto: r.error.message });
    else onCambio();
  };

  const campo = (k: keyof typeof v) => (
    <input value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className={inputChico} />
  );

  return (
    <tr className="border-t border-zinc-800 align-top">
      <td className="px-2 py-1">
        <select value={v.monto} onChange={(e) => setV({ ...v, monto: e.target.value })} className={inputChico}>
          <option value="">Cobertura…</option>
          {opcionesMonto(catalogo, numero(v.monto) || null).map((m) => (
            <option key={m} value={String(m)}>
              ${m.toLocaleString("en-US")}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1">{campo("emin")}</td>
      <td className="px-2 py-1">{campo("emax")}</td>
      {porGrupo && <td className="px-2 py-1">{campo("tam")}</td>}
      <td className="px-2 py-1">{campo("prima")}</td>
      <td className="px-2 py-1">{campo("ded")}</td>
      {cols.map((c) => (
        <td key={c.id} className="px-2 py-1">
          <input
            value={ad[c.id] ?? ""}
            onChange={(e) => setAd({ ...ad, [c.id]: e.target.value })}
            className={inputChico}
          />
        </td>
      ))}
      <td className="whitespace-nowrap px-2 py-1">
        <div className="flex items-center gap-2">
          <button
            onClick={guardar}
            disabled={ocupado}
            className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-900 disabled:opacity-50"
          >
            Guardar
          </button>
          {t ? (
            <button
              onClick={eliminar}
              disabled={ocupado}
              className="rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-300 disabled:opacity-50"
            >
              Eliminar
            </button>
          ) : (
            <button
              onClick={onCancelar}
              className="rounded-md border border-zinc-700 px-2 py-1 text-xs"
            >
              Cancelar
            </button>
          )}
          {estado && (
            <span className={`text-xs ${estado.tipo === "ok" ? "text-emerald-400" : "text-red-400"}`}>
              {estado.texto}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
