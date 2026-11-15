import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { configOk } from "./lib/supabase";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Inicio from "./pages/Inicio";
import Aseguradoras from "./pages/Aseguradoras";
import Tarifario from "./pages/Tarifario";
import AseguradoraDetalle from "./pages/AseguradoraDetalle";
import PlanEditor from "./pages/PlanEditor";
import Usuarios from "./pages/Usuarios";
import Configuracion from "./pages/Configuracion";
import Cotizaciones from "./pages/Cotizaciones";
import NuevaCotizacion from "./pages/NuevaCotizacion";
import CotizacionDetalle from "./pages/CotizacionDetalle";
import Compartida from "./pages/Compartida";
import MiPerfil from "./pages/MiPerfil";

function Centro({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center text-zinc-300">
      <div className="max-w-md space-y-4">{children}</div>
    </div>
  );
}

function Protegido() {
  const { session, perfil, loading, signOut } = useAuth();

  if (loading) return <Centro>Cargando…</Centro>;
  if (!session) return <Navigate to="/login" replace />;
  if (!perfil || !perfil.activo) {
    return (
      <Centro>
        <p>Tu cuenta está pendiente de activación por un administrador.</p>
        <button
          onClick={signOut}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
        >
          Cerrar sesión
        </button>
      </Centro>
    );
  }
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export default function App() {
  if (!configOk) {
    return (
      <Centro>
        <p className="font-semibold text-amber-300">Faltan las variables de entorno de Supabase.</p>
        <p className="text-sm text-zinc-400">
          Define VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY y vuelve a desplegar.
        </p>
      </Centro>
    );
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/compartir/:token" element={<Compartida />} />
          <Route element={<Protegido />}>
            <Route path="/" element={<Inicio />} />
            <Route path="/cotizaciones" element={<Cotizaciones />} />
            <Route path="/cotizaciones/nueva" element={<NuevaCotizacion />} />
            <Route path="/cotizaciones/:id" element={<CotizacionDetalle />} />
            <Route path="/perfil" element={<MiPerfil />} />
            <Route path="/aseguradoras" element={<Aseguradoras />} />
            <Route path="/aseguradoras/:id" element={<AseguradoraDetalle />} />
            <Route path="/planes/:id" element={<PlanEditor />} />
            <Route path="/tarifario" element={<Tarifario />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/configuracion" element={<Configuracion />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
