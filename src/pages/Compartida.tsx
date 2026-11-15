import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import DocumentoCotizacion, { type PlanDoc } from "../components/DocumentoCotizacion";

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

  const tel = (datos.asesor?.whatsapp ?? "").replace(/\D/g, "");

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-3 md:p-8 print:p-0">
      <div className="flex justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
        >
          Imprimir / PDF
        </button>
      </div>

      <DocumentoCotizacion
        d={{
          numero: datos.numero,
          fecha: datos.fecha,
          tipo: datos.tipo,
          organizacion: datos.organizacion?.nombre ?? null,
          organizacionLogo: datos.organizacion?.logo_url ?? null,
          cliente: [datos.cliente?.nombre, datos.cliente?.apellido].filter(Boolean).join(" "),
          asegurados: datos.asegurados,
          planes: datos.planes,
        }}
      />

      {datos.asesor && (
        <footer className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm print:hidden">
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
