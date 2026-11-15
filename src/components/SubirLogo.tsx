import { useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Aviso, Boton, type Mensaje } from "./ui";

const TIPOS = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

/** Muestra el logo actual y permite subir uno nuevo al bucket público "logos" (solo administradores). */
export default function SubirLogo({
  url,
  carpeta,
  onCambio,
}: {
  url: string | null;
  carpeta: string;
  /** Debe guardar la nueva URL (o null) en la base de datos; devuelve un mensaje de error si falla. */
  onCambio: (url: string | null) => Promise<string | null>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<Mensaje | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const subir = async (archivo: File) => {
    setMsg(null);
    if (!TIPOS.includes(archivo.type)) {
      setMsg({ tipo: "error", texto: "Usa una imagen PNG, JPG o WEBP." });
      return;
    }
    if (archivo.size > MAX_BYTES) {
      setMsg({ tipo: "error", texto: "La imagen pesa más de 2 MB." });
      return;
    }
    setOcupado(true);
    const ext = archivo.type === "image/jpeg" ? "jpg" : archivo.type === "image/webp" ? "webp" : "png";
    const ruta = `${carpeta}/${Date.now()}.${ext}`;
    const r = await supabase.storage.from("logos").upload(ruta, archivo, { contentType: archivo.type });
    if (r.error) {
      setOcupado(false);
      setMsg({ tipo: "error", texto: r.error.message });
      return;
    }
    const publica = supabase.storage.from("logos").getPublicUrl(ruta).data.publicUrl;
    const fallo = await onCambio(publica);
    setOcupado(false);
    setMsg(fallo ? { tipo: "error", texto: fallo } : { tipo: "ok", texto: "Logo actualizado." });
  };

  const quitar = async () => {
    setOcupado(true);
    const fallo = await onCambio(null);
    setOcupado(false);
    setMsg(fallo ? { tipo: "error", texto: fallo } : { tipo: "ok", texto: "Logo quitado." });
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-20 w-48 items-center justify-center rounded-lg border border-zinc-700 bg-white p-2">
        {url ? (
          <img src={url} alt="Logo" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-zinc-500">Sin logo</span>
        )}
      </div>
      <div className="space-y-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void subir(f);
          }}
        />
        <div className="flex gap-2">
          <Boton variante="secundario" disabled={ocupado} onClick={() => input.current?.click()}>
            {ocupado ? "Subiendo…" : url ? "Cambiar logo" : "Subir logo"}
          </Boton>
          {url && (
            <Boton variante="peligro" disabled={ocupado} onClick={quitar}>
              Quitar
            </Boton>
          )}
        </div>
        <p className="text-xs text-zinc-500">PNG, JPG o WEBP, máximo 2 MB. Mejor con fondo transparente o blanco.</p>
        <Aviso mensaje={msg} />
      </div>
    </div>
  );
}
