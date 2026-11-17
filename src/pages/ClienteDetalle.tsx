import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { telefonoWhatsApp } from "../lib/telefono";
import { Aviso, Boton, Campo, Seccion, inputCls, type Mensaje } from "../components/ui";
import { ESTADOS, colorEstado } from "./Cotizaciones";

type Cot = { id: string; numero: number; estado: string; grupo: string; tipo: string; created_at: string };
const vacio = { nombre: "", apellido: "", cedula: "", telefono: "", email: "" };

export default function ClienteDetalle() {
  const { id } = useParams();
  const nuevo = id === "nuevo";
  const navigate = useNavigate();
  const [f, setF] = useState(vacio);
  const [cots, setCots] = useState<Cot[]>([]);
  const [cargando, setCargando] = useState(!nuevo);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<Mensaje | null>(null);
  const set = (k: keyof typeof vacio, v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (nuevo) return;
    (async () => {
      const [c, q] = await Promise.all([
        supabase.from("clientes").select("nombre,apellido,cedula,telefono,email").eq("id", id!).maybeSingle(),
        supabase
          .from("cotizaciones")
          .select("id,numero,estado,grupo,tipo,created_at")
          .eq("cliente_id", id!)
          .order("created_at", { ascending: false }),
      ]);
      if (c.error) setMsg({ tipo: "error", texto: c.error.message });
      else if (!c.data) setMsg({ tipo: "error", texto: "Cliente no encontrado." });
      else {
        const d = c.data;
        setF({
          nombre: d.nombre ?? "",
          apellido: d.apellido ?? "",
          cedula: d.cedula ?? "",
          telefono: d.telefono ?? "",
          email: d.email ?? "",
        });
      }
      setCots((q.data as Cot[]) ?? []);
      setCargando(false);
    })();
  }, [id, nuevo]);

  const guardar = async () => {
    if (!f.nombre.trim()) {
      setMsg({ tipo: "error", texto: "El nombre es obligatorio." });
      return;
    }
    setGuardando(true);
    setMsg(null);
    const datos = {
      nombre: f.nombre.trim(),
      apellido: f.apellido.trim() || null,
      cedula: f.cedula.trim() || null,
      telefono: f.telefono.trim() || null,
      email: f.email.trim() || null,
    };
    if (nuevo) {
      const r = await supabase.from("clientes").insert(datos).select("id").single();
      setGuardando(false);
      if (r.error) setMsg({ tipo: "error", texto: r.error.message });
      else navigate(`/clientes/${(r.data as { id: string }).id}`, { replace: true });
    } else {
      const r = await supabase.from("clientes").update(datos).eq("id", id!);
      setGuardando(false);
      setMsg(r.error ? { tipo: "error", texto: r.error.message } : { tipo: "ok", texto: "Cambios guardados." });
    }
  };

  const eliminar = async () => {
    const aviso =
      cots.length > 0
        ? `Este cliente tiene ${cots.length} cotización(es). Se conservarán, pero quedarán "Sin cliente". ¿Eliminar al cliente?`
        : "¿Eliminar este cliente? No se puede deshacer.";
    if (!window.confirm(aviso)) return;
    const r = await supabase.from("clientes").delete().eq("id", id!);
    if (r.error) setMsg({ tipo: "error", texto: r.error.message });
    else navigate("/clientes");
  };

  const whatsapp = () => {
    const tel = telefonoWhatsApp(f.telefono);
    if (!tel) setMsg({ tipo: "error", texto: "El cliente no tiene teléfono guardado." });
    else window.open(`https://wa.me/${tel}`, "_blank", "noopener");
  };

  if (cargando) return <p className="text-zinc-400">Cargando…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/clientes" className="text-sm text-zinc-400 hover:text-zinc-100">
            ← Clientes
          </Link>
          <h1 className="text-3xl font-bold">
            {nuevo ? "Nuevo cliente" : [f.nombre, f.apellido].filter(Boolean).join(" ") || "Cliente"}
          </h1>
        </div>
        {!nuevo && (
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" onClick={whatsapp}>
              WhatsApp
            </Boton>
            <Link
              to={`/cotizaciones/nueva?cliente=${id}`}
              className="rounded-lg bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-500/30"
            >
              + Nueva cotización
            </Link>
          </div>
        )}
      </div>

      <Seccion titulo="Datos del cliente">
        <div className="grid gap-3 md:grid-cols-2">
          <Campo etiqueta="Nombre *">
            <input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} className={inputCls} />
          </Campo>
          <Campo etiqueta="Apellido">
            <input value={f.apellido} onChange={(e) => set("apellido", e.target.value)} className={inputCls} />
          </Campo>
          <Campo etiqueta="Cédula">
            <input value={f.cedula} onChange={(e) => set("cedula", e.target.value)} className={inputCls} />
          </Campo>
          <Campo etiqueta="Teléfono">
            <input value={f.telefono} onChange={(e) => set("telefono", e.target.value)} className={inputCls} />
          </Campo>
          <Campo etiqueta="Email">
            <input value={f.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
          </Campo>
        </div>
        <div className="flex items-center gap-3">
          <Boton onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : nuevo ? "Crear cliente" : "Guardar cambios"}
          </Boton>
          <Aviso mensaje={msg} />
        </div>
      </Seccion>

      {!nuevo && (
        <Seccion titulo={`Cotizaciones (${cots.length})`}>
          {cots.length === 0 && <p className="text-sm text-zinc-400">Aún no tiene cotizaciones.</p>}
          <div className="space-y-2">
            {cots.map((c) => (
              <Link
                key={c.id}
                to={`/cotizaciones/${c.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 p-3 hover:border-zinc-600"
              >
                <span className="text-sm">
                  #{c.numero} · <span className="capitalize">{c.grupo}</span> ·{" "}
                  {new Date(c.created_at).toLocaleDateString("es-VE")}
                </span>
                <span className={`rounded-full px-3 py-0.5 text-xs ${colorEstado[c.estado] ?? ""}`}>
                  {ESTADOS[c.estado] ?? c.estado}
                </span>
              </Link>
            ))}
          </div>
        </Seccion>
      )}

      {!nuevo && (
        <Seccion titulo="Zona de peligro">
          <Boton variante="peligro" onClick={eliminar}>
            Eliminar cliente
          </Boton>
        </Seccion>
      )}
    </div>
  );
}
