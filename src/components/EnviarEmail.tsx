import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { aplicarVariables, type Plantilla } from "../lib/plantillasCorreo";
import { Aviso, Boton, Campo, inputCls, type Mensaje } from "./ui";

type Props = {
  para: string;
  /** Se llama tras un envío correcto desde el servidor (para marcar la cotización como enviada). */
  onEnviado?: () => void;
  variables: Record<string, string>;
  onCerrar: () => void;
};

export default function EnviarEmail({ para, variables, onCerrar, onEnviado }: Props) {
  const [enviando, setEnviando] = useState(false);
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

  const enviar = async () => {
    if (!destino.trim()) return setMsg({ tipo: "error", texto: "Escribe el correo del cliente." });
    setEnviando(true);
    setMsg(null);
    const r = await supabase.functions.invoke("enviar-correo", { body: { accion: "enviar", para: destino.trim(), asunto, cuerpo } });
    setEnviando(false);
    const d = r.data as { ok?: boolean; error?: string } | null;
    if (r.error || !d?.ok) return setMsg({ tipo: "error", texto: d?.error ?? r.error?.message ?? "No se pudo enviar." });
    setMsg({ tipo: "ok", texto: `Correo enviado a ${destino.trim()}.` });
    onEnviado?.();
  };

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
      <p className="text-xs text-zinc-500">
        "Enviar" usa tu email configurado y verificado en Mi Perfil → Mi Email. Si aún no lo tienes, usa Gmail o tu correo.
      </p>
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
        <Boton onClick={enviar} disabled={enviando}>
          {enviando ? "Enviando…" : "✉ Enviar"}
        </Boton>
        <Boton variante="secundario" onClick={abrirGmail}>
          Abrir en Gmail
        </Boton>
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
