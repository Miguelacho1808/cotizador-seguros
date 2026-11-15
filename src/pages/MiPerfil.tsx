import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Aviso, Boton, Campo, Seccion, inputCls, type Mensaje } from "../components/ui";

export default function MiPerfil() {
  const { perfil, session, actualizarPerfil } = useAuth();
  const [f, setF] = useState<{ nombre: string; apellido: string; telefono: string; whatsapp: string } | null>(null);
  const [msg, setMsg] = useState<Mensaje | null>(null);
  const [clave, setClave] = useState({ nueva: "", repetir: "" });
  const [msgClave, setMsgClave] = useState<Mensaje | null>(null);

  useEffect(() => {
    if (!perfil) return;
    supabase
      .from("perfiles")
      .select("nombre,apellido,telefono,whatsapp")
      .eq("id", perfil.id)
      .single()
      .then(({ data, error }) => {
        if (error) setMsg({ tipo: "error", texto: error.message });
        else {
          const r = data as Record<string, string | null>;
          setF({
            nombre: r.nombre ?? "",
            apellido: r.apellido ?? "",
            telefono: r.telefono ?? "",
            whatsapp: r.whatsapp ?? "",
          });
        }
      });
  }, [perfil]);

  if (!perfil || !f) return <div>{msg ? <Aviso mensaje={msg} /> : <p className="text-zinc-400">Cargando…</p>}</div>;

  const guardar = async () => {
    setMsg(null);
    const wa = f.whatsapp.replace(/\D/g, "");
    if (f.whatsapp.trim() && (wa.length < 10 || wa.length > 15)) {
      setMsg({ tipo: "error", texto: "El WhatsApp debe incluir el código de país, por ejemplo 584141234567." });
      return;
    }
    const payload = {
      nombre: f.nombre.trim(),
      apellido: f.apellido.trim(),
      telefono: f.telefono.trim() || null,
      whatsapp: wa || null,
    };
    const r = await supabase.from("perfiles").update(payload).eq("id", perfil.id);
    if (r.error) setMsg({ tipo: "error", texto: r.error.message });
    else {
      actualizarPerfil({ nombre: payload.nombre, apellido: payload.apellido });
      setF({ ...f, whatsapp: wa });
      setMsg({ tipo: "ok", texto: "Guardado." });
    }
  };

  const cambiarClave = async () => {
    setMsgClave(null);
    if (clave.nueva.length < 8) {
      setMsgClave({ tipo: "error", texto: "La contraseña debe tener al menos 8 caracteres." });
      return;
    }
    if (clave.nueva !== clave.repetir) {
      setMsgClave({ tipo: "error", texto: "Las contraseñas no coinciden." });
      return;
    }
    const r = await supabase.auth.updateUser({ password: clave.nueva });
    if (r.error) setMsgClave({ tipo: "error", texto: r.error.message });
    else {
      setClave({ nueva: "", repetir: "" });
      setMsgClave({ tipo: "ok", texto: "Contraseña actualizada." });
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Mi perfil</h1>
      <Seccion
        titulo="Mis datos"
        ayuda="Tu WhatsApp es el número al que le escribe el cliente desde el enlace de la cotización."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nombre">
            <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} className={inputCls} />
          </Campo>
          <Campo etiqueta="Apellido">
            <input value={f.apellido} onChange={(e) => setF({ ...f, apellido: e.target.value })} className={inputCls} />
          </Campo>
          <Campo etiqueta="Teléfono">
            <input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} className={inputCls} />
          </Campo>
          <Campo etiqueta="WhatsApp (con código de país)">
            <input
              value={f.whatsapp}
              inputMode="tel"
              placeholder="584141234567"
              onChange={(e) => setF({ ...f, whatsapp: e.target.value })}
              className={inputCls}
            />
          </Campo>
        </div>
        <p className="text-xs text-zinc-500">Correo de acceso: {session?.user.email}</p>
        <div className="flex items-center gap-3">
          <Boton onClick={guardar}>Guardar</Boton>
          <Aviso mensaje={msg} />
        </div>
      </Seccion>

      <Seccion titulo="Cambiar contraseña">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nueva contraseña">
            <input
              type="password"
              value={clave.nueva}
              onChange={(e) => setClave({ ...clave, nueva: e.target.value })}
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Repetir contraseña">
            <input
              type="password"
              value={clave.repetir}
              onChange={(e) => setClave({ ...clave, repetir: e.target.value })}
              className={inputCls}
            />
          </Campo>
        </div>
        <div className="flex items-center gap-3">
          <Boton onClick={cambiarClave}>Actualizar contraseña</Boton>
          <Aviso mensaje={msgClave} />
        </div>
      </Seccion>
    </div>
  );
}
