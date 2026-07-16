# RIPS v4.3 JSON — Revisión contra Swagger VPS v5.4.9.0

Swagger obtenido: `https://2.25.176.142:9443/swagger/v1/swagger.json` (modo Development, 2026-07-07)

---

## 1. FevRipsApiLocalDTO (wrapper raíz del POST)

| Campo | Schema | Enviamos | Estado |
|-------|--------|----------|--------|
| `rips` | `RipsDTO`, no nullable | `{...}` | ✅ |
| `xmlFevFile` | `string, format:byte, nullable:true` | `null` | ✅ (era `""`, corregido) |
| `additionalProperties` | `false` (estricto) | sin extras | ✅ |

---

## 2. RipsDTO

| Campo | Schema | Enviamos | Estado |
|-------|--------|----------|--------|
| `numDocumentoIdObligado` | string, 3–12 chars, **required** | `tenant.nit` (10 chars) | ✅ |
| `tipoNota` | pattern `^(?:"\|NC\|ND\|NA\|RS)$`, nullable | `"RS"` | ✅ |
| `numNota` | string, max 20 chars, nullable | `"RS{YYYY}{MM}{seq}"` (11 chars) | ✅ |
| `numFactura` | string, 1–20 chars, nullable | omitido cuando null | ✅ |
| `usuarios` | array ≥1, **required** | `[{...}]` | ✅ |

---

## 3. UsuarioDTO

| Campo | Schema | Enviamos | Estado |
|-------|--------|----------|--------|
| `tipoDocumentoIdentificacion` | string, exactly 2 chars, **required** | `patient.doc_type` ("CC") | ✅ |
| `numDocumentoIdentificacion` | string, 2–20 chars, pattern `^[a-zA-Z0-9]+$`, **required** | `patient.doc_number` | ✅ |
| `fechaNacimiento` | string, exactly 10 chars, pattern `YYYY-MM-DD`, **required** | `patient.birth_date.isoformat()` | ✅ |
| `codSexo` | pattern `^(M\|F\|I)$`, **required** | `patient.biological_sex` | ⚠️ validar que el valor es M/F/I |
| `incapacidad` | pattern `^(SI\|NO)$`, **required** | `patient.incapacidad or "NO"` | ✅ |
| `consecutivo` | integer, **required** | `usr_idx + 1` | ✅ |
| `servicios` | `ServiciosDTO`, **required** | `{consultas:[...], ...}` | ✅ |
| `tipoUsuario` | string, exactly 2 chars, nullable | `_PAYER_TIPO.get(payer_type, "12")` | ✅ |
| `codPaisResidencia` | string, exactly 3 chars, nullable | `"170"` | ✅ |
| `codPaisOrigen` | string, exactly 3 chars, nullable | `"170"` | ✅ |
| `codMunicipioResidencia` | string, exactly 5 chars, nullable | `patient.municipality_dane or "11001"` | ✅ |
| `codZonaTerritorialResidencia` | string, exactly 2 chars, nullable | `"01"/"02"` | ✅ |
| `registroSIRAS` | string, nullable | no enviado | ✅ (nullable) |

---

## 4. ServiciosDTO (todos los campos nullable)

| Campo | Schema | Enviamos | Estado |
|-------|--------|----------|--------|
| `consultas` | `ConsultaDTO[]`, nullable | `[{...}]` | ✅ |
| `procedimientos` | `ProcedimientoDTO[]`, nullable | `[]` | ✅ |
| `urgencias` | `UrgenciaDTO[]`, nullable | `[]` | ✅ |
| `hospitalizacion` | `HospitalizacionDTO[]`, nullable (singular) | `[]` | ✅ (plural rechazado) |
| `recienNacidos` | `RecienNacidoDTO[]`, nullable | `[]` | ✅ |
| `medicamentos` | `MedicamentoDTO[]`, nullable | `[]` | ✅ |
| `otrosServicios` | `OtrosServicioDTO[]`, nullable | `[]` | ✅ |

**⚠️ Pendiente confirmar:** ¿Las arrays vacías `[]` causan NullRef al iterar, o el problema es que deben enviarse `null` en lugar de `[]`?

---

## 5. ConsultaDTO

### Campos REQUIRED
| Campo | Schema | Enviamos | Estado |
|-------|--------|----------|--------|
| `codPrestador` | string, exactly 12 chars | `tenant.reps_code` ("101907828401") | ✅ |
| `fechaInicioAtencion` | pattern `YYYY-MM-DD HH:MM`, **required** | `sess.actual_start.strftime("%Y-%m-%d %H:%M")` | ✅ |
| `codServicio` | integer, 100–9999, **required** | `sess.cod_servicio or 706` | ✅ |
| `modalidadGrupoServicioTecSal` | string, exactly 2 chars, **required** | `"01"` | ✅ |
| `grupoServicios` | string, exactly 2 chars, **required** | `"02"` | ✅ |
| `finalidadTecnologiaSalud` | string, exactly 2 chars, **required** | `"44"` | ✅ |
| `causaMotivoAtencion` | string, exactly 2 chars, **required** | `"27"` | ✅ |
| `codDiagnosticoPrincipal` | string, exactly 4 chars (CIE-10), **required** | `"F329"` fallback | ⚠️ TEMPORAL — debe ser CIE-10 real |
| `tipoDiagnosticoPrincipal` | string, exactly 2 chars, **required** | `sess.tipo_dx_principal or "01"` | ✅ |
| `tipoDocumentoIdentificacion` | string, exactly 2 chars, **required** | `patient.doc_type` | ✅ |
| `numDocumentoIdentificacion` | string, 2–20, pattern `^[a-zA-Z0-9]+$`, **required** | `patient.doc_number` | ✅ |
| `vrServicio` | number (double), 0–999999999999, **required** | `sess.session_fee` (int) | ✅ (JSON acepta int como double) |
| `conceptoRecaudo` | string, min 1, **required** | `"05"` | ✅ |
| `valorPagoModerador` | number (double), 0–999999999999, **required** | `0` | ✅ |
| `consecutivo` | integer, 1–999999, **required** | `svc_idx + 1` | ✅ |

### Campos NULLABLE/OPCIONALES
| Campo | Schema | Enviamos | Estado |
|-------|--------|----------|--------|
| `codConsulta` | string, exactly 6 chars, nullable | `sess.cups_code` ("890403") | ✅ |
| `numAutorizacion` | string, 0–30, nullable | omitido si null | ✅ |
| `codDiagnosticoPrincipalCIE11` | string, 0–256, nullable | `sess.diagnosis_cie11` ("6A05") | ✅ |
| `nomCodDiagnosticoPrincipalCIE11` | string, 0–1000, nullable | no enviado | ✅ |
| `codDiagnosticoRelacionado1/2/3` | string, exactly 4 chars, nullable | no enviado | ✅ |
| `numFEVPagoModerador` | string, 0–30, nullable | no enviado | ✅ |
| `codigoVIDA` | string, 0–256, nullable | no enviado | ✅ |
| `idMIPRES` | string, 19–25 chars, nullable | **NO ENVIAR** (rechazado por API) | ✅ |

---

## Problemas pendientes

### 🔴 CIE-10 (bloqueante)
`codDiagnosticoPrincipal` requiere CIE-10 (4 chars, ej. "F329"). La sesión solo guarda `diagnosis_cie11`.
- **Hoy:** fallback a "F329" — sirve para probar flujo completo
- **Sprint siguiente:** agregar campo `diagnosis_cie10 VARCHAR(4)` a la tabla `sessions` + UI

### ⚠️ Arrays vacíos en servicios
Aún sin confirmar si `[]` vs `null` importa para los arrays no usados (procedimientos, urgencias, etc.).
Si el NullRef persiste después de los fixes de hoy, probar enviando `null` en lugar de `[]`.

### ⚠️ codSexo del paciente
El schema espera `^(M|F|I)$`. Si `patient.biological_sex` tiene otro valor, falla.
Validar que los valores en DB son solo "M", "F", o "I".

---

## Pendiente validar del Swagger
- `ProcedimientoDTO`, `UrgenciaDTO`, `HospitalizacionDTO` schemas (no relevantes para psicología)
- `ResultadoProcesoFevRips` schema — respuesta exitosa con CUV
