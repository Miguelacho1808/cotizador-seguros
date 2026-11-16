import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { telefonoWhatsApp } from "../lib/telefono";
import { Aviso, Boton, type Mensaje } from "../components/ui";
import { ESTADOS, colorEstado } from "./Cotizaciones";
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
              .select("plan_id,estado,beneficios(nombre,orden)")
              .in("plan_id", ids)
              .then(({ data: b }) => {
                const m: Record<string, { nombre: string; estado: string; orden: number }[]> = {};
                for (const x of (b as unknown as { plan_id: string; estado: string; beneficios: { nombre: string; orden: number } }[]) ?? [])
                  (m[x.plan_id] ??= []).push({ nombre: x.beneficios.nombre, estado: x.estado, orden: x.beneficios.orden });
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
          <Boton variante="secundario" onClick={() => window.print()}>
            Imprimir / PDF
          </Boton>
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
