/**
 * API barrel — assembles all domain sub-objects into the unified `api` object
 * and re-exports every type so that `import { ... } from "@/lib/api"` keeps working.
 */

// --- Client primitives -------------------------------------------------------
export { API_BASE, getAuthHeader, request, downloadBlob, publicRequest, ApiError } from "./client";

// --- Domain types ------------------------------------------------------------
export type {
  PatientSummary,
  PatientDetail,
  PaginatedPatients,
  HistoryExportOptions,
  PatientCreatePayload,
} from "./patients";

export type {
  SessionType,
  Modality,
  AppointmentStatus,
  CancelledBy,
  AppointmentSummary,
  AppointmentDetail,
  AppointmentSeriesCreate,
  AppointmentSeriesOut,
  PaginatedAppointments,
  AppointmentCreatePayload,
  AppointmentUpdatePayload,
  CancelPayload,
} from "./appointments";

export type {
  SessionStatus,
  SessionSummary,
  SessionDetail,
  TherapeuticGoal,
  TherapeuticGoalCreate,
  PatientTask,
  PatientTaskCreate,
  SessionContext,
  PaginatedSessions,
  SessionCreatePayload,
  SessionUpdatePayload,
  SessionNoteDetail,
} from "./sessions";

export type {
  InvoiceStatus,
  InvoiceSummary,
  InvoiceDetail,
  InvoiceListResponse,
  InvoiceCreatePayload,
  InvoiceBulkPayload,
  InvoiceUpdatePayload,
  CreditDebitNoteCreate,
  CreditDebitNoteOut,
  UnbilledPatientRow,
} from "./invoices";

export type {
  RipsExportSummary,
  RipsSubmitResponse,
  RipsGenerateRequest,
  RipsValidationError,
  RipsValidationWarning,
  RipsValidateResponse,
  RipsGenerationResponse,
} from "./rips";

export type {
  DashboardStats,
  TopDiagnosisItem,
  TopDiagnosesResponse,
} from "./dashboard";

export type {
  TenantProfile,
  TenantProfileUpdate,
  AvailabilityBlock,
  AvailabilityBlockCreate,
  SisproCredentials,
  SisproTestResult,
} from "./profile";

export type {
  RevenueReportItem,
  AttendanceReportItem,
  SessionTypeReportItem,
  NewPatientsReportItem,
  DashboardSummary,
} from "./reports";

export type {
  CashSessionStatus,
  TransactionType,
  IncomeCategory,
  ExpenseCategory,
  PaymentMethod,
  CashSessionSummary,
  CashSessionDetail,
  CashTransactionSummary,
  CashTransactionCreate,
  CashSessionClose,
  CashSessionListResponse,
  CashTransactionListResponse,
} from "./caja";

export type {
  PortfolioType,
  CarteraSummary,
  CarteraPortfolioSummary,
  CarteraPaymentCreate,
} from "./cartera";

export type {
  BookingInfo,
  BookingRequestCreate,
  BookingRequestCreated,
  BookingRequestSummary,
  RegistrationTokenInfo,
  PatientRegistrationBody,
  PatientRegistrationResult,
} from "./booking";

export type {
  TriageUrgency,
  TriageStatus,
  TriageSessionOut,
  TriageListResponse,
} from "./triage";

export type {
  NotificationOut,
  NotificationListResponse,
} from "./notifications";

export type {
  VideoRoomResponse,
  PublicVideoTokenResponse,
} from "./video";

export type {
  GCalStatus,
  GCalAuthUrl,
} from "./calendar";

export type {
  TherapyIndicator,
  TherapyMeasurement,
  TherapyIndicatorWithMeasurements,
  TherapyIndicatorCreate,
  TherapyIndicatorUpdate,
  TherapyMeasurementCreate,
} from "./indicators";

export type {
  Referral,
  ReferralCreate,
} from "./referrals";

export type {
  ClinicalDocument,
} from "./documents";

export type {
  AntecedentesBlock,
  MentalExamBlock,
  ClinicalRecord,
  ClinicalRecordUpsert,
} from "./clinical-record";

export type {
  PortalMe,
  PatientProfileUpdate,
  OnboardingSignedDoc,
  OnboardingStatus,
  PortalAppointment,
  PortalSession,
  PortalInvoice,
} from "./portal";

// --- Domain API sub-objects (imported to assemble api) ----------------------
import { patientsApi } from "./patients";
import { appointmentsApi, appointmentsStatusApi } from "./appointments";
import { sessionsApi, therapeuticGoalsApi, patientTasksApi } from "./sessions";
import { invoicesApi } from "./invoices";
import { ripsApi } from "./rips";
import { dashboardApi } from "./dashboard";
import { profileApi, availabilityApi } from "./profile";
import { reportsApi } from "./reports";
import { cajaApi } from "./caja";
import { carteraApi } from "./cartera";
import { bookingApi, bookingRequestsApi, registrationApi } from "./booking";
import { triageApi } from "./triage";
import { notificationsApi } from "./notifications";
import { videoApi } from "./video";
import { googleCalendarApi } from "./calendar";
import { indicatorsApi } from "./indicators";
import { referralsApi } from "./referrals";
import { documentsApi } from "./documents";
import { clinicalRecordApi } from "./clinical-record";
import { portalApi } from "./portal";
import { request } from "./client";

// --- Assembled api object (identical shape to original api.ts) ---------------
export const api = {
  auth: {
    setupProfile: () => request<{ tenant_id: string; status: string }>("POST", "/auth/setup-profile"),
    setupPatientProfile: () => request<{ role: string; status: string }>("POST", "/auth/setup-patient-profile"),
  },
  patients: patientsApi,
  appointments: appointmentsApi,
  appointments_status: appointmentsStatusApi,
  sessions: sessionsApi,
  therapeuticGoals: therapeuticGoalsApi,
  patientTasks: patientTasksApi,
  invoices: invoicesApi,
  rips: ripsApi,
  dashboard: dashboardApi,
  profile: profileApi,
  availability: availabilityApi,
  reports: reportsApi,
  caja: cajaApi,
  cartera: carteraApi,
  booking: bookingApi,
  bookingRequests: bookingRequestsApi,
  registration: registrationApi,
  triage: triageApi,
  notifications: notificationsApi,
  video: videoApi,
  googleCalendar: googleCalendarApi,
  indicators: indicatorsApi,
  referrals: referralsApi,
  documents: documentsApi,
  clinicalRecord: clinicalRecordApi,
  portal: portalApi,
};
