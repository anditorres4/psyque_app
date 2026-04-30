# Reglas Frontend (React 18 + Vite + Tailwind + shadcn/ui)

## Estado del servidor
- **Siempre React Query** para fetching, mutaciones y caché — nunca `useState` + `useEffect` para datos del servidor
- Invalidar queries relacionadas después de mutaciones exitosas
- Claves de query consistentes: `['patients', psychologistId]`, `['patient', patientId]`

## Componentes
- Componentes de página en `pages/`, componentes reutilizables en `components/`
- Máximo ~200 líneas por componente — extraer sub-componentes si crece
- UI de shadcn/ui como base — no reinventar inputs, modals, selects
- Formularios siempre con React Hook Form + Zod. El schema Zod debe espejear el Pydantic del backend

## Diseño (sistema de salud mental)
- Tailwind tema personalizado: colores suaves, sin rojos intensos fuera de alertas críticas
- Clínico (psicólogo): alta densidad de información, compacto, profesional
- Portal pacientes (planificado): espaciado generoso, texto grande, iconografía clara
- Modo oscuro: considerar para uso clínico prolongado

## TypeScript
- Tipos compartidos en `psicogest/shared/` — no duplicar entre frontend y backend
- Evitar `any`. Si la API retorna tipo desconocido, usar Zod para parsear en el servicio

## Llamadas a API
- Todo en `services/` — nunca fetch directo en componentes o páginas
- Manejar estados de loading/error/empty en UI — no dejar pantallas en blanco

## Roles y acceso
- Verificar rol del usuario (`psychologist` vs `patient`) en rutas protegidas
- Componentes que muestran datos sensibles de pacientes: verificar auth antes de renderizar
