import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  calcularOpciones,
  type AddonCat,
  type Opcion,
  type PlanCalc,
  type TarifaCalc,
} from "../lib/calculo";
import { Aviso, Boton, Campo, inputCls, type Mensaje } from "../components/ui";

const AREAS = [
  { id: "salud", nombre: "Salud", desc: "HCM, Emergencias, Maternidad, Vida", activa: true },
  { id: "hogar", nombre: "Hogar", desc: "Edificación, contenido y robo", activa: false },
  { id: "pyme", nombre: "PYME", desc: "Póliza de Propiedades - Empresa", activa: false },
  { id: "vehiculos", nombre: "Vehículos", desc: "RCV, Cobertura Amplia (Casco)", activa: false },
  { id: "vitales", nombre: "Vitales", desc: "Vida, funerario, accidentes, renta por hospitalización y cáncer", activa: false },
];
const CANALES = ["Chatbot", "Email", "Redes Sociales", "Referido", "Web", "WhatsApp"];
const PASOS = ["Área", "Cliente", "Asegurados", "Precios", "Resumen"];
const MAX_COBERTURAS = 4;
const MAX_EMPRESAS = 4;
const ADDONS_POR_DEFECTO = ["Viajes", "Funerario", "AMD"];

type ClienteSel = { id?: string; nombre: string; apellido: string; telefono: string; email: string };
type ClienteDB = {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
};
type AseguradoUI = { nombre: string; edad: string; sexo: "M" | "F" };
type Grupo = "individual" | "pareja" | "familiar";

export const usd = (n: number) => `$${Number(n).toLocaleString("es-VE")}`;

const nombreCompleto = (c: { nombre: string; apellido?: string | null }) =>
  [c.nombre, c.apellido].filter(Boolean).join(" ");

export default function NuevaCotizacion() {
  const navigate = useNavigate();
  const [paso, setPaso] = useState(1);
  const [tipoCot, setTipoCot] = useState<"nueva_poliza" | "renovacion">("nueva_poliza");

  // cliente
  const [cliente, setCliente] = useState<ClienteSel | null>(null);
  const [nuevoCliente, setNuevoCliente] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<ClienteDB[]>([]);
  const [canal, setCanal] = useState<string | null>(null);

  // asegurados
  const [grupo, setGrupo] = useState<Grupo>("individual");
  const [asegurados, setAsegurados] = useState<AseguradoUI[]>([{ nombre: "", edad: "", sexo: "M" }]);

  // catálogos y datos de cálculo
  const [montos, setMontos] = useState<number[]>([]);
  const [addonsCat, setAddonsCat] = useState<AddonCat[]>([]);
  const [planes, setPlanes] = useState<PlanCalc[]>([]);
  const [tarifas, setTarifas] = useState<TarifaCalc[]>([]);
  const [cargandoTarifas, setCargandoTarifas] = useState(false);
  const [coberturas, setCoberturas] = useState<number[]>([100000]);
  const [addonsElegidos, setAddonsElegidos] = useState<string[]>([]);
  const carRef = useRef<HTMLDivElement>(null);
  const [flechas, setFlechas] = useState({ izq: false, der: false });
  const [tiposActivos, setTiposActivos] = useState<string[]>(["hcm", "emca", "amy"]);
  const [planesOcultos, setPlanesOcultos] = useState<string[]>([]);
  const [addonsEmpresa, setAddonsEmpresa] = useState<Record<string, string[]>>({});
  const [dedElegido, setDedElegido] = useState<Record<string, number>>({});
  const [seleccion, setSeleccion] = useState<string[]>([]);

  const [msg, setMsg] = useState<Mensaje | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Carga inicial: montos disponibles, add-ons y planes
  useEffect(() => {
    void (async () => {
      const [t, a, p] = await Promise.all([
        supabase.from("tarifas").select("cobertura_monto").eq("activa", true),
        supabase.from("addons").select("id,nombre,orden,solo_sexo")
          .eq("activo", true).order("orden"),
        supabase
          .from("planes")
          .select(
            "id,nombre,tipo,modalidad,grupo_min,grupo_max,activo,recomendado,mas_vendido,aseguradoras(id,nombre,activa,renovacion_habilitada,recargo_renovacion_pct,logo_url),plan_addons(addon_id,edad_min,edad_max)",
          ),
      ]);
      if (t.error || a.error || p.error) {
        setMsg({ tipo: "error", texto: (t.error ?? a.error ?? p.error)!.message });
        return;
      }
      const m = [...new Set((t.data as { cobertura_monto: number }[]).map((x) => Number(x.cobertura_monto)))].sort(
        (x, y) => x - y,
      );
      setMontos(m);
      setCoberturas((prev) => (m.includes(prev[0]) ? prev : m.length > 0 ? [m[0]] : []));
      const cat = (a.data as AddonCat[]) ?? [];
      setAddonsCat(cat);
      setAddonsElegidos(cat.filter((x) => ADDONS_POR_DEFECTO.includes(x.nombre)).map((x) => x.id));
      setPlanes(
        (p.data as unknown as (Omit<PlanCalc, "aseguradora"> & { aseguradoras: PlanCalc["aseguradora"] })[]).map(
          ({ aseguradoras, ...resto }) => ({
            ...resto,
            aseguradora: {
              ...aseguradoras,
              recargo_renovacion_pct: Number(aseguradoras.recargo_renovacion_pct ?? 0),
            },
          }),
        ),
      );
    })();
  }, []);

  // Búsqueda de clientes (recientes si no hay texto)
  useEffect(() => {
    if (paso !== 2) return;
    const q = busqueda.trim();
    const t = setTimeout(async () => {
      let consulta = supabase
        .from("clientes")
        .select("id,nombre,apellido,telefono,email")
        .order("created_at", { ascending: false })
        .limit(q ? 8 : 6);
      if (q) {
        const limpio = q.replace(/[%,()]/g, " ");
        consulta = consulta.or(
          `nombre.ilike.%${limpio}%,apellido.ilike.%${limpio}%,telefono.ilike.%${limpio}%,email.ilike.%${limpio}%,cedula.ilike.%${limpio}%`,
        );
      }
      const r = await consulta;
      if (!r.error) setResultados((r.data as ClienteDB[]) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [busqueda, paso]);

  // Tarifas de las coberturas elegidas
  useEffect(() => {
    if (paso < 4 || coberturas.length === 0) return;
    setCargandoTarifas(true);
    supabase
      .from("tarifas")
      .select(
        "id,plan_id,cobertura_monto,edad_min,edad_max,prima_base,deducible,tamano_grupo,tarifa_addons(addon_id,valor_original,incluido,costo)",
      )
      .eq("activa", true)
      .in("cobertura_monto", coberturas)
      .limit(5000)
      .then(({ data, error }) => {
        setCargandoTarifas(false);
        if (error) {
          setMsg({ tipo: "error", texto: error.message });
          return;
        }
        setTarifas(
          (data as unknown as TarifaCalc[]).map((t) => ({
            ...t,
            cobertura_monto: Number(t.cobertura_monto),
            prima_base: Number(t.prima_base),
            deducible: Number(t.deducible),
            tarifa_addons: t.tarifa_addons.map((x) => ({ ...x, costo: x.costo === null ? null : Number(x.costo) })),
          })),
        );
      });
  }, [paso, coberturas]);

  const aseguradosCalc = useMemo(
    () =>
      asegurados.map((a, i) => ({
        nombre: a.nombre.trim() || (i === 0 ? "Titular" : `Persona ${i + 1}`),
        edad: Number(a.edad),
        sexo: a.sexo,
      })),
    [asegurados],
  );

  const opciones: Opcion[] = useMemo(
    () =>
      paso >= 4
        ? calcularOpciones({
            planes,
            tarifas,
            addonsCatalogo: addonsCat,
            asegurados: aseguradosCalc,
            coberturas,
            addonsElegidos,
            addonsPorAseguradora: addonsEmpresa,
            renovacion: tipoCot === "renovacion",
            deducibleElegido: dedElegido,
          })
        : [],
    [paso, planes, tarifas, addonsCat, aseguradosCalc, coberturas, addonsElegidos, addonsEmpresa, tipoCot, dedElegido],
  );

  const moverCarrusel = (dir: 1 | -1) => {
    const el = carRef.current;
    const tarjeta = el?.firstElementChild as HTMLElement | undefined;
    if (el && tarjeta) el.scrollBy({ left: dir * (tarjeta.offsetWidth + 16) });
  };
  const opcionesTipo = opciones.filter((o) => tiposActivos.includes(o.tipo));
  const visibles = opcionesTipo.filter((o) => !planesOcultos.includes(o.plan_id));
  const tiposDisponibles = [...new Set(opciones.map((o) => o.tipo))];
  const elegidas = visibles.filter((o) => seleccion.includes(o.clave));
  // Add-ons con precio para cada aseguradora (según las tarifas cargadas de las sumas elegidas)
  const addonsDisponibles = useMemo(() => {
    const empDePlan = new Map(planes.map((p) => [p.id, p.aseguradora.id]));
    const m = new Map<string, Set<string>>();
    for (const t of tarifas) {
      const emp = empDePlan.get(t.plan_id);
      if (!emp) continue;
      for (const x of t.tarifa_addons) {
        if (x.incluido || (x.costo ?? 0) > 0) m.set(emp, (m.get(emp) ?? new Set<string>()).add(x.addon_id));
      }
    }
    return m;
  }, [planes, tarifas]);
  const addonsDe = (empId: string) => addonsEmpresa[empId] ?? addonsElegidos;
  const alternarAddonEmpresa = (empId: string, addonId: string) => {
    const actual = addonsDe(empId);
    setAddonsEmpresa({
      ...addonsEmpresa,
      [empId]: actual.includes(addonId) ? actual.filter((x) => x !== addonId) : [...actual, addonId],
    });
  };

  const logoDe = useMemo(() => new Map(planes.map((p) => [p.aseguradora.id, p.aseguradora.logo_url ?? null])), [planes]);
  const porAseguradora = useMemo(() => {
    const m = new Map<
      string,
      { nombre: string; empId: string; lista: Opcion[]; planes: { id: string; nombre: string; tipo: string }[] }
    >();
    for (const o of opcionesTipo) {
      const g = m.get(o.aseguradora) ?? { nombre: o.aseguradora, empId: o.aseguradora_id, lista: [], planes: [] };
      if (!g.planes.some((p) => p.id === o.plan_id)) g.planes.push({ id: o.plan_id, nombre: o.plan, tipo: o.tipo });
      if (!planesOcultos.includes(o.plan_id)) g.lista.push(o);
      m.set(o.aseguradora, g);
    }
    return [...m.values()];
  }, [opcionesTipo, planesOcultos]);

  // Flechas del carrusel: solo si hay tarjetas fuera de la vista
  useEffect(() => {
    const el = carRef.current;
    if (!el) return;
    const actualizar = () =>
      setFlechas({ izq: el.scrollLeft > 4, der: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    actualizar();
    el.addEventListener("scroll", actualizar);
    window.addEventListener("resize", actualizar);
    return () => {
      el.removeEventListener("scroll", actualizar);
      window.removeEventListener("resize", actualizar);
    };
  }, [porAseguradora, paso]);

  // ---- validaciones por paso
  const edadesValidas = asegurados.every((a) => /^\d{1,3}$/.test(a.edad.trim()) && Number(a.edad) <= 120);
  const cantidadValida =
    (grupo === "individual" && asegurados.length === 1) ||
    (grupo === "pareja" && asegurados.length === 2) ||
    (grupo === "familiar" && asegurados.length >= 3 && asegurados.length <= 6);

  const avanzar = () => {
    setMsg(null);
    if (paso === 2) {
      if (!cliente || !cliente.nombre.trim()) {
        setMsg({ tipo: "error", texto: "Elige un cliente existente o completa el nombre del nuevo." });
        return;
      }
      if (asegurados[0].nombre.trim() === "") {
        setAsegurados(asegurados.map((a, i) => (i === 0 ? { ...a, nombre: cliente.nombre.trim() } : a)));
      }
    }
    if (paso === 3 && (!edadesValidas || !cantidadValida)) {
      setMsg({
        tipo: "error",
        texto: !edadesValidas
          ? "Ingresa la edad (0 a 120) de cada asegurado."
          : "Un plan familiar necesita entre 3 y 6 personas.",
      });
      return;
    }
    if (paso === 4 && elegidas.length === 0) {
      setMsg({ tipo: "error", texto: "Selecciona al menos una opción para comparar." });
      return;
    }
    setPaso(paso + 1);
  };

  const cambiarGrupo = (g: Grupo) => {
    setGrupo(g);
    const objetivo = g === "individual" ? 1 : g === "pareja" ? 2 : Math.max(3, asegurados.length);
    const lista = [...asegurados];
    while (lista.length < objetivo) lista.push({ nombre: "", edad: "", sexo: "M" });
    setAsegurados(lista.slice(0, objetivo));
    setSeleccion([]);
  };

  const cambiarAsegurado = (i: number, parcial: Partial<AseguradoUI>) => {
    setAsegurados(asegurados.map((a, j) => (j === i ? { ...a, ...parcial } : a)));
    setSeleccion([]);
  };

  const alternarCobertura = (m: number) => {
    setCoberturas((prev) => {
      if (prev.includes(m)) return prev.length === 1 ? prev : prev.filter((x) => x !== m);
      return prev.length >= MAX_COBERTURAS ? prev : [...prev, m].sort((a, b) => a - b);
    });
  };

  const empresasElegidas = new Set(elegidas.map((o) => o.aseguradora));
  const puedeAgregar = (o: Opcion) => empresasElegidas.has(o.aseguradora) || empresasElegidas.size < MAX_EMPRESAS;

  const alternarSeleccion = (o: Opcion) => {
    setSeleccion((prev) =>
      prev.includes(o.clave) ? prev.filter((c) => c !== o.clave) : puedeAgregar(o) ? [...prev, o.clave] : prev,
    );
  };

  const alternarEmpresa = (lista: Opcion[]) => {
    const claves = lista.map((o) => o.clave);
    setSeleccion((prev) => {
      if (claves.every((c) => prev.includes(c))) return prev.filter((c) => !claves.includes(c));
      if (!puedeAgregar(lista[0])) return prev;
      return [...new Set([...prev, ...claves])];
    });
  };

  const guardar = async () => {
    if (!cliente) return;
    setGuardando(true);
    setMsg(null);
    let cotizacionId: string | null = null;
    try {
      let clienteId = cliente.id;
      if (!clienteId) {
        const r = await supabase
          .from("clientes")
          .insert({
            nombre: cliente.nombre.trim(),
            apellido: cliente.apellido.trim() || null,
            telefono: cliente.telefono.trim() || null,
            email: cliente.email.trim() || null,
          })
          .select("id")
          .single();
        if (r.error) throw new Error(r.error.message);
        clienteId = (r.data as { id: string }).id;
      }

      const c = await supabase
        .from("cotizaciones")
        .insert({ cliente_id: clienteId, area: "salud", tipo: tipoCot, grupo, canal, estado: "borrador" })
        .select("id")
        .single();
      if (c.error) throw new Error(c.error.message);
      cotizacionId = (c.data as { id: string }).id;

      const a = await supabase.from("cotizacion_asegurados").insert(
        aseguradosCalc.map((x, i) => ({
          cotizacion_id: cotizacionId,
          nombre: x.nombre,
          edad: x.edad,
          sexo: x.sexo,
          es_titular: i === 0,
          orden: i,
        })),
      );
      if (a.error) throw new Error(a.error.message);

      const p = await supabase.from("cotizacion_planes").insert(
        elegidas.map((o) => ({
          cotizacion_id: cotizacionId,
          plan_id: o.plan_id,
          aseguradora_nombre: o.aseguradora,
          plan_nombre: o.plan,
          cobertura_monto: o.cobertura,
          deducible: o.deducible,
          addons: o.addons.map((x) => x.nombre),
          prima_anual: o.anual,
          prima_semestral: o.semestral,
          prima_trimestral: o.trimestral,
          prima_mensual: o.mensual,
          desglose: { base: o.base, addons: o.addons, recargo: o.recargo, porPersona: o.porPersona, tipo: o.tipo },
        })),
      );
      if (p.error) throw new Error(p.error.message);

      navigate(`/cotizaciones/${cotizacionId}`);
    } catch (e) {
      if (cotizacionId) await supabase.from("cotizaciones").delete().eq("id", cotizacionId);
      setMsg({ tipo: "error", texto: e instanceof Error ? e.message : String(e) });
      setGuardando(false);
    }
  };

  const tarjeta = "mx-auto w-full max-w-3xl space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6";

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">Nueva Cotización</h1>
        <p className="text-sm text-zinc-400">Completa los datos para generar la cotización.</p>
        <ol className="mt-4 flex items-center justify-between gap-2">
          {PASOS.map((nombre, i) => {
            const n = i + 1;
            const hecho = n < paso;
            return (
              <li key={nombre} className="flex flex-1 flex-col items-center gap-1 text-xs">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                    n === paso
                      ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                      : hecho
                        ? "border-indigo-400 bg-indigo-500/30 text-indigo-200"
                        : "border-zinc-700 text-zinc-500"
                  }`}
                >
                  {hecho ? "✓" : n}
                </span>
                <span className={n === paso ? "text-zinc-100" : "text-zinc-500"}>{nombre}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {paso === 1 && (
        <div className={tarjeta}>
          <h2 className="text-xl font-bold">¿Qué tipo de seguro?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {AREAS.map((a) => (
              <div
                key={a.id}
                className={`rounded-xl border p-4 ${
                  a.activa ? "border-red-400/60 bg-red-500/10" : "border-zinc-800 opacity-50"
                }`}
              >
                <p className="font-semibold">{a.nombre}</p>
                <p className="text-xs text-zinc-400">{a.desc}</p>
                {!a.activa && <p className="mt-2 text-xs text-zinc-500">Próximamente</p>}
              </div>
            ))}
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Tipo de cotización</p>
            <div className="flex gap-2">
              {(
                [
                  ["nueva_poliza", "Nueva póliza"],
                  ["renovacion", "Renovación"],
                ] as const
              ).map(([v, n]) => (
                <button
                  key={v}
                  onClick={() => {
                    setTipoCot(v);
                    setSeleccion([]);
                  }}
                  className={`rounded-lg border px-4 py-2 text-sm ${
                    tipoCot === v ? "border-indigo-400 bg-indigo-500/20" : "border-zinc-700 hover:bg-zinc-800"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {tipoCot === "renovacion" && (
              <p className="mt-2 text-xs text-amber-300">
                En renovación solo aparecen aseguradoras con la renovación habilitada (se configura en cada
                aseguradora), con su recargo aplicado.
              </p>
            )}
          </div>
          <Boton className="w-full py-3" onClick={avanzar}>
            Continuar → Cliente
          </Boton>
        </div>
      )}

      {paso === 2 && (
        <div className={tarjeta}>
          <div>
            <h2 className="text-xl font-bold">¿Para quién cotizamos?</h2>
            <p className="text-sm text-zinc-400">Busca un cliente existente o escribe el nombre para uno nuevo.</p>
          </div>

          {!nuevoCliente ? (
            <>
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, cédula, teléfono o email…"
                className={inputCls}
              />
              <p className="text-xs uppercase tracking-wide text-zinc-500">{busqueda.trim() ? "Resultados" : "Recientes"}</p>
              <ul className="space-y-2">
                {resultados.map((c) => {
                  const activo = cliente?.id === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() =>
                          setCliente({
                            id: c.id,
                            nombre: c.nombre,
                            apellido: c.apellido ?? "",
                            telefono: c.telefono ?? "",
                            email: c.email ?? "",
                          })
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                          activo ? "border-indigo-400 bg-indigo-500/20" : "border-zinc-800 hover:bg-zinc-800"
                        }`}
                      >
                        <span className="font-medium">{nombreCompleto(c)}</span>
                        <span className="block text-xs text-zinc-500">{c.telefono ?? c.email ?? "Sin contacto"}</span>
                      </button>
                    </li>
                  );
                })}
                {resultados.length === 0 && <li className="text-sm text-zinc-500">Sin resultados.</li>}
              </ul>
              <button
                onClick={() => {
                  setNuevoCliente(true);
                  setCliente({ nombre: busqueda.trim(), apellido: "", telefono: "", email: "" });
                }}
                className="w-full rounded-lg border border-dashed border-indigo-400/60 py-2 text-sm text-indigo-300 hover:bg-indigo-500/10"
              >
                + Nuevo cliente
              </button>
            </>
          ) : (
            <div className="space-y-3 rounded-lg border border-zinc-800 p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">Nuevo cliente</p>
                <button
                  onClick={() => {
                    setNuevoCliente(false);
                    setCliente(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-100"
                >
                  ✕ Cancelar
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Nombre *">
                  <input
                    value={cliente?.nombre ?? ""}
                    onChange={(e) => setCliente({ ...cliente!, nombre: e.target.value })}
                    className={inputCls}
                  />
                </Campo>
                <Campo etiqueta="Apellido">
                  <input
                    value={cliente?.apellido ?? ""}
                    onChange={(e) => setCliente({ ...cliente!, apellido: e.target.value })}
                    className={inputCls}
                  />
                </Campo>
                <Campo etiqueta="Teléfono">
                  <input
                    value={cliente?.telefono ?? ""}
                    onChange={(e) => setCliente({ ...cliente!, telefono: e.target.value })}
                    placeholder="+58 414 123 4567"
                    className={inputCls}
                  />
                </Campo>
                <Campo etiqueta="Email">
                  <input
                    value={cliente?.email ?? ""}
                    onChange={(e) => setCliente({ ...cliente!, email: e.target.value })}
                    className={inputCls}
                  />
                </Campo>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm text-zinc-400">
              Canal de origen <span className="text-xs text-zinc-500">— opcional</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {CANALES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCanal(canal === c ? null : c)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    canal === c ? "border-indigo-400 bg-indigo-500/20" : "border-zinc-700 hover:bg-zinc-800"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <Aviso mensaje={msg} />
          <div className="flex gap-3">
            <Boton variante="secundario" onClick={() => setPaso(1)}>
              ← Volver
            </Boton>
            <Boton className="flex-1 py-3" onClick={avanzar}>
              Continuar → Asegurados
            </Boton>
          </div>
        </div>
      )}

      {paso === 3 && (
        <div className={tarjeta}>
          <div>
            <h2 className="text-xl font-bold">¿Quiénes se aseguran?</h2>
            <p className="text-sm text-zinc-400">Ingresa edad y sexo para calcular las primas.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["individual", "Individual"],
                ["pareja", "Pareja"],
                ["familiar", "Familiar"],
              ] as const
            ).map(([v, n]) => (
              <button
                key={v}
                onClick={() => cambiarGrupo(v)}
                className={`rounded-lg border py-3 text-sm font-medium ${
                  grupo === v ? "border-indigo-400 bg-indigo-500/20" : "border-zinc-700 hover:bg-zinc-800"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {asegurados.map((a, i) => (
              <div
                key={i}
                className={`grid items-end gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_90px_110px_auto] ${
                  i === 0 ? "border-indigo-400/50" : "border-zinc-800"
                }`}
              >
                <Campo etiqueta={i === 0 ? "Titular" : `Persona ${i + 1}`}>
                  <input
                    value={a.nombre}
                    onChange={(e) => cambiarAsegurado(i, { nombre: e.target.value })}
                    placeholder={i === 0 ? (cliente?.nombre ?? "Nombre") : "Cónyuge, hijo, padre…"}
                    className={inputCls}
                  />
                </Campo>
                <Campo etiqueta="Edad *">
                  <input
                    value={a.edad}
                    inputMode="numeric"
                    onChange={(e) => cambiarAsegurado(i, { edad: e.target.value })}
                    placeholder="30"
                    className={inputCls}
                  />
                </Campo>
                <div>
                  <p className="mb-1 text-sm text-zinc-400">Sexo</p>
                  <div className="flex gap-1">
                    {(["M", "F"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => cambiarAsegurado(i, { sexo: s })}
                        className={`flex-1 rounded-lg border py-2 text-sm ${
                          a.sexo === s ? "border-indigo-400 bg-indigo-500/30" : "border-zinc-700"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                {grupo === "familiar" && asegurados.length > 3 && i > 0 ? (
                  <button
                    onClick={() => {
                      setAsegurados(asegurados.filter((_, j) => j !== i));
                      setSeleccion([]);
                    }}
                    className="pb-2 text-sm text-red-300 hover:text-red-200"
                    title="Quitar persona"
                  >
                    ✕
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>

          {grupo === "familiar" && (
            <div className="flex items-center justify-between text-sm">
              <button
                onClick={() => setAsegurados([...asegurados, { nombre: "", edad: "", sexo: "M" }])}
                disabled={asegurados.length >= 6}
                className="text-indigo-300 hover:underline disabled:opacity-40"
              >
                + Agregar persona
              </button>
              <span className="text-zinc-500">{asegurados.length} de 6 personas</span>
            </div>
          )}

          <Aviso mensaje={msg} />
          <div className="flex gap-3">
            <Boton variante="secundario" onClick={() => setPaso(2)}>
              ← Volver
            </Boton>
            <Boton className="flex-1 py-3" onClick={avanzar}>
              Ver precios →
            </Boton>
          </div>
        </div>
      )}

      {paso === 4 && (
        <div className="mx-auto w-full max-w-7xl space-y-5">
          <div className="grid gap-4 md:grid-cols-[1fr_300px]">
            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Suma asegurada (máx. {MAX_COBERTURAS})
              </p>
              <div className="flex flex-wrap gap-2">
                {montos.map((m) => (
                  <button
                    key={m}
                    onClick={() => alternarCobertura(m)}
                    className={`rounded-lg border px-3 py-1 text-sm ${
                      coberturas.includes(m) ? "border-indigo-400 bg-indigo-500/20" : "border-zinc-700 hover:bg-zinc-800"
                    }`}
                  >
                    {usd(m)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                {grupo} · {tipoCot === "renovacion" ? "renovación" : "nueva póliza"}
              </p>
              {aseguradosCalc.map((a, i) => (
                <p key={i}>
                  {a.nombre} <span className="text-zinc-500">· {a.edad} a. · {a.sexo}</span>
                </p>
              ))}
            </div>
          </div>

          {tiposDisponibles.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-zinc-500">Tipo de plan</span>
              {tiposDisponibles.map((t) => {
                const on = tiposActivos.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => setTiposActivos(on ? tiposActivos.filter((x) => x !== t) : [...tiposActivos, t])}
                    className={`rounded-lg border px-3 py-1 text-sm ${
                      on ? "border-indigo-400 bg-indigo-500/20" : "border-zinc-700 text-zinc-500 hover:bg-zinc-800"
                    }`}
                  >
                    {t === "hcm" ? "HCM" : t === "emca" ? "Emergencia médica" : t === "amy" ? "Adulto mayor" : t}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-sm text-zinc-400">
            {cargandoTarifas
              ? "Calculando…"
              : `${porAseguradora.length} empresa(s) con cobertura disponible — elige hasta ${MAX_EMPRESAS} para comparar (con todas las sumas aseguradas que quieras)`}
          </p>
          <Aviso mensaje={msg} />

          <div className="relative">
            <button
              onClick={() => moverCarrusel(-1)}
              disabled={!flechas.izq}
              aria-label="Anterior"
              className="absolute -left-4 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800 text-lg shadow-lg hover:bg-zinc-700 disabled:hidden md:flex"
            >
              ‹
            </button>
            <button
              onClick={() => moverCarrusel(1)}
              disabled={!flechas.der}
              aria-label="Siguiente"
              className="absolute -right-4 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800 text-lg shadow-lg hover:bg-zinc-700 disabled:hidden md:flex"
            >
              ›
            </button>
          <div ref={carRef} className="flex snap-x snap-mandatory items-start gap-4 overflow-x-auto scroll-smooth pb-3">
            {porAseguradora.map(({ nombre, empId, lista, planes: chipsPlanes }) => (
              <div key={nombre} className="w-full shrink-0 snap-start space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4 md:w-[calc(50%-0.5rem)] xl:w-[calc(33.333%-0.667rem)]">
                <div className="flex items-center justify-between gap-2">
                  {logoDe.get(empId) ? (
                    <div className="flex h-10 w-32 items-center justify-center rounded-md bg-white px-2 py-1">
                      <img
                        src={logoDe.get(empId)!}
                        alt={nombre}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <p className="font-semibold">{nombre}</p>
                  )}
                  <button
                    onClick={() => alternarEmpresa(lista)}
                    disabled={lista.length === 0 || (!lista.every((o) => seleccion.includes(o.clave)) && !puedeAgregar(lista[0]))}
                    className="rounded-md border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800 disabled:opacity-40"
                  >
                    {lista.every((o) => seleccion.includes(o.clave)) ? "Quitar empresa" : "Incluir todas"}
                  </button>
                </div>
                <p className="-mt-1 text-xs text-zinc-500">
                  {chipsPlanes.length} {chipsPlanes.length === 1 ? "plan" : "planes"}
                  {chipsPlanes.some((pl) => planesOcultos.includes(pl.id)) && (
                    <span className="ml-2 text-amber-400">
                      · {chipsPlanes.filter((pl) => !planesOcultos.includes(pl.id)).length} activos
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {chipsPlanes.map((pl) => {
                    const on = !planesOcultos.includes(pl.id);
                    const color =
                      pl.tipo === "emca"
                        ? "border-red-400 bg-red-500/15 text-red-200"
                        : pl.tipo === "amy"
                          ? "border-amber-400 bg-amber-500/15 text-amber-200"
                          : "border-indigo-400 bg-indigo-500/20 text-indigo-200";
                    return (
                      <button
                        key={pl.id}
                        onClick={() =>
                          setPlanesOcultos(on ? [...planesOcultos, pl.id] : planesOcultos.filter((x) => x !== pl.id))
                        }
                        aria-pressed={on}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                          on ? color : "border-zinc-700 text-zinc-500 hover:bg-zinc-800"
                        }`}
                      >
                        {on ? "✓ " : ""}
                        {pl.nombre}
                      </button>
                    );
                  })}
                </div>
                {(() => {
                  const disp = addonsCat.filter((a) => addonsDisponibles.get(empId)?.has(a.id));
                  if (disp.length === 0) return null;
                  return (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-zinc-500">Add-ons:</span>
                      {disp.map((a) => {
                        const on = addonsDe(empId).includes(a.id);
                        return (
                          <button
                            key={a.id}
                            onClick={() => alternarAddonEmpresa(empId, a.id)}
                            className={`rounded-md border px-2 py-0.5 text-xs ${
                              on ? "border-indigo-400 bg-indigo-500/20" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                            }`}
                          >
                            {a.nombre}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
                {lista.length === 0 && <p className="text-sm text-zinc-500">Activa al menos un plan para ver sus precios.</p>}
                {lista.map((o) => {
                  const marcada = seleccion.includes(o.clave);
                  return (
                    <div
                      key={o.clave}
                      className={`space-y-2 rounded-lg border p-3 ${
                        marcada ? "border-indigo-400 bg-indigo-500/10" : "border-zinc-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{o.plan}</p>
                          <p className="text-xs text-zinc-400">{usd(o.cobertura)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">
                            {usd(o.mensual)}
                            <span className="text-xs font-normal text-zinc-400">/mes</span>
                          </p>
                          <p className="text-xs text-zinc-400">
                            Anual {usd(o.anual)} · Sem. {usd(o.semestral)} · Trim. {usd(o.trimestral)}
                          </p>
                        </div>
                      </div>

                      {o.deducibles.length > 1 && (
                        <label className="flex items-center gap-2 text-xs text-zinc-400">
                          Deducible
                          <select
                            value={o.deducible}
                            onChange={(e) => setDedElegido({ ...dedElegido, [o.clave]: Number(e.target.value) })}
                            className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-100"
                          >
                            {o.deducibles.map((d) => (
                              <option key={d} value={d}>
                                {d === 0 ? "Sin deducible" : usd(d)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      <ul className="space-y-0.5 text-xs">
                        {o.porPersona.length > 1 &&
                          o.porPersona
                            .filter((x) => x.base !== null)
                            .map((x, i) => (
                              <li key={i} className="flex justify-between">
                                <span className="text-zinc-500">
                                  {x.nombre} <span className="text-zinc-600">({x.edad})</span>
                                </span>
                                <span>{usd(x.base as number)}/año</span>
                              </li>
                            ))}
                        <li className="flex justify-between">
                          <span className="text-zinc-400">Total HCM</span>
                          <span>{usd(o.base)}/año</span>
                        </li>
                        {o.addons.map((a) => (
                          <li key={a.addon_id} className="flex justify-between">
                            <span className="text-zinc-400">
                              {a.nombre}
                              {a.personas > 1 && ` (${a.personas} pers.)`}
                            </span>
                            <span className={a.incluido ? "text-emerald-400" : ""}>
                              {a.incluido ? "Incluido" : `${usd(a.total)}/año`}
                            </span>
                          </li>
                        ))}
                        {o.recargo > 0 && (
                          <li className="flex justify-between">
                            <span className="text-zinc-400">Recargo renovación</span>
                            <span>{usd(Math.ceil(o.recargo))}/año</span>
                          </li>
                        )}
                      </ul>

                      <button
                        onClick={() => alternarSeleccion(o)}
                        disabled={!marcada && !puedeAgregar(o)}
                        className={`w-full rounded-md border py-1 text-sm disabled:opacity-40 ${
                          marcada ? "border-indigo-400 bg-indigo-500/30" : "border-zinc-700 hover:bg-zinc-800"
                        }`}
                      >
                        {marcada ? "✓ Incluida" : "+ Incluir"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          </div>
          {!cargandoTarifas && porAseguradora.length === 0 && (
            <p className="rounded-xl border border-zinc-800 p-6 text-center text-zinc-400">
              Ninguna aseguradora cubre estas edades y esta suma asegurada. Prueba con otro monto.
            </p>
          )}

          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/95 p-3 backdrop-blur">
            <Boton variante="secundario" onClick={() => setPaso(3)}>
              ← Volver
            </Boton>
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-400">{empresasElegidas.size} de {MAX_EMPRESAS} empresas · {elegidas.length} opciones</span>
              <Boton onClick={avanzar} disabled={elegidas.length === 0}>
                Generar cotización →
              </Boton>
            </div>
          </div>
        </div>
      )}

      {paso === 5 && cliente && (
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                {nombreCompleto(cliente)}{" "}
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs capitalize">{grupo}</span>
              </p>
              <p className="text-sm text-zinc-400">{cliente.telefono || cliente.email}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {aseguradosCalc.map((a, i) => (
                <span key={i} className="rounded-full border border-zinc-700 px-3 py-1">
                  {a.nombre} · {a.edad} años · {a.sexo}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {elegidas.map((o) => (
              <div key={o.clave} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{o.aseguradora}</p>
                    <p className="text-sm text-zinc-400">
                      {o.plan} · {usd(o.cobertura)}
                      {o.deducible > 0 && ` · deducible ${usd(o.deducible)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      {usd(o.mensual)}
                      <span className="text-xs font-normal text-zinc-400">/mes</span>
                    </p>
                    <p className="text-xs text-zinc-400">
                      Anual {usd(o.anual)} · Sem. {usd(o.semestral)} · Trim. {usd(o.trimestral)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Aviso mensaje={msg} />
          <div className="flex gap-3">
            <Boton variante="secundario" onClick={() => setPaso(4)} disabled={guardando}>
              ← Volver
            </Boton>
            <Boton className="flex-1 py-3" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar cotización"}
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}
