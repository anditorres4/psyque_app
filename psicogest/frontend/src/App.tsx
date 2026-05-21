import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { useBillingStatus } from "@/hooks/useBillingStatus";

const LoginPage = lazy(() => import("@/pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const PatientsPage = lazy(() => import("@/pages/patients/PatientsPage").then((m) => ({ default: m.PatientsPage })));
const PatientDetailPage = lazy(() => import("@/pages/patients/PatientDetailPage").then((m) => ({ default: m.PatientDetailPage })));
const AgendaPage = lazy(() => import("@/pages/agenda/AgendaPage").then((m) => ({ default: m.AgendaPage })));
const SessionsPage = lazy(() => import("@/pages/sessions/SessionsPage").then((m) => ({ default: m.SessionsPage })));
const SessionDocPage = lazy(() => import("@/pages/sessions/SessionDocPage").then((m) => ({ default: m.SessionDocPage })));
const RipsPage = lazy(() => import("@/pages/rips/RipsPage").then((m) => ({ default: m.RipsPage })));
const InvoicesPage = lazy(() => import("@/pages/invoices/InvoicesPage").then((m) => ({ default: m.InvoicesPage })));
const InvoiceBulkPage = lazy(() => import("@/pages/invoices/InvoiceBulkPage").then((m) => ({ default: m.InvoiceBulkPage })));
const CajaPage = lazy(() => import("@/pages/caja/CajaPage").then((m) => ({ default: m.CajaPage })));
const CarteraPage = lazy(() => import("@/pages/cartera/CarteraPage").then((m) => ({ default: m.CarteraPage })));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const ReportsPage = lazy(() => import("@/pages/reports/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const BookingPage = lazy(() => import("@/pages/booking/BookingPage").then((m) => ({ default: m.BookingPage })));
const JoinPage = lazy(() => import("@/pages/JoinPage").then((m) => ({ default: m.JoinPage })));
const NpsPage = lazy(() => import("@/pages/NpsPage").then((m) => ({ default: m.NpsPage })));
const PatientRegistrationPage = lazy(() => import("@/pages/PatientRegistrationPage").then((m) => ({ default: m.PatientRegistrationPage })));
const PatientRegistrationsAdminPage = lazy(() => import("@/pages/patients/PatientRegistrationsAdminPage").then((m) => ({ default: m.PatientRegistrationsAdminPage })));
const CompleteProfilePage = lazy(() => import("@/pages/auth/CompleteProfilePage").then((m) => ({ default: m.CompleteProfilePage })));
const TriagePage = lazy(() => import("@/pages/triage/TriagePage").then((m) => ({ default: m.TriagePage })));
const PatientPortalLayout = lazy(() => import("@/components/layout/PatientPortalLayout").then((m) => ({ default: m.PatientPortalLayout })));
const PortalDashboardPage = lazy(() => import("@/pages/portal/PortalDashboardPage").then((m) => ({ default: m.PortalDashboardPage })));
const PortalAppointmentsPage = lazy(() => import("@/pages/portal/PortalAppointmentsPage").then((m) => ({ default: m.PortalAppointmentsPage })));
const PortalSessionsPage = lazy(() => import("@/pages/portal/PortalSessionsPage").then((m) => ({ default: m.PortalSessionsPage })));
const PortalInvoicesPage = lazy(() => import("@/pages/portal/PortalInvoicesPage").then((m) => ({ default: m.PortalInvoicesPage })));
const PortalOnboardingPage = lazy(() => import("@/pages/portal/PortalOnboardingPage").then((m) => ({ default: m.PortalOnboardingPage })));
const PortalTasksPage = lazy(() => import("@/pages/portal/PortalTasksPage").then((m) => ({ default: m.PortalTasksPage })));
const TerapeutaLoginPage = lazy(() => import("@/pages/auth/TerapeutaLoginPage").then((m) => ({ default: m.TerapeutaLoginPage })));
const PacienteLoginPage = lazy(() => import("@/pages/auth/PacienteLoginPage").then((m) => ({ default: m.PacienteLoginPage })));
const PacienteRegisterPage = lazy(() => import("@/pages/auth/PacienteRegisterPage").then((m) => ({ default: m.PacienteRegisterPage })));
const PlanSelectPage = lazy(() => import("@/pages/billing/PlanSelectPage").then((m) => ({ default: m.PlanSelectPage })));
const BillingSuccessPage = lazy(() => import("@/pages/billing/BillingSuccessPage").then((m) => ({ default: m.BillingSuccessPage })));
const PaywallPage = lazy(() => import("@/pages/billing/PaywallPage").then((m) => ({ default: m.PaywallPage })));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="text-[#1E3A5F] text-sm">Cargando...</div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, tenantReady } = useAuth();
  const { data: billing } = useBillingStatus();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.app_metadata?.role === "patient") return <Navigate to="/portal/dashboard" replace />;
  if (!tenantReady) return <Navigate to="/complete-profile" replace />;

  // Redirect to paywall if subscription expired beyond grace period
  if (billing && billing.subscription_status !== "trial" && billing.days_remaining === 0 && !billing.in_grace_period) {
    return <Navigate to="/paywall" replace />;
  }

  return <>{children}</>;
}

function PatientRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.app_metadata?.role !== "patient") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function HomeRoute() {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (user) {
    if (user.app_metadata?.role === "patient") return <Navigate to="/portal/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  // Not authenticated — serve the static landing page
  window.location.replace("/landing.html");
  return <PageLoader />;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/complete-profile" element={<CompleteProfilePage />} />
        <Route path="/book/:slug" element={<BookingPage />} />
        <Route path="/join/:appointmentId" element={<JoinPage />} />
        <Route path="/nps/:token" element={<NpsPage />} />
        <Route path="/registro/:slug" element={<PatientRegistrationPage />} />

        {/* Differentiated auth routes */}
        <Route path="/login/terapeuta" element={<TerapeutaLoginPage />} />
        <Route path="/login/paciente" element={<PacienteLoginPage />} />
        <Route path="/register/terapeuta" element={<RegisterPage />} />
        <Route path="/register/paciente" element={<PacienteRegisterPage />} />

        {/* Post-registration flow (no subscription guard needed) */}
        <Route path="/select-plan" element={<PlanSelectPage />} />
        <Route path="/billing/success" element={<BillingSuccessPage />} />
        <Route path="/paywall" element={<PaywallPage />} />

        {/* Backward compatibility alias */}
        <Route path="/register" element={<Navigate to="/register/terapeuta" replace />} />

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
          <Route path="/sessions/:sessionId/doc" element={<SessionDocPage />} />
          <Route path="/rips" element={<RipsPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/invoices/bulk" element={<InvoiceBulkPage />} />
          <Route path="/caja" element={<CajaPage />} />
          <Route path="/cartera" element={<CarteraPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/patient-registrations" element={<PatientRegistrationsAdminPage />} />
          <Route path="/triage" element={<TriagePage />} />
        </Route>

        <Route
          element={
            <PatientRoute>
              <PatientPortalLayout />
            </PatientRoute>
          }
        >
          <Route path="/portal/onboarding" element={<PortalOnboardingPage />} />
          <Route path="/portal/dashboard" element={<PortalDashboardPage />} />
          <Route path="/portal/appointments" element={<PortalAppointmentsPage />} />
          <Route path="/portal/sessions" element={<PortalSessionsPage />} />
          <Route path="/portal/invoices" element={<PortalInvoicesPage />} />
          <Route path="/portal/tasks" element={<PortalTasksPage />} />
          <Route path="/portal" element={<Navigate to="/portal/dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
