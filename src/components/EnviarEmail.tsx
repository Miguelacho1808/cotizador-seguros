import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { aplicarVariables, type Plantilla } from "../lib/plantillasCorreo";
import { Aviso, Boton, Campo, inputCls, type Mensaje } from "./ui";

type Props = {
  para: string;
  variables: Record<string, string>;
  onCerrar: () => void;
};

export default function EnviarEmail({ para, variables, onCerrar }: Props) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [destino, setDestino] = useState(para);
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [msg, setMsg] = useState<Mensaje | null>(null);

  const usar = (p: Plantilla) => {
    setAsunto(aplicarVariables(p.asunto, variables));
    setCuerpo(aplicarVariables(p.cuerpo, variables));
  };

  useEffect(() => {
    supabase
      .from("plantillas_correo")
      .select("id,nombre,asunto,cuerpo,predeterminada")
      .order("created_at")
      .then(({ data }) => {
        const l = (data as Plantilla[]) ?? [];
        setPlantillas(l);
        const p = l.find((x) => x.predeterminada) ?? l[0];
        if (p) usar(p);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enc = encodeURIComponent;
  const abrirCorreo = () => {
    if (!destino.trim()) return setMsg({ tipo: "error", texto: "Escribe el correo del cliente." });
    window.location.href = `mailto:${destino.trim()}?subject=${enc(asunto)}&body=${enc(cuerpo)}`;
  };
  const abrirGmail = () => {
    if (!destino.trim()) return setMsg({ tipo: "error", texto: "Escribe el correo del cliente." });
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(destino.trim())}&su=${enc(asunto)}&body=${enc(cuerpo)}`,
      "_blank",
      "noopener",
    );
  };
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`Asunto: ${asunto}\n\n${cuerpo}`);
      setMsg({ tipo: "ok", texto: "Mensaje copiado." });
    } catch {
      setMsg({ tipo: "error", texto: "No se pudo copiar." });
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-indigo-400/40 bg-zinc-900 p-4 print:hidden">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Enviar por email</h2>
        <button onClick={onCerrar} className="text-sm text-zinc-400 hover:text-zinc-100">
          Cerrar ✕
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {plantillas.map((p) => (
          <button
            key={p.id}
            onClick={() => usar(p)}
            className="rounded-lg border border-zinc-700 px-3 py-1 text-sm hover:bg-zinc-800"
          >
            {p.nombre}
          </button>
        ))}
        {plantillas.length === 0 && <p className="text-sm text-zinc-500">Sin plantillas: créalas en Configuración.</p>}
      </div>
      <Campo etiqueta="Para">
        <input value={destino} onChange={(e) => setDestino(e.target.value)} className={inputCls} placeholder="correo@cliente.com" />
      </Campo>
      <Campo etiqueta="Asunto">
        <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={inputCls} />
      </Campo>
      <Campo etiqueta="Mensaje">
        <textarea rows={10} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} className={inputCls} />
      </Campo>
      <div className="flex flex-wrap items-center gap-2">
        <Boton onClick={abrirGmail}>Abrir en Gmail</Boton>
        <Boton variante="secundario" onClick={abrirCorreo}>
          Abrir en mi correo
        </Boton>
        <Boton variante="secundario" onClick={copiar}>
          Copiar mensaje
        </Boton>
        <Aviso mensaje={msg} />
      </div>
    </div>
  );
}
