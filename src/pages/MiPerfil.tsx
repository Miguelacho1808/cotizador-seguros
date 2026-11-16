import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { telefonoWhatsApp } from "../lib/telefono";
import Avatar from "../components/Avatar";
import { Aviso, Boton, Campo, Seccion, inputCls, type Mensaje } from "../components/ui";

const TIPOS = ["image/png", "image/jpeg", "image/webp"];

const normalizarTelefono = telefonoWhatsApp;
const mostrarTelefono = (d: string) => (d ? `+${d}` : "");

function ClaveInput({ valor, onCambio }: { valor: string; onCambio: (v: string) => void }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <input
        type={ver ? "text" : "password"}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        autoComplete="new-password"
        className={`${inputCls} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVer(!ver)}
        aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-100"
      >
        {ver ? "🙈" : "👁"}
      </button>
    </div>
  );
}

export default function MiPerfil() {
  const { perfil, session, actualizarPerfil } = useAuth();
  const fotoRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState<{
    nombre: string;
    apellido: string;
    username: string;
    telefono: string;
    whatsapp: string;
  } | null>(null);
  const [msgDatos, setMsgDatos] = useState<Mensaje | null>(null);
  const [msgContacto, setMsgContacto] = useState<Mensaje | null>(null);
  const [msgFoto, setMsgFoto] = useState<Mensaje | null>(null);
  const [msgEmail, setMsgEmail] = useState<Mensaje | null>(null);
  const [msgClave, setMsgClave] = useState<Mensaje | null>(null);
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState({ actual: "", nueva: "", repetir: "" });

  useEffect(() => {
    if (!perfil) return;
    setEmail(session?.user.email ?? "");
    supabase
      .from("perfiles")
      .select("nombre,apellido,username,telefono,whatsapp")
      .eq("id", perfil.id)
      .single()
      .then(({ data, error }) => {
        if (error) setMsgDatos({ tipo: "error", texto: error.message });
        else {
          const r = data as Record<string, string | null>;
          setF({
            nombre: r.nombre ?? "",
            apellido: r.apellido ?? "",
            username: r.username ?? "",
            telefono: mostrarTelefono(r.telefono ?? "") || "",
            whatsapp: mostrarTelefono(r.whatsapp ?? ""),
          });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  if (!perfil || !f) return <div>{msgDatos ? <Aviso mensaje={msgDatos} /> : <p className="text-zinc-400">Cargando…</p>}</div>;

  const nombreCompleto = [f.nombre, f.apellido].filter(Boolean).join(" ") || "Usuario";

  const guardarDatos = async () => {
    setMsgDatos(null);
    if (!f.nombre.trim()) {
      setMsgDatos({ tipo: "error", texto: "El nombre es obligatorio." });
      return;
    }
    const usr = f.username.trim().replace(/^@/, "");
    if (usr && !/^[A-Za-z0-9._-]{3,}$/.test(usr)) {
      setMsgDatos({ tipo: "error", texto: "Username: mínimo 3 caracteres; solo letras, números, puntos y guiones." });
      return;
    }
    const r = await supabase
      .from("perfiles")
      .update({ nombre: f.nombre.trim(), apellido: f.apellido.trim(), username: usr || null })
      .eq("id", perfil.id);
    if (r.error) {
      setMsgDatos({
        tipo: "error",
        texto: r.error.code === "23505" ? "Ese username ya está en uso." : r.error.message,
      });
    } else {
      actualizarPerfil({ nombre: f.nombre.trim(), apellido: f.apellido.trim(), username: usr || null });
      setF({ ...f, username: usr });
      setMsgDatos({ tipo: "ok", texto: "Datos guardados." });
    }
  };

  const guardarContacto = async () => {
    setMsgContacto(null);
    const tel = normalizarTelefono(f.telefono);
    const wa = normalizarTelefono(f.whatsapp);
    for (const [valor, nombre] of [
      [tel, "teléfono"],
      [wa, "WhatsApp"],
    ] as const) {
      if (valor && (valor.length < 10 || valor.length > 15)) {
        setMsgContacto({ tipo: "error", texto: `El ${nombre} debe incluir el código de país, por ejemplo +58 414 123 4567.` });
        return;
      }
    }
    const r = await supabase
      .from("perfiles")
      .update({ telefono: tel || null, whatsapp: wa || null })
      .eq("id", perfil.id);
    if (r.error) setMsgContacto({ tipo: "error", texto: r.error.message });
    else {
      setF({ ...f, telefono: mostrarTelefono(tel), whatsapp: mostrarTelefono(wa) });
      setMsgContacto({ tipo: "ok", texto: "Contacto guardado." });
    }
  };

  const cambiarFoto = async (archivo: File) => {
    setMsgFoto(null);
    if (!TIPOS.includes(archivo.type)) {
      setMsgFoto({ tipo: "error", texto: "Usa una imagen PNG, JPG o WEBP." });
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      setMsgFoto({ tipo: "error", texto: "La imagen pesa más de 2 MB." });
      return;
    }
    const ext = archivo.type === "image/jpeg" ? "jpg" : archivo.type === "image/webp" ? "webp" : "png";
    const ruta = `${perfil.id}/${Date.now()}.${ext}`;
    const subida = await supabase.storage.from("avatares").upload(ruta, archivo, { contentType: archivo.type });
    if (subida.error) {
      setMsgFoto({ tipo: "error", texto: subida.error.message });
      return;
    }
    const url = supabase.storage.from("avatares").getPublicUrl(ruta).data.publicUrl;
    const r = await supabase.from("perfiles").update({ avatar_url: url }).eq("id", perfil.id);
    if (r.error) {
      setMsgFoto({ tipo: "error", texto: r.error.message });
      return;
    }
    const anterior = perfil.avatar_url?.split("/avatares/")[1];
    if (anterior) void supabase.storage.from("avatares").remove([decodeURIComponent(anterior)]);
    actualizarPerfil({ avatar_url: url });
    setMsgFoto({ tipo: "ok", texto: "Foto actualizada." });
  };

  const cambiarEmail = async () => {
    setMsgEmail(null);
    const nuevo = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(nuevo)) {
      setMsgEmail({ tipo: "error", texto: "Escribe un correo válido." });
      return;
    }
    if (nuevo === session?.user.email) {
      setMsgEmail({ tipo: "error", texto: "Ese ya es tu correo actual." });
      return;
    }
    const r = await supabase.auth.updateUser({ email: nuevo });
    setMsgEmail(
      r.error
        ? { tipo: "error", texto: r.error.message }
        : { tipo: "ok", texto: "Te enviamos un enlace de confirmación al correo nuevo. El cambio se aplica al confirmarlo." },
    );
  };

  const cambiarClave = async () => {
    setMsgClave(null);
    if (!clave.actual) {
      setMsgClave({ tipo: "error", texto: "Escribe tu contraseña actual." });
      return;
    }
    if (clave.nueva.length < 8) {
      setMsgClave({ tipo: "error", texto: "La nueva contraseña debe tener al menos 8 caracteres." });
      return;
    }
    if (clave.nueva !== clave.repetir) {
      setMsgClave({ tipo: "error", texto: "Las contraseñas no coinciden." });
      return;
    }
    const verificar = await supabase.auth.signInWithPassword({ email: session?.user.email ?? "", password: clave.actual });
    if (verificar.error) {
      setMsgClave({ tipo: "error", texto: "La contraseña actual no es correcta." });
      return;
    }
    const r = await supabase.auth.updateUser({ password: clave.nueva });
    if (r.error) setMsgClave({ tipo: "error", texto: r.error.message });
    else {
      setClave({ actual: "", nueva: "", repetir: "" });
      setMsgClave({ tipo: "ok", texto: "Contraseña actualizada." });
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mi perfil</h1>
        <p className="text-sm text-zinc-400">Información de tu cuenta, foto y seguridad.</p>
      </div>

      <Seccion titulo="Datos de la cuenta">
        <div className="flex items-center gap-4">
          <button
            onClick={() => fotoRef.current?.click()}
            aria-label="Cambiar foto"
            className="relative rounded-full"
          >
            <Avatar url={perfil.avatar_url} nombre={nombreCompleto} tam="h-20 w-20 text-2xl" />
            <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800 text-xs">
              📷
            </span>
          </button>
          <input
            ref={fotoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const a = e.target.files?.[0];
              e.target.value = "";
              if (a) void cambiarFoto(a);
            }}
          />
          <div className="min-w-0">
            <p className="truncate text-xl font-bold">{nombreCompleto}</p>
            <p className="truncate text-sm text-zinc-400">{session?.user.email}</p>
            <span className="mt-1 inline-block rounded-full bg-zinc-700 px-2 py-0.5 text-xs">
              {perfil.rol === "admin" ? "Administrador" : "Asesor"}
            </span>
            <p className="mt-1 text-xs text-zinc-500">Haz clic sobre tu foto para cambiarla.</p>
          </div>
        </div>
        <Aviso mensaje={msgFoto} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nombre">
            <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} className={inputCls} />
          </Campo>
          <Campo etiqueta="Apellido">
            <input value={f.apellido} onChange={(e) => setF({ ...f, apellido: e.target.value })} className={inputCls} />
          </Campo>
          <div className="text-sm">
            <span className="text-zinc-400">Email</span>
            <div className="mt-1 flex gap-2">
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              <Boton variante="secundario" onClick={cambiarEmail}>
                Cambiar
              </Boton>
            </div>
          </div>
          <Campo etiqueta="Rol">
            <input
              value={perfil.rol === "admin" ? "Administrador" : "Asesor"}
              readOnly
              className={`${inputCls} cursor-not-allowed opacity-70`}
            />
          </Campo>
        </div>
        <Aviso mensaje={msgEmail} />
        <div className="flex flex-wrap items-center gap-3">
          <Boton onClick={guardarDatos}>Guardar datos</Boton>
          <Aviso mensaje={msgDatos} />
        </div>
      </Seccion>

      <Seccion
        titulo="Contacto y WhatsApp"
        ayuda="Tu número de WhatsApp se usa en las cotizaciones compartidas para que el cliente te contacte directamente."
      >
        <Campo etiqueta="@ Username">
          <input
            value={f.username}
            onChange={(e) => setF({ ...f, username: e.target.value })}
            placeholder="tu.usuario"
            className={inputCls}
          />
        </Campo>
        <p className="-mt-1 text-xs text-zinc-500">Mínimo 3 caracteres. Solo letras, números, puntos, guiones. Se guarda con "Guardar datos".</p>
        <Campo etiqueta="Teléfono">
          <input
            value={f.telefono}
            inputMode="tel"
            placeholder="+58 414 123 4567"
            onChange={(e) => setF({ ...f, telefono: e.target.value })}
            className={inputCls}
          />
        </Campo>
        <Campo etiqueta="WhatsApp">
          <input
            value={f.whatsapp}
            inputMode="tel"
            placeholder="+58 414 123 4567"
            onChange={(e) => setF({ ...f, whatsapp: e.target.value })}
            className={inputCls}
          />
        </Campo>
        <p className="-mt-1 text-xs text-zinc-500">Si está vacío, se usará tu teléfono.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Boton onClick={guardarContacto}>Guardar contacto</Boton>
          <Aviso mensaje={msgContacto} />
        </div>
      </Seccion>

      <Seccion titulo="Cambiar contraseña">
        <Campo etiqueta="Contraseña actual">
          <ClaveInput valor={clave.actual} onCambio={(v) => setClave({ ...clave, actual: v })} />
        </Campo>
        <Campo etiqueta="Nueva contraseña">
          <ClaveInput valor={clave.nueva} onCambio={(v) => setClave({ ...clave, nueva: v })} />
        </Campo>
        <Campo etiqueta="Confirmar contraseña">
          <ClaveInput valor={clave.repetir} onCambio={(v) => setClave({ ...clave, repetir: v })} />
        </Campo>
        <div className="flex flex-wrap items-center gap-3">
          <Boton onClick={cambiarClave}>Actualizar contraseña</Boton>
          <Aviso mensaje={msgClave} />
        </div>
      </Seccion>
    </div>
  );
}
