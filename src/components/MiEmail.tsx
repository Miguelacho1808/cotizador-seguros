import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Aviso, Boton, Campo, Seccion, inputCls, type Mensaje } from "./ui";

type Cfg = {
  remitente: string;
  nombre: string;
  host: string;
  puerto: string;
  usuario: string;
  clave: string;
  firma: string;
};
const VACIO: Cfg = { remitente: "", nombre: "", host: "smtp.gmail.com", puerto: "465", usuario: "", clave: "", firma: "" };

export default function MiEmail() {
  const { perfil } = useAuth();
  const [f, setF] = useState<Cfg>(VACIO);
  const [existe, setExiste] = useState(false);
  const [claveGuardada, setClaveGuardada] = useState(false);
  const [verificado, setVerificado] = useState(false);
  const [ver, setVer] = useState(false);
  const [msg, setMsg] = useState<Mensaje | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = async () => {
    if (!perfil) return;
    const r = await supabase
      .from("perfil_smtp")
      .select("remitente,nombre,host,puerto,usuario,firma,verificado,clave_guardada")
      .eq("perfil_id", perfil.id)
      .maybeSingle();
    if (r.error || !r.data) return;
    const d = r.data as Record<string, string | number | boolean | null>;
    setExiste(true);
    setVerificado(Boolean(d.verificado));
    setClaveGuardada(Boolean(d.clave_guardada));
    setF({
      remitente: String(d.remitente ?? ""),
      nombre: String(d.nombre ?? ""),
      host: String(d.host ?? ""),
      puerto: String(d.puerto ?? "465"),
      usuario: String(d.usuario ?? ""),
      clave: "",
      firma: String(d.firma ?? ""),
    });
  };
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  const guardar = async (): Promise<boolean> => {
    if (!perfil) return false;
    setMsg(null);
    if (!f.remitente.trim() || !f.host.trim() || !f.usuario.trim()) {
      setMsg({ tipo: "error", texto: "Completa email remitente, servidor y usuario." });
      return false;
    }
    if (!existe && !f.clave) {
      setMsg({ tipo: "error", texto: "Escribe la contraseña / App Password." });
      return false;
    }
    const base: Record<string, unknown> = {
      remitente: f.remitente.trim(),
      nombre: f.nombre.trim() || null,
      host: f.host.trim(),
      puerto: Number(f.puerto) || 465,
      usuario: f.usuario.trim(),
      firma: f.firma.trim() || null,
    };
    if (f.clave) base.clave = f.clave;
    const r = existe
      ? await supabase.from("perfil_smtp").update(base).eq("perfil_id", perfil.id)
      : await supabase.from("perfil_smtp").insert({ ...base, perfil_id: perfil.id });
    if (r.error) {
      setMsg({ tipo: "error", texto: r.error.message });
      return false;
    }
    await cargar();
    return true;
  };

  const guardarClick = async () => {
    setOcupado(true);
    if (await guardar()) setMsg({ tipo: "ok", texto: "Configuración guardada. Envía la prueba para activarla." });
    setOcupado(false);
  };

  const probar = async () => {
    setOcupado(true);
    if (await guardar()) {
      const r = await supabase.functions.invoke("enviar-correo", { body: { accion: "prueba" } });
      const d = r.data as { ok?: boolean; error?: string } | null;
      if (r.error || !d?.ok) setMsg({ tipo: "error", texto: d?.error ?? r.error?.message ?? "No se pudo enviar la prueba." });
      else {
        setMsg({ tipo: "ok", texto: `Prueba enviada a ${f.remitente}. Revisa tu bandeja; el email quedó verificado.` });
        await cargar();
      }
    }
    setOcupado(false);
  };

  const limpiar = async () => {
    if (!perfil || !window.confirm("¿Borrar tu configuración de email?")) return;
    const r = await supabase.from("perfil_smtp").delete().eq("perfil_id", perfil.id);
    if (r.error) return setMsg({ tipo: "error", texto: r.error.message });
    setF(VACIO);
    setExiste(false);
    setVerificado(false);
    setClaveGuardada(false);
    setMsg({ tipo: "ok", texto: "Configuración borrada." });
  };

  const set = (k: keyof Cfg) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Seccion
      titulo={`Mi Email (opcional)${verificado ? " · ✓ Verificado" : ""}`}
      ayuda="Configura tu SMTP personal para enviar las cotizaciones desde tu propio correo. Requiere prueba antes de activarse."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Campo etiqueta='Email "De:" (remitente)'>
          <input value={f.remitente} onChange={set("remitente")} className={inputCls} placeholder="tucorreo@gmail.com" />
        </Campo>
        <Campo etiqueta="Nombre mostrado">
          <input value={f.nombre} onChange={set("nombre")} className={inputCls} />
        </Campo>
        <Campo etiqueta="Servidor SMTP">
          <input value={f.host} onChange={set("host")} className={inputCls} />
        </Campo>
        <Campo etiqueta="Puerto">
          <input value={f.puerto} onChange={set("puerto")} className={inputCls} inputMode="numeric" />
        </Campo>
        <Campo etiqueta="Usuario SMTP">
          <input value={f.usuario} onChange={set("usuario")} className={inputCls} />
        </Campo>
        <Campo etiqueta="Contraseña / App Password">
          <div className="flex gap-2">
            <input
              type={ver ? "text" : "password"}
              value={f.clave}
              onChange={set("clave")}
              className={inputCls}
              placeholder={claveGuardada ? "•••••••• (guardada; escribe para cambiarla)" : ""}
              autoComplete="new-password"
            />
            <Boton type="button" variante="secundario" onClick={() => setVer(!ver)}>
              {ver ? "Ocultar" : "Ver"}
            </Boton>
          </div>
        </Campo>
      </div>
      <Campo etiqueta="Firma (opcional)">
        <textarea rows={3} value={f.firma} onChange={set("firma")} className={inputCls} placeholder="Cordialmente, Juan Pérez · Asesor · +58 424 1234567" />
      </Campo>
      <p className="text-xs text-zinc-500">
        Gmail: usa una App Password (no tu contraseña normal), host smtp.gmail.com. Hostinger: host smtp.hostinger.com. El envío se
        realiza siempre por el puerto 465 (TLS), aunque aquí indiques 587.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Boton onClick={guardarClick} disabled={ocupado}>
          Guardar configuración
        </Boton>
        <Boton variante="secundario" onClick={probar} disabled={ocupado}>
          {ocupado ? "Procesando…" : `Enviar prueba a ${f.remitente || "mi correo"}`}
        </Boton>
        {existe && (
          <Boton variante="peligro" onClick={limpiar} disabled={ocupado}>
            Limpiar
          </Boton>
        )}
        <Aviso mensaje={msg} />
      </div>
    </Seccion>
  );
}
