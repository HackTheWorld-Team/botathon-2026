# UI_SPEC.md — Especificación de interfaz del dashboard (fuente de verdad frontend)

> Decidida en sesión de specs con el líder, 07-nov ~02:45 (ver ADR-007 en [`ARCHITECTURE.md`](ARCHITECTURE.md) y fila en [`AI_USAGE_LOG.md`](AI_USAGE_LOG.md)). Cualquier cambio a este documento = nueva decisión registrada. Regla de sesión: **ninguna spec vive solo en la conversación** (AGENTS.md §4.5).

---

## 1. Qué es la solución (scope de la UI)

3 capas: **bot Blue Prism** (ingesta/validación/deltas → BD) · **motor de reglas** (pipeline §4 README → KPIs) · **dashboard React** (esta spec). La puerta de entrada de datos es SOLO el bot (Excel): la UI es **lectura + edición de parámetros**. No hay CRUD de personas, no auth, no edición de contratos (Won't §8).

## 2. Paleta y contraste (WCAG 2.1 AA verificado programáticamente)

| Token | Hex | Rol |
|---|---|---|
| `--white` | `#ffffff` | fondo base |
| `--onyx` | `#121313` | texto, bordes, sombras duras |
| `--pearl-aqua` | `#8fe7de` | tints (fondo `rgba(143,231,222,.16)`), hover, selección |
| `--turquoise` | `#1ecebd` | marca: fills de barras, botón primario (texto onyx encima) |
| `--racing-red` | `#ea2d2d` | SOLO iconos, bordes de alerta, texto ≥18.7px bold |
| `--teal-ink` | `#0a6b63` | derivado AA 6.4:1 — links, focus, estados activos, "superávit" |
| `--red-ink` | `#c62828` | derivado AA 5.6:1 — texto de alerta/déficit a tamaño normal |
| `--amber-ink` | `#9a6700` | derivado AA 4.8:1 — opcional "cerca de meta" (90–100% plan) |
| `--ink-2` | `rgba(18,19,19,.62)` | texto secundario (5.2:1 sobre blanco) |
| `--line` | `rgba(18,19,19,.14)` | bordes sutiles |

**Reglas duras:**
- `--turquoise` PROHIBIDO como texto, link o focus sobre blanco (2:1).
- Focus visible: `outline 3px #0a6b63` + `offset 2px`, en todo lo focusable.
- Alertas nunca solo color: icono pixel + palabra visible ("Déficit −29%") + color.
- Links/activos: siempre `--teal-ink` subrayado (underline + thickness 2px).
- Charts: diferenciar por luminosidad + etiqueta directa + patrón, nunca solo tono (turquoise y pearl-aqua comparten matiz).
- Grises se derivan de onyx por alpha; sin neutros extra.
- **Sin gradientes** (el ramp de 5 stops de la paleta original queda descartado). Máximo: wash sutil blanco→pearl-aqua en header.

## 3. Tipografía (cero pixel en texto)

- Familia única **Roboto** (fallback Verdana) 400/500/700. **Prohibidas fuentes bitmap/pixel en cualquier texto.**
- Base 16px · line-height ≥1.5 · sin justificado · micro-labels 13–14px bold uppercase con alto contraste.
- Números de KPI/tablas: `font-variant-numeric: tabular-nums` (alineación de columnas).
- Jerarquía semántica fija: `h1` marca/página · `h2` vista (título de panel, `tabindex="-1"` para foco) · `h3` tarjeta.

## 4. Lenguaje visual "pixel-zen" (solo geometría, nunca texto)

| Elemento | Regla |
|---|---|
| Bordes | `border-radius: 0` universal |
| Sombras | duras sin blur: offset 3px (inputs/botones), 4px tabs, 6px cards; color onyx |
| Barras KPI/progreso | segmentos cuadrados, gap 4px, estados on/off/alerta (11 segmentos = decenas de %) |
| Iconografía | pixel-art SVG `shape-rendering="crispEdges"`, siempre `aria-hidden="true"` + texto visible adjunto |
| Badges/estados | chips cuadrados, borde 2px, icono + palabra |
| Ritmo | grid 4px (espaciados 8/16/24/32/48) |
| Micro-animación | `transition` con `steps()` (2 frames); `transform` + `box-shadow` solo; **desactivada con `prefers-reduced-motion`** |

**Prohibido:** fuentes bitmap, scanlines, dithering sobre texto, gradientes, blur.

## 5. Arquitectura one-page

**Shell persistente** (nunca desaparece al cambiar de pestaña):
1. Header: marca + navegación por pestañas.
2. **Statusbar del bot** (evidencia viva, Paso 2 demo): estado operativo (icono + "Bot operativo") · último lote (ID + timestamp) · filas procesadas/rechazadas · link a `Rejected_Records_Report.xlsx`.
3. **Filtros globales SIEMPRE visibles** (decisión del líder): instituto · mes · cargo · especialidad. `<select>` nativos con flecha pixel custom, teclado-first, `label` explícito visible.

**5 pestañas:** `Resumen` · `Antes/Después` · `Parámetros` · `Plan vs Real` · `Lotes`.

**Navegación — patrón WAI-ARIA Tabs:** `role="tablist/tab/tabpanel"` · flechas ←/→ · Home/End · `aria-selected` + `aria-controls` · gestión de foco al cambiar panel (foco al `h2` del panel activo) · `Escape` no aplica (sin modales).

**Sin router de librería.** Deep-link hash nativo (~15 líneas):

- Formato: `#/<tab>?instituto=&mes=&cargo=&esp=` — solo tab + los 4 filtros. **Nada de estado transitorio** (el hash es determinista y testeable).
- Cambio de **pestaña** → `history.pushState` (botón atrás camina pestañas); cambio de **filtro** → `replaceState` (sin spamear historial).
- Al cargar: parsear ANTES del primer render → activar tab + filtros → live region `polite` ("Vista Resumen, mayo 2026").
- Hash inválido/ausente → default `#/resumen` + mes actual, silencioso.
- Caso de uso ancla: recovery en demo (R2), ensayos 09:00 con URLs pre-cocinadas por paso, video respaldo 08:30.

**Live regions:** recálculo → `polite` ("KPIs recalculados desde mayo 2026"); errores/validaciones → `assertive` (`role="alert"`).

**Skip link:** "Saltar al contenido principal" — primero en foco de tab.

## 6. Inventario de vistas

| Pestaña | Contenido | Ref |
|---|---|---|
| **Resumen** | 4 cards KPI (% FOJA con meta ≥90%, MG 90% del plan, Plan directo del mes, Horas semanales Dir/Ind/NAS) con barras segmentadas + tabla Plan vs Real por especialidad + alertas | §5 README, demo Paso 1 |
| **Antes/Después** | Comparación versionada por delta (lote A vs B): mayo 42h, nueva contrata, multi-sede — difs por instituto Y profesional, meses pasados congelados | §7 Paso 3 |
| **Parámetros** | Edición sin código: % Dir/Ind/NAS por cargo×tramo · minutos estándar · asignaciones especiales (flag V°B° DMN) · vista previa de impacto → recálculo desde vigencia | §6.2, Paso 4 |
| **Plan vs Real** | Capa SIC: desviación % por especialidad/instituto con badges déficit/superávit/cerca-meta | §5, Paso 4 |
| **Lotes** | Trazabilidad S4: historial de lotes (ID, timestamp, duración, filas OK/rechazadas) + descarga de Rejected_Records | §6.1 |

## 7. Checklist WCAG 2.1 AA (auditables — mitiga R3)

- [ ] Contraste ≥4.5:1 texto normal, ≥3:1 no-texto (verificado por script en el PR del shell).
- [ ] Navegación 100% teclado; foco SIEMPRE visible (outline teal-ink 3px).
- [ ] Nunca solo color: icono + texto en todo estado.
- [ ] HTML semántico: header/nav/main/footer, `h1`–`h3` sin saltos, `caption` en tablas, `th scope`.
- [ ] `aria-label` en controles icon-only; `aria-current="page"` en tab activa.
- [ ] Live regions polite/assertive según criticidad.
- [ ] `prefers-reduced-motion` respetado.
- [ ] Lector de pantalla probado (NVDA/Firefox o Orca) — pasada dedicada 07:00, issue de auditoría final.
- [ ] Texto sin justificar; base 16px; targets táctiles ≥44px donde aplique.

## 8. Mapeo a issues

Vista/issue: shell → issue nuevo (B: separado de #23) · tokens → enmienda a #23 · Resumen → #24 · filtros → #25 (en shell) · Parámetros → #26 · Plan vs Real → #27 (scope ajustado) · Antes/Después → issue nuevo (split de #27) · Lotes → issue nuevo · auditoría WCAG → issue nuevo · login #22 → cerrado (contradice Won't §8).

---
*Cualquier vista nueva o cambio de regla = editar este doc + ADR + fila de log en el mismo trabajo.*
