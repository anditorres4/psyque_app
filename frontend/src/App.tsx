import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PatientsPage } from "@/pages/patients/PatientsPage";
import { PatientDetailPage } from "@/pages/patients/PatientDetailPage";
import { AgendaPage } from "@/pages/agenda/AgendaPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-[#1E3A5F] text-sm">Cargando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Rutas protegidas — requieren autenticación */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/sessions" element={<div className="p-8"><h1 className="text-2xl font-bold text-[#1E3A5F]">Sesiones activas</h1><p className="text-muted-foreground mt-2">Sprint 5</p></div>} />
        <Route path="/rips" element={<div className="p-8"><h1 className="text-2xl font-bold text-[#1E3A5F]">RIPS</h1><p className="text-muted-foreground mt-2">Sprint 6</p></div>} />
        <Route path="/settings" element={<div className="p-8"><h1 className="text-2xl font-bold text-[#1E3A5F]">Configuración</h1><p className="text-muted-foreground mt-2">Sprint 7</p></div>} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
