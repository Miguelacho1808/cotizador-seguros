import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { telefonoWhatsApp } from "../lib/telefono";
import { Aviso, Boton, type Mensaje } from "../components/ui";
import { ESTADOS, colorEstado } from "./Cotizaciones";
import { esMercantilPanama } from "../lib/premiumMercantilPanama";
import { aplicarVariables, htmlDePlantilla, tablaPlanesHtml, variablesCorreo, type Plantilla } from "../lib/plantillasCorreo";
import { cuotasDelPlan } from "../lib/calculo";
import { useAuth } from "../lib/auth";
import DocumentoCotizacion, { type PlanDoc } from "../components/DocumentoCotizacion";

type Plan = {
  id: string;
  plan_id: string | null;
  desglose: PlanDoc["desglose"];
  aseguradora_nombre: string;
  plan_nombre: string;
  cobertura_monto: number;
  deducible: number;
  addons: string[];
  prima_anual: number;
  prima_semestral: number;
  prima_trimestral: number;
  prima_mensual: number;
};
type Cot = {
  id: string;
  numero: number;
  estado: string;
  grupo: string;
  tipo: string;
  canal: string | null;
  token_publico: string;
  created_at: string;
  clientes: { nombre: string; apellido: string | null; telefono: string | null; email: string | null } | null;
  cotizacion_asegurados: { id: string; nombre: string; edad: number; sexo: string; es_titular: boolean; orden: number }[];
  cotizacion_planes: Plan[];
};

export default function CotizacionDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { perfil } = useAuth();
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [asesorWa, setAsesorWa] = useState("");
  useEffect(() => {
    if (!perfil) return;
    supabase.from("perfiles").select("whatsapp,telefono").eq("id", perfil.id).maybeSingle().then(({ data }) => {
      const d = data as { whatsapp: string | null; telefono: string | null } | null;
      setAsesorWa(d?.whatsapp ?? d?.telefono ?? "");
    });
  }, [perfil]);
  const [cot, setCot] = useState<Cot | null>(null);
  const [benef, setBenef] = useState<Record<string, { nombre: string; estado: string; orden: number }[]>>({});
  const [org, setOrg] = useState<{ nombre: string; logo_url: string | null } | null>(null);
  const [logos, setLogos] = useState<Record<string, string | null>>({});
  const [msg, setMsg] = useState<Mensaje | null>(null);

  useEffect(() => {
    supabase
      .from("cotizaciones")
      .select(
        "id,numero,estado,grupo,tipo,canal,token_publico,created_at,clientes(nombre,apellido,telefono,email),cotizacion_asegurados(id,nombre,edad,sexo,es_titular,orden),cotizacion_planes(id,plan_id,desglose,aseguradora_nombre,plan_nombre,cobertura_monto,deducible,addons,prima_anual,prima_semestral,prima_trimestral,prima_mensual)",
      )
      .eq("id", id!)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setMsg({ tipo: "error", texto: error.message });
        else if (!data) setMsg({ tipo: "error", texto: "Cotización no encontrada." });
        else {
          const c = data as unknown as Cot;
          setCot(c);
          const ids = [...new Set(c.cotizacion_planes.map((p) => p.plan_id).filter(Boolean))] as string[];
          if (ids.length > 0)
            supabase
              .from("planes")
              .select("id,aseguradoras(logo_url)")
              .in("id", ids)
              .then(({ data: l }) => {
                const m: Record<string, string | null> = {};
                for (const x of (l as unknown as { id: string; aseguradoras: { logo_url: string | null } | null }[]) ?? [])
                  m[x.id] = x.aseguradoras?.logo_url ?? null;
                setLogos(m);
              });
          if (ids.length > 0)
            supabase
              .from("plan_beneficios")
              .select("plan_id,estado,oculto,beneficios(nombre,orden)")
              .in("plan_id", ids)
              .then(({ data: b }) => {
                const m: Record<string, { nombre: string; estado: string; orden: number }[]> = {};
                for (const x of (b as unknown as { plan_id: string; estado: string; oculto: boolean; beneficios: { nombre: string; orden: number } }[]) ?? [])
                  if (!x.oculto) (m[x.plan_id] ??= []).push({ nombre: x.beneficios.nombre, estado: x.estado, orden: x.beneficios.orden });
                for (const k of Object.keys(m)) m[k].sort((a, b2) => a.orden - b2.orden);
                setBenef(m);
              });
        }
      });
  }, [id]);

  useEffect(() => {
    supabase
      .from("organizacion")
      .select("nombre,logo_url")
      .maybeSingle()
      .then(({ data }) => setOrg((data as { nombre: string; logo_url: string | null } | null) ?? null));
  }, []);

  if (!cot) return <div>{msg ? <Aviso mensaje={msg} /> : <p className="text-zinc-400">Cargando…</p>}</div>;

  const enlace = `${window.location.origin}/compartir/${cot.token_publico}`;
  const nombreCliente = [cot.clientes?.nombre, cot.clientes?.apellido].filter(Boolean).join(" ");
  const planes = [...cot.cotizacion_planes].sort((a, b) => a.prima_anual - b.prima_anual);

  const cambiarEstado = async (estado: string) => {
    const r = await supabase.from("cotizaciones").update({ estado }).eq("id", cot.id);
    if (r.error) setMsg({ tipo: "error", texto: r.error.message });
    else setCot({ ...cot, estado });
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      setMsg({ tipo: "ok", texto: "Enlace copiado." });
    } catch {
      setMsg({ tipo: "error", texto: `No se pudo copiar. Enlace: ${enlace}` });
    }
  };

  const whatsapp = () => {
    const tel = telefonoWhatsApp(cot.clientes?.telefono);
    if (!tel) {
      setMsg({ tipo: "error", texto: "El cliente no tiene teléfono guardado." });
      return;
    }
    const texto = `Hola ${cot.clientes?.nombre ?? ""}, te comparto tu cotización de seguro de salud: ${enlace}`;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  };

  const enviarCorreo = async () => {
    let para = cot.clientes?.email?.trim() ?? "";
    if (!para) para = window.prompt("El cliente no tiene correo guardado. ¿A qué correo envías la cotización?")?.trim() ?? "";
    if (!para) return;
    setEnviandoCorreo(true);
    setMsg(null);
    const pl = await supabase
      .from("plantillas_correo")
      .select("id,nombre,asunto,cuerpo,predeterminada,html,bloques,updated_at")
      .order("predeterminada", { ascending: false })
      .order("created_at")
      .limit(1)
      .maybeSingle();
    const plantilla = pl.data as unknown as Plantilla | null;
    if (!plantilla) {
      setEnviandoCorreo(false);
      return setMsg({ tipo: "error", texto: "No hay plantillas de email: crea una en Configuraciones." });
    }
    const orden = [...planes].sort((a, b) => a.aseguradora_nombre.localeCompare(b.aseguradora_nombre) || a.cobertura_monto - b.cobertura_monto);
    const valorCuota = (p: Plan, clave: string) => {
      const l = cuotasDelPlan(p.prima_anual, p.desglose?.cuotas).find((x) => x.clave === clave);
      return l ? l.valor : null;
    };
    const vistos = new Set<string>();
    const nombresBen: string[] = [];
    for (const p of orden)
      for (const b of (p.plan_id && benef[p.plan_id]) || [])
        if (b.estado === "incluido" && !vistos.has(b.nombre)) {
          vistos.add(b.nombre);
          nombresBen.push(b.nombre);
        }
    const vars = variablesCorreo({
      orgNombre: org?.nombre ?? "",
      orgLogo: org?.logo_url ?? null,
      cliente: cot.clientes?.nombre ?? "",
      numero: cot.numero,
      enlace,
      asesor: [perfil?.nombre, perfil?.apellido].filter(Boolean).join(" "),
      whatsapp: asesorWa,
      planesTabla: tablaPlanesHtml(
        orden.map((p) => ({
          aseguradora: p.aseguradora_nombre,
          logo: p.plan_id ? (logos[p.plan_id] ?? null) : null,
          plan: p.plan_nombre,
          tipo: p.desglose?.tipo ?? "hcm",
          cobertura: p.cobertura_monto,
          coberturas: [...((p.plan_id && benef[p.plan_id]) || []).filter((b) => b.estado === "incluido").map((b) => b.nombre).slice(0, 3), ...p.addons].slice(0, 5),
          mensual: valorCuota(p, "mensual"),
          trimestral: valorCuota(p, "trimestral"),
          anual: valorCuota(p, "anual") ?? p.prima_anual,
        })),
        nombresBen,
        new Set(planes.map((p) => p.plan_id)).size,
      ),
      aseguradoras: [...new Set(planes.map((p) => p.aseguradora_nombre))].join(", "),
      desde: `US$ ${Math.min(...planes.map((p) => p.prima_anual)).toLocaleString("es-ES", { maximumFractionDigits: 0 })}`,
    });
    const r = await supabase.functions.invoke("enviar-correo", {
      body: {
        accion: "enviar",
        para,
        asunto: aplicarVariables(plantilla.asunto, vars),
        cuerpo: aplicarVariables(plantilla.cuerpo, vars),
        html: aplicarVariables(htmlDePlantilla(plantilla), vars),
      },
    });
    setEnviandoCorreo(false);
    const d = r.data as { ok?: boolean; error?: string } | null;
    if (r.error || !d?.ok) return setMsg({ tipo: "error", texto: d?.error ?? r.error?.message ?? "No se pudo enviar el correo." });
    setMsg({ tipo: "ok", texto: `Correo enviado a ${para} con la plantilla "${plantilla.nombre}".` });
    if (cot.estado === "borrador") void cambiarEstado("enviada");
  };

  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar la cotización #${cot.numero}? No se puede deshacer.`)) return;
    const r = await supabase.from("cotizaciones").delete().eq("id", cot.id);
    if (r.error) setMsg({ tipo: "error", texto: r.error.message });
    else navigate("/cotizaciones");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 print:max-w-none print:space-y-0">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <Link to="/cotizaciones" className="text-sm text-zinc-400 hover:text-zinc-100">
            ← Cotizaciones
          </Link>
          <h1 className="text-3xl font-bold">Cotización #{cot.numero}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton variante="secundario" onClick={copiar}>
            Copiar enlace
          </Boton>
          <Boton variante="secundario" onClick={whatsapp}>
            WhatsApp
          </Boton>
          <Boton variante="secundario" onClick={enviarCorreo} disabled={enviandoCorreo}>
            {enviandoCorreo ? "Enviando…" : "Enviar correo"}
          </Boton>
          <Boton variante="secundario" onClick={() => window.print()}>
            Imprimir / PDF
          </Boton>
          {planes.some((p) => esMercantilPanama(p.aseguradora_nombre)) && (
            <Link
              to={`/cotizaciones/${cot.id}/premium`}
              className="rounded-lg border border-indigo-400/50 px-4 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-500/10"
            >
              PDF Mercantil Panamá
            </Link>
          )}
          <Boton variante="peligro" onClick={eliminar}>
            Eliminar
          </Boton>
        </div>
      </div>
      <Aviso mensaje={msg} />

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-zinc-400">
          {[cot.clientes?.telefono, cot.clientes?.email].filter(Boolean).join(" · ") || "Cliente sin contacto"}
          {cot.canal ? ` · ${cot.canal}` : ""}
        </p>
        <select
          value={cot.estado}
          onChange={(e) => cambiarEstado(e.target.value)}
          className={`rounded-full border-0 px-3 py-1 text-sm ${colorEstado[cot.estado] ?? ""}`}
        >
          {Object.entries(ESTADOS).map(([v, n]) => (
            <option key={v} value={v} className="bg-zinc-800 text-zinc-100">
              {n}
            </option>
          ))}
        </select>
      </div>

      <DocumentoCotizacion
        d={{
          numero: cot.numero,
          fecha: cot.created_at,
          tipo: cot.tipo,
          organizacion: org?.nombre ?? null,
          organizacionLogo: org?.logo_url ?? null,
          cliente: nombreCliente || "Sin cliente",
          asegurados: [...cot.cotizacion_asegurados].sort((a, b) => a.orden - b.orden),
          planes: planes.map((p) => ({
            ...p,
            beneficios: (p.plan_id && benef[p.plan_id]) || [],
            logo_url: p.plan_id ? (logos[p.plan_id] ?? null) : null,
          })),
        }}
      />
    </div>
  );
}
