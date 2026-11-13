import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError("Correo o contraseña incorrectos.");
    setEnviando(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={enviar}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <div>
          <h1 className="text-2xl font-bold">Cotizador de Seguros</h1>
          <p className="text-sm text-zinc-400">Ingresa con tu cuenta de asesor.</p>
        </div>

        <label className="block text-sm">
          <span className="text-zinc-400">Correo</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none focus:border-indigo-400"
          />
        </label>

        <label className="block text-sm">
          <span className="text-zinc-400">Contraseña</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none focus:border-indigo-400"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-zinc-100 px-4 py-2 font-medium text-zinc-900 hover:bg-white disabled:opacity-60"
        >
          {enviando ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
