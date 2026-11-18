import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { aplicarVariables, htmlDePlantilla, type Plantilla } from "../lib/plantillasCorreo";
import { Aviso, Boton, Campo, inputCls, type Mensaje } from "./ui";

type Props = {
  para: string;
  variables: Record<string, string>;
  onCerrar: () => void;
  /** Se llama tras un envío correcto desde el servidor (para marcar la cotización como enviada). */
  onEnviado?: () => void;
};

export default function EnviarEmail({ para, variables, onCerrar, onEnviado }: Props) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [sel, setSel] = useState<Plantilla | null>(null);
  const [destino, setDestino] = useState(para);
  const [asunto, setAsunto] = useState("");
  const [msg, setMsg] = useState<Mensaje | null>(null);
  const [enviando, setEnviando] = useState(false);

  const usar = (p: Plantilla) => {
    setSel(p);
    setAsunto(aplicarVariables(p.asunto, variables));
  };

  useEffect(() => {
    supabase
      .from("plantillas_correo")
      .select("id,nombre,asunto,cuerpo,predeterminada,html,bloques,updated_at")
      .order("created_at")
      .then(({ data }) => {
        const l = (data as unknown as Plantilla[]) ?? [];
        setPlantillas(l);
        const p = l.find((x) => x.predeterminada) ?? l[0];
        if (p) usar(p);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const html = sel ? aplicarVariables(htmlDePlantilla(sel), variables) : "";
  const texto = sel ? aplicarVariables(sel.cuerpo, variables) : "";

  const validar = () => {
    if (!destino.trim()) {
      setMsg({ tipo: "error", texto: "Escribe el correo del cliente." });
      return false;
    }
    return true;
  };
  const enviar = async () => {
    if (!validar() || !sel) return;
    setEnviando(true);
    setMsg(null);
    const r = await supabase.functions.invoke("enviar-correo", {
      body: { accion: "enviar", para: destino.trim(), asunto, cuerpo: texto, html },
    });
    setEnviando(false);
    const d = r.data as { ok?: boolean; error?: string } | null;
    if (r.error || !d?.ok) return setMsg({ tipo: "error", texto: d?.error ?? r.error?.message ?? "No se pudo enviar." });
    setMsg({ tipo: "ok", texto: `Correo enviado a ${destino.trim()}.` });
    onEnviado?.();
  };

  const enc = encodeURIComponent;
  const abrirCorreo = () => validar() && (window.location.href = `mailto:${destino.trim()}?subject=${enc(asunto)}&body=${enc(texto)}`);
  const abrirGmail = () =>
    validar() &&
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${enc(destino.trim())}&su=${enc(asunto)}&body=${enc(texto)}`, "_blank", "noopener");

  return (
    <div className="space-y-3 rounded-xl border border-indigo-400/40 bg-zinc-900 p-4 print:hidden">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Enviar por email</h2>
        <button onClick={onCerrar} className="text-sm text-zinc-400 hover:text-zinc-100">
          Cerrar ✕
        </button>
      </div>
      <Campo etiqueta="Plantilla">
        <select
          value={sel?.id ?? ""}
          onChange={(e) => {
            const p = plantillas.find((x) => x.id === e.target.value);
            if (p) usar(p);
          }}
          className={inputCls}
        >
          {plantillas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
              {p.predeterminada ? " (default)" : ""}
            </option>
          ))}
        </select>
      </Campo>
      <div className="grid gap-3 md:grid-cols-2">
        <Campo etiqueta="Para">
          <input value={destino} onChange={(e) => setDestino(e.target.value)} className={inputCls} placeholder="correo@cliente.com" />
        </Campo>
        <Campo etiqueta="Asunto">
          <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={inputCls} />
        </Campo>
      </div>
      {sel && (
        <iframe
          title="Vista previa del correo"
          sandbox=""
          srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0">${html}</body>`}
          className="h-[420px] w-full rounded-lg border border-zinc-700 bg-[#eef2f7]"
        />
      )}
      <p className="text-xs text-zinc-500">
        "Enviar" usa tu email verificado en Mi Perfil → Mi Email. Gmail y correo simple abren el mensaje en texto, sin el diseño.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Boton onClick={enviar} disabled={enviando || !sel}>
          {enviando ? "Enviando…" : "✉ Enviar"}
        </Boton>
        <Boton variante="secundario" onClick={abrirGmail}>
          Abrir en Gmail
        </Boton>
        <Boton variante="secundario" onClick={abrirCorreo}>
          Abrir en mi correo
        </Boton>
        <Aviso mensaje={msg} />
      </div>
    </div>
  );
}
