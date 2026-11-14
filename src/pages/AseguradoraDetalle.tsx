import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Aviso, Boton, Campo, Casilla, Seccion, inputCls, numero, type Mensaje } from "../components/ui";

const CUOTAS: [string, string][] = [
  ["anual", "Anual"],
  ["semestral", "Semestral"],
  ["cuatrimestral", "Cuatrimestral"],
  ["trimestral", "Trimestral"],
  ["mensual", "Mensual"],
  ["10_cuotas", "10 cuotas"],
  ["8_cuotas", "8 cuotas"],
  ["5_cuotas", "5 cuotas"],
  ["inicial_40_4", "Inicial 40% + 4 cuotas"],
];

const ESTATUS: [string, string][] = [
  ["por_integrar", "Por integrar"],
  ["en_revision", "En revisión"],
  ["integrado", "Integrado"],
  ["premier_partner", "Premier partner"],
];

const TIPOS: [string, string][] = [
  ["hcm", "HCM"],
  ["emca", "Emergencia médica"],
  ["amy", "Adulto mayor"],
];

const TEXTO = [
  "nombre",
  "nombre_corto",
  "ciudad",
  "pais",
  "portal_url",
  "email_contacto",
  "direccion",
  "ejecutivo_cuenta",
] as const;
const NUMEROS = ["fundada_en", "orden", "comision_pct", "rating", "recargo_renovacion_pct"] as const;

type Plan = {
  id: string;
  nombre: string;
  tipo: string;
  modalidad: string;
  activo: boolean;
  recomendado: boolean;
  mas_vendido: boolean;
  tarifas: { count: number }[];
};

export default function AseguradoraDetalle() {
  const { id } = useParams();
  const { perfil } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState<Record<string, string> | null>(null);
  const [cuotas, setCuotas] = useState<string[]>([]);
  const [activa, setActiva] = useState(true);
  const [renov, setRenov] = useState(false);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [msg, setMsg] = useState<Mensaje | null>(null);
  const [msgPlan, setMsgPlan] = useState<Mensaje | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState("hcm");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const [a, p] = await Promise.all([
      supabase.from("aseguradoras").select("*").eq("id", id!).single(),
      supabase
        .from("planes")
        .select("id,nombre,tipo,modalidad,activo,recomendado,mas_vendido,tarifas(count)")
        .eq("aseguradora_id", id!)
        .order("nombre"),
    ]);
    if (a.error) {
      setMsg({ tipo: "error", texto: a.error.message });
      return;
    }
    const r = a.data as Record<string, unknown>;
    const s = (k: string) => (r[k] === null || r[k] === undefined ? "" : String(r[k]));
    const valores: Record<string, string> = { estatus_integracion: s("estatus_integracion") };
    for (const k of [...TEXTO, ...NUMEROS]) valores[k] = s(k);
    setF(valores);
    setCuotas((r.cuotas as string[]) ?? []);
    setActiva(Boolean(r.activa));
    setRenov(Boolean(r.renovacion_habilitada));
    setPlanes((p.data as unknown as Plan[]) ?? []);
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (perfil?.rol !== "admin") {
    return <p className="text-zinc-400">Solo los administradores pueden editar aseguradoras.</p>;
  }
  if (!f) return <p className="text-zinc-400">{msg ? <Aviso mensaje={msg} /> : "Cargando…"}</p>;

  const set = (k: string, v: string) => setF({ ...f, [k]: v });

  const guardar = async () => {
    setMsg(null);
    if (!f.nombre.trim()) {
      setMsg({ tipo: "error", texto: "El nombre es obligatorio." });
      return;
    }
    const payload: Record<string, unknown> = {};
    for (const k of TEXTO) payload[k] = f[k].trim() === "" ? null : f[k].trim();
    for (const k of NUMEROS) {
      const n = numero(f[k]);
      if (Number.isNaN(n)) {
        setMsg({ tipo: "error", texto: `Valor numérico inválido en "${k}".` });
        return;
      }
      payload[k] = n;
    }
    payload.nombre = f.nombre.trim();
    payload.orden = numero(f.orden) ?? 0;
    payload.recargo_renovacion_pct = numero(f.recargo_renovacion_pct) ?? 0;
    payload.estatus_integracion = f.estatus_integracion;
    payload.cuotas = cuotas;
    payload.activa = activa;
    payload.renovacion_habilitada = renov;

    setGuardando(true);
    const r = await supabase.from("aseguradoras").update(payload).eq("id", id!);
    setGuardando(false);
    setMsg(r.error ? { tipo: "error", texto: r.error.message } : { tipo: "ok", texto: "Guardado." });
  };

  const eliminar = async () => {
    const n = planes.length;
    const ok = window.confirm(
      `Vas a eliminar "${f.nombre}" con sus ${n} planes y TODAS sus tarifas. No se puede deshacer. ¿Continuar?`,
    );
    if (!ok) return;
    const r = await supabase.from("aseguradoras").delete().eq("id", id!);
    if (r.error) setMsg({ tipo: "error", texto: r.error.message });
    else navigate("/aseguradoras");
  };

  const crearPlan = async () => {
    setMsgPlan(null);
    if (!nuevoNombre.trim()) {
      setMsgPlan({ tipo: "error", texto: "Escribe el nombre del plan." });
      return;
    }
    const r = await supabase
      .from("planes")
      .insert({ aseguradora_id: id, nombre: nuevoNombre.trim(), tipo: nuevoTipo })
      .select("id")
      .single();
    if (r.error) setMsgPlan({ tipo: "error", texto: r.error.message });
    else navigate(`/planes/${(r.data as { id: string }).id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/aseguradoras" className="text-sm text-indigo-300 hover:underline">
          ← Aseguradoras
        </Link>
        <h1 className="mt-1 text-3xl font-bold">{f.nombre || "Aseguradora"}</h1>
      </div>

      <Seccion titulo="Planes" ayuda="Entra a un plan para editar sus datos, add-ons, beneficios y tarifas.">
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Modalidad</th>
                <th className="px-3 py-2">Tarifas</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {planes.map((p) => (
                <tr key={p.id} className="border-t border-zinc-800">
                  <td className="px-3 py-2 font-medium">{p.nombre}</td>
                  <td className="px-3 py-2">{TIPOS.find((t) => t[0] === p.tipo)?.[1] ?? p.tipo}</td>
                  <td className="px-3 py-2">{p.modalidad === "por_grupo" ? "Por grupo" : "Por persona"}</td>
                  <td className="px-3 py-2">{p.tarifas?.[0]?.count ?? 0}</td>
                  <td className="px-3 py-2">{p.activo ? "Activo" : "Inactivo"}</td>
                  <td className="px-3 py-2 text-right">
                    <Link to={`/planes/${p.id}`} className="text-indigo-300 hover:underline">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
              {planes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-zinc-500">
                    Sin planes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <Campo etiqueta="Nuevo plan">
              <input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Nombre del plan"
                className={inputCls}
              />
            </Campo>
          </div>
          <div className="w-48">
            <Campo etiqueta="Tipo">
              <select value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)} className={inputCls}>
                {TIPOS.map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <Boton onClick={crearPlan}>Crear plan</Boton>
        </div>
        <Aviso mensaje={msgPlan} />
      </Seccion>

      <Seccion titulo="Datos de la aseguradora">
        <div className="grid gap-3 md:grid-cols-2">
          <Campo etiqueta="Nombre *">
            <input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} className={inputCls} />
          </Campo>
          <Campo etiqueta="Nombre corto">
            <input value={f.nombre_corto} onChange={(e) => set("nombre_corto", e.target.value)} className={inputCls} />
          </Campo>
          <Campo etiqueta="Ciudad">
            <input value={f.ciudad} onChange={(e) => set("ciudad", e.target.value)} className={inputCls} />
          </Campo>
          <Campo etiqueta="País">
            <input value={f.pais} onChange={(e) => set("pais", e.target.value)} className={inputCls} />
          </Campo>
          <Campo etiqueta="Fundada en (año)">
            <input value={f.fundada_en} onChange={(e) => set("fundada_en", e.target.value)} className={inputCls} />
          </Campo>
          <Campo etiqueta="Orden">
            <input value={f.orden} onChange={(e) => set("orden", e.target.value)} className={inputCls} />
          </Campo>
          <Campo etiqueta="Estatus de integración">
            <select
              value={f.estatus_integracion}
              onChange={(e) => set("estatus_integracion", e.target.value)}
              className={inputCls}
            >
              {ESTATUS.map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Comisión %">
              <input value={f.comision_pct} onChange={(e) => set("comision_pct", e.target.value)} className={inputCls} />
            </Campo>
            <Campo etiqueta="Rating (0–5)">
              <input value={f.rating} onChange={(e) => set("rating", e.target.value)} className={inputCls} />
            </Campo>
          </div>
          <Campo etiqueta="Portal (URL)">
            <input value={f.portal_url} onChange={(e) => set("portal_url", e.target.value)} className={inputCls} />
          </Campo>
          <Campo etiqueta="Email de contacto">
            <input
              value={f.email_contacto}
              onChange={(e) => set("email_contacto", e.target.value)}
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Dirección">
            <input value={f.direccion} onChange={(e) => set("direccion", e.target.value)} className={inputCls} />
          </Campo>
          <Campo etiqueta="Ejecutivo de cuenta">
            <input
              value={f.ejecutivo_cuenta}
              onChange={(e) => set("ejecutivo_cuenta", e.target.value)}
              className={inputCls}
            />
          </Campo>
        </div>

        <div>
          <p className="mb-2 text-sm text-zinc-400">Cuotas disponibles</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {CUOTAS.map(([v, n]) => (
              <Casilla
                key={v}
                etiqueta={n}
                checked={cuotas.includes(v)}
                onChange={(on) => setCuotas(on ? [...cuotas, v] : cuotas.filter((c) => c !== v))}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-6">
          <Casilla etiqueta="Aseguradora activa" checked={activa} onChange={setActiva} />
          <Casilla etiqueta="Renovación habilitada" checked={renov} onChange={setRenov} />
          <div className="w-40">
            <Campo etiqueta="Recargo renovación %">
              <input
                value={f.recargo_renovacion_pct}
                onChange={(e) => set("recargo_renovacion_pct", e.target.value)}
                className={inputCls}
              />
            </Campo>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Boton onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </Boton>
          <Aviso mensaje={msg} />
        </div>
      </Seccion>

      <Seccion titulo="Zona de peligro">
        <Boton variante="peligro" onClick={eliminar}>
          Eliminar aseguradora
        </Boton>
      </Seccion>
    </div>
  );
}
