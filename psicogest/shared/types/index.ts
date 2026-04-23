// Tipos de documento de identidad Colombia
export type DocType = "CC" | "TI" | "CE" | "PA" | "RC" | "MS";

// Tipo de pagador / vinculación
export type PayerType = "PA" | "CC" | "SS" | "PE" | "SE";

// Sexo biológico para RIPS
export type BiologicalSex = "M" | "F" | "I";

// Estado civil
export type MaritalStatus = "S" | "C" | "U" | "D" | "V" | "SE";

// Zona urbano/rural para RIPS
export type Zone = "U" | "R";

// Tipo de sesión
export type SessionType = "individual" | "couple" | "family" | "followup";

// Modalidad de atención
export type Modality = "presential" | "virtual";

// Estado de la cita
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "noshow";

// Estado de la nota clínica — firmada es INMUTABLE (Res. 1995/1999)
export type SessionStatus = "draft" | "signed";

// Plan SaaS
export type SaaSPlan = "starter" | "pro" | "clinic";

// Códigos CUPS para psicología
export const CUPS_CODES = {
  CONSULTA_PSICOLOGIA: "890201",
  PSICOTERAPIA_INDIVIDUAL: "903404",
  PSICOTERAPIA_GRUPAL: "903405",
} as const;
