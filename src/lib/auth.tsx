import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Perfil = {
  id: string;
  nombre: string;
  apellido: string;
  username: string | null;
  rol: "admin" | "asesor";
  activo: boolean;
  avatar_url: string | null;
};

type AuthCtx = {
  session: Session | null;
  perfil: Perfil | null;
  loading: boolean;
  signOut: () => Promise<void>;
  actualizarPerfil: (parcial: Partial<Perfil>) => void;
};

const Ctx = createContext<AuthCtx>({
  session: null,
  perfil: null,
  loading: true,
  signOut: async () => {},
  actualizarPerfil: () => {},
});

export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSession(s);
      if (!s) {
        setPerfil(null);
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let cancelado = false;
    setLoading(true);
    supabase
      .from("perfiles")
      .select("id,nombre,apellido,username,rol,activo,avatar_url")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelado) return;
        setPerfil((data as Perfil | null) ?? null);
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [userId]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const actualizarPerfil = (parcial: Partial<Perfil>) => setPerfil((p) => (p ? { ...p, ...parcial } : p));

  return <Ctx.Provider value={{ session, perfil, loading, signOut, actualizarPerfil }}>{children}</Ctx.Provider>;
}
