import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Aviso, Boton, type Mensaje } from "../components/ui";
import { ESTADOS, colorEstado } from "./Cotizaciones";

const usd = (n: number) => `$${Number(n).toLocaleString("es-VE")}`;

type Plan = {
  id: string;
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
  const [msg, setMsg] = useState<Mensaje | null>(null);

  useEffect(() => {
    supabase
      .from("cotizaciones")
      .select(
        "id,numero,estado,grupo,tipo,canal,token_publico,created_at,clientes(nombre,apellido,telefono,email),cotizacion_asegurados(id,nombre,edad,sexo,es_titular,orden),cotizacion_planes(id,aseguradora_nombre,plan_nombre,cobertura_monto,deducible,addons,prima_anual,prima_semestral,prima_trimestral,prima_mensual)",
      )
      .eq("id", id!)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setMsg({ tipo: "error", texto: error.message });
        else if (!data) setMsg({ tipo: "error", texto: "Cotización no encontrada." });
        else setCot(data as unknown as Cot);
      });
  }, [id]);

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
    const tel = (cot.clientes?.telefono ?? "").replace(/\D/g, "");
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
    <div className="mx-auto max-w-4xl space-y-5">
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

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-lg font-semibold">{nombreCliente || "Sin cliente"}</p>
            <p className="text-sm text-zinc-400">
              {[cot.clientes?.telefono, cot.clientes?.email].filter(Boolean).join(" · ")}
            </p>
            <p className="text-xs text-zinc-500">
              {new Date(cot.created_at).toLocaleDateString("es-VE")} · {cot.grupo} ·{" "}
              {cot.tipo === "renovacion" ? "renovación" : "nueva póliza"}
              {cot.canal ? ` · ${cot.canal}` : ""}
            </p>
          </div>
          <div className="print:hidden">
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
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {[...cot.cotizacion_asegurados]
            .sort((a, b) => a.orden - b.orden)
            .map((a) => (
              <span key={a.id} className="rounded-full border border-zinc-700 px-3 py-1">
                {a.nombre} · {a.edad} años · {a.sexo}
              </span>
            ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {planes.map((p) => (
          <div key={p.id} className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="font-semibold">{p.aseguradora_nombre}</p>
            <p className="text-sm text-zinc-400">
              {p.plan_nombre} · {usd(p.cobertura_monto)}
              {Number(p.deducible) > 0 && ` · deducible ${usd(p.deducible)}`}
            </p>
            <p className="text-3xl font-bold">
              {usd(p.prima_mensual)}
              <span className="text-sm font-normal text-zinc-400">/mes</span>
            </p>
            <p className="text-xs text-zinc-400">
              Anual {usd(p.prima_anual)} · Semestral {usd(p.prima_semestral)} · Trimestral {usd(p.prima_trimestral)}
            </p>
            {p.addons.length > 0 && <p className="text-xs text-zinc-500">Add-ons: {p.addons.join(", ")}</p>}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm print:hidden">
        <p className="text-zinc-400">Enlace público para el cliente:</p>
        <p className="break-all text-indigo-300">{enlace}</p>
      </div>
    </div>
  );
}
