# Design

## Theme

**Strategy**: Restrained — tinted neutrals warm (off-white base) + azul profundo como primario + verde salvia como acento. El color sirve al contenido clínico, nunca compite con él.

**Mode**: Light por defecto (consultorio con luz natural o de oficina). Dark mode disponible para uso nocturno.

**Scene sentence**: Psicólogo en su consultorio, monitor lateral, sesión activa con un paciente. Luz de oficina cálida. La pantalla debe desaparecer en la periferia.

## Color Palette

```
Background    #F4F1EC   oklch(94% 0.012 80)   off-white cálido, base de toda la UI
Surface       #FBF9F4   oklch(97% 0.008 80)   cards, popovers, modales
Surface soft  #EFEBE3   oklch(91% 0.014 80)   inputs, estados secundarios
Line          #E5DFD3   oklch(87% 0.014 80)   bordes, separadores
Line strong   #D6CFBF   oklch(83% 0.017 80)   énfasis de borde

Ink 1         #1B2A2E   oklch(17% 0.024 210)  texto principal clínico
Ink 2         #3A4A50   oklch(30% 0.024 210)  texto secundario
Ink 3         #6B7A7E   oklch(50% 0.018 210)  placeholders, labels
Ink 4         #9AA5A8   oklch(66% 0.012 210)  texto deshabilitado

Primary       #0F2A4A   oklch(18% 0.058 240)  azul profundo — CTA principal, nav activo
Primary soft  #1E4070   oklch(27% 0.070 240)  hover de primary
Sage          #7C9885   oklch(62% 0.048 155)  acento verde — estados ok, confirmación
Sage soft     #A8BDA9   oklch(75% 0.032 155)  sage desaturado
Sage bg       #E4ECDF   oklch(92% 0.024 155)  fondo de tags sage

Terracotta    #C25C4F   oklch(50% 0.120 25)   acciones destructivas secundarias
Amber         #D4A574   oklch(71% 0.090 65)   énfasis cálido, detalles premium
Gold          #E0B96B   oklch(78% 0.095 75)   indicadores de estado especial

Ok            #4F7F5A   oklch(52% 0.080 155)  éxito, activo
Warn          #B8843A   oklch(60% 0.110 65)   advertencia
Danger        #B0463A   oklch(44% 0.130 25)   error, destructivo
Info          #2E5E8A   oklch(40% 0.090 250)  informativo
```

## Typography

**Scale base**: 14px / 1.5 line-height (cuerpo clínico compacto)

| Role | Font | Size | Weight | Notes |
|------|------|------|--------|-------|
| Display / page title | Instrument Serif | 38px | 400 italic | Headings de página, identidad |
| Heading section | Geist | 16px | 600 | Secciones dentro de página |
| Body / label | Geist | 14px | 400–500 | Todo el texto clínico |
| Caption / meta | Geist | 12px | 400 | Fechas, IDs, metadatos |
| Code / mono | Geist Mono | 12–13px | 400–500 | Números tabulares, IDs, timestamps |
| Tag / badge | Geist Mono | 10.5px | 500 uppercase | Tags de estado, etiquetas |

**Features activos**: `ss01`, `cv11` en sans; `tnum`, `zero` en mono.

**Line length cap**: 65–75ch para texto de notas clínicas y párrafos.

**Hierarchy ratio**: ≥1.25 entre niveles. No usar escala plana (todo 14px de distinto peso).

## Spacing & Layout

**Base unit**: 4px. Escala práctica: 4, 8, 12, 16, 18, 24, 32, 48.

**Border radius**: 10px (lg), 8px (md), 6px (sm) — `--radius: 0.625rem`.

**Card padding**: 18px estándar, 16px en variantes compactas (ej. `.psy-ai-card`).

**Layout**: App shell con sidebar fija, contenido scrollable. Sin contenedores centrados innecesarios. Las páginas de alta densidad (Pacientes, Sesiones) usan grillas fraccionarias (`psy-grid-split`). Nada de cards idénticas en grilla — las secciones tienen jerarquía visual propia.

## Components

**Cards** (`.psy-card`): `background: surface`, `border: 1px line`, `radius: 10px`, `padding: 18px`. Sin sombras decorativas. Solo sombra cuando hay elevación real (modal, popover).

**Tags / badges** (`.psy-tag`): Geist Mono 10.5px, uppercase, pill shape. Variantes: `sage` (ok), `amber` (warn), `danger` (error), `info`, `dark` (neutral énfasis alto).

**Page titles** (`.psy-page-title`): Instrument Serif 38px italic. Solo para el H1 de cada página.

**AI cards** (`.psy-ai-card`): fondo con gradiente sage/primary muy sutil + borde sage + acento lateral izquierdo de 2px. Para distinguir contenido generado por IA.

**Buttons**: Primary (`bg-primary text-primary-foreground`), Secondary (`bg-secondary`), Outline (`border + bg-transparent`), Destructive (`bg-danger`). Sin gradientes en botones.

**Forms**: Inputs con border `line`, focus ring `sage`. Labels explícitas siempre. Error states con `danger` + mensaje de texto (nunca solo color).

**Calendar** (FullCalendar): skin `psy-calendar-wrap` — headers en Geist Mono uppercase, slots de 40px, eventos con `border-left` de 3px (excepción documentada: indica tipo de cita, no decoración).

## Motion

**Regla**: Mínimo. La UI está activa durante sesiones clínicas — las animaciones distraen.

- Solo `transform` y `opacity`. Nunca layout properties.
- Easing: `ease-out-quart` o `ease-out-expo`. Sin bounce, sin elastic.
- Duración: máx 200ms para micro-transiciones de UI. Sin animaciones de entrada elaboradas.
- `prefers-reduced-motion`: desactivar toda animación no esencial.
- Excepción: `.psy-live-dot` (indicador de sesión activa, 2s pulse sutil) y `.psy-ai-spark` (spinner AI, solo cuando procesa).

## Responsive

**Breakpoints Tailwind estándar**: sm 640px, md 768px, lg 1024px, xl 1280px.

**Columnas fraccionarias** (`.psy-grid-split-*`): 1 columna en mobile → 2 columnas fraccionarias en md+. Ratios distintos por contexto (1.6:1 para detalle+resumen, 1:1.5 para RIPS, etc.).

**Tab bars**: scroll horizontal en mobile con `psy-tabs-wrap`. Sin truncamiento de labels clínicas.

**Sidebar**: colapsa en mobile. El contenido clínico tiene prioridad de espacio en pantallas pequeñas.
