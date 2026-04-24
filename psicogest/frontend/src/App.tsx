import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PatientsPage } from "@/pages/patients/PatientsPage";
import { PatientDetailPage } from "@/pages/patients/PatientDetailPage";
import { AgendaPage } from "@/pages/agenda/AgendaPage";
import { SessionsPage } from "@/pages/sessions/SessionsPage";
import { RipsPage } from "@/pages/rips/RipsPage";
import { InvoicesPage } from "@/pages/invoices/InvoicesPage";
import { InvoiceBulkPage } from "@/pages/invoices/InvoiceBulkPage";
import { CajaPage } from "@/pages/caja/CajaPage";
import { CarteraPage } from "@/pages/cartera/CarteraPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { ReportsPage } from "@/pages/reports/ReportsPage";

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
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Rutas protegidas */}
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
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/sessions/new" element={<SessionsPage />} />
        <Route path="/rips" element={<RipsPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoices/bulk" element={<InvoiceBulkPage />} />
        <Route path="/caja" element={<CajaPage />} />
        <Route path="/cartera" element={<CarteraPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
