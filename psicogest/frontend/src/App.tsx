import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";

const LoginPage = lazy(() => import("@/pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const PatientsPage = lazy(() => import("@/pages/patients/PatientsPage").then((m) => ({ default: m.PatientsPage })));
const PatientDetailPage = lazy(() => import("@/pages/patients/PatientDetailPage").then((m) => ({ default: m.PatientDetailPage })));
const AgendaPage = lazy(() => import("@/pages/agenda/AgendaPage").then((m) => ({ default: m.AgendaPage })));
const SessionsPage = lazy(() => import("@/pages/sessions/SessionsPage").then((m) => ({ default: m.SessionsPage })));
const RipsPage = lazy(() => import("@/pages/rips/RipsPage").then((m) => ({ default: m.RipsPage })));
const InvoicesPage = lazy(() => import("@/pages/invoices/InvoicesPage").then((m) => ({ default: m.InvoicesPage })));
const InvoiceBulkPage = lazy(() => import("@/pages/invoices/InvoiceBulkPage").then((m) => ({ default: m.InvoiceBulkPage })));
const CajaPage = lazy(() => import("@/pages/caja/CajaPage").then((m) => ({ default: m.CajaPage })));
const CarteraPage = lazy(() => import("@/pages/cartera/CarteraPage").then((m) => ({ default: m.CarteraPage })));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const ReportsPage = lazy(() => import("@/pages/reports/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const BookingPage = lazy(() => import("@/pages/booking/BookingPage").then((m) => ({ default: m.BookingPage })));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="text-[#1E3A5F] text-sm">Cargando...</div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/book/:slug" element={<BookingPage />} />

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

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
