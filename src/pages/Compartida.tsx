import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

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
  beneficios: { nombre: string; estado: string }[];
};
type Datos = {
  numero: number;
  fecha: string;
  grupo: string;
  tipo: string;
  cliente: { nombre: string; apellido: string | null } | null;
  asegurados: { nombre: string; edad: number; sexo: string; titular: boolean }[];
  planes: Plan[];
  asesor: { nombre: string; apellido: string | null; whatsapp: string | null } | null;
  organizacion: { nombre: string; rif: string | null; telefono: string | null } | null;
};

export default function Compartida() {
  const { token } = useParams();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [estado, setEstado] = useState<"cargando" | "no" | "ok">("cargando");

  useEffect(() => {
    supabase.rpc("obtener_cotizacion_compartida", { p_token: token }).then(({ data, error }) => {
      if (error || !data) setEstado("no");
      else {
        setDatos(data as Datos);
        setEstado("ok");
      }
    });
  }, [token]);

  if (estado === "cargando") return <p className="p-8 text-center text-zinc-400">Cargando cotización…</p>;
  if (estado === "no" || !datos)
    return <p className="p-8 text-center text-zinc-400">Esta cotización no existe o el enlace no es válido.</p>;

  const nombres = [...new Set(datos.planes.flatMap((p) => p.beneficios.map((b) => b.nombre)))];
  const celda = (p: Plan, nombre: string) => p.beneficios.find((b) => b.nombre === nombre)?.estado ?? "—";
  const tel = (datos.asesor?.whatsapp ?? "").replace(/\D/g, "");

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
      <header className="space-y-1">
        <p className="text-sm text-zinc-400">{datos.organizacion?.nombre}</p>
        <h1 className="text-3xl font-bold">
          Cotización de Salud #{datos.numero}
        </h1>
        <p className="text-zinc-300">
          {[datos.cliente?.nombre, datos.cliente?.apellido].filter(Boolean).join(" ")} ·{" "}
          {new Date(datos.fecha).toLocaleDateString("es-VE")}
        </p>
        <div className="flex flex-wrap gap-2 pt-1 text-sm">
          {datos.asegurados.map((a, i) => (
            <span key={i} className="rounded-full border border-zinc-700 px-3 py-1">
              {a.nombre} · {a.edad} años
            </span>
          ))}
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {datos.planes.map((p) => (
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
            {p.addons.length > 0 && <p className="text-xs text-zinc-500">Incluye: {p.addons.join(", ")}</p>}
          </div>
        ))}
      </div>

      {nombres.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-left text-zinc-400">
              <tr>
                <th className="p-3">Beneficio</th>
                {datos.planes.map((p) => (
                  <th key={p.id} className="p-3">
                    {p.aseguradora_nombre}
                    <span className="block text-xs font-normal">{p.plan_nombre}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nombres.map((n) => (
                <tr key={n} className="border-t border-zinc-800">
                  <td className="p-3 text-zinc-300">{n}</td>
                  {datos.planes.map((p) => (
                    <td key={p.id} className="p-3">
                      {celda(p, n)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {datos.asesor && (
        <footer className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
          <p>
            Tu asesor: <strong>{[datos.asesor.nombre, datos.asesor.apellido].filter(Boolean).join(" ")}</strong>
          </p>
          {tel && (
            <a
              href={`https://wa.me/${tel}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-300 hover:underline"
            >
              Escribir por WhatsApp
            </a>
          )}
        </footer>
      )}
    </div>
  );
}
