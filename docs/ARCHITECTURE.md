# ARCHITECTURE.md — Registro de decisiones (ADR-lite)

> **Regla de mantenimiento autónomo:** cada decisión técnica nueva o cambio de decisión debe agregarse aquí en el MISMO trabajo que la produce (contexto → decisión → consecuencias → quién decidió). Ver [`AGENTS.md`](../AGENTS.md) §4.

| ID | Fecha | Decisión | Estado |
|---|---|---|---|
| D1 | 07-nov ~00:30 | Stack: React (Vite) + FastAPI + SQLite | Vigente |
| D2 | 07-nov ~00:30 | BD: SQLite (PostgreSQL solo producción) | Vigente |
| D7 | 07-nov ~01:00 | **100% local en PC del líder; VM del evento descartada** | Vigente (v2) |
| D10 | 07-nov ~01:00 | Blue Prism manual + híbrido (worker Python) | Vigente |
| D9 | 07-nov ~00:30 | Demo con IA generativa (Claude vs Gemini por decidir) | Pendiente elección |

| D11 | 07-nov ~02:00 | Esquema SQLite normalizado con versionado por lote (9 tablas) | Vigente |
---

## ADR-001 — Stack React + FastAPI + SQLite (D1, D2)

- **Contexto:** 16 h de desafío, WCAG 2.1 AA es rúbrica, equipo con Python validado, un solo PC.
- **Decisión:** frontend React con Vite; backend FastAPI; SQLite como BD. FastAPI sirve el build estático (`dist/`) → un solo proceso.
- **Consecuencias:** control total del HTML para accesibilidad; sin ORM (sqlite3+pandas) para velocidad; PostgreSQL queda documentado como path de producción.
- **Decidió:** Líder (elección C sobre recomendación A del agente) — registrado 07-nov ~00:30.

## ADR-002 — 100% local, VM descartada (D7 v2)

- **Contexto:** el doc. oficial ofrecía VM por equipo con Blue Prism; el equipo verificó acceso.
- **Decisión:** descartar la VM completamente. Todo (Blue Prism, backend, frontend, BD, datos) corre en el PC del líder.
- **Consecuencias:** elimina el riesgo/intiempo de deploy remoto y sincronización; simplifica carpetas del bot (rutas locales directas); el "cómo escaló a todos los institutos" del pitch se responde con la lámina de arquitectura (instalación por sede = mismo paquete).
- **Decidió:** Líder — 07-nov ~01:00.

## ADR-003 — Blue Prism manual + híbrido (D10)

- **Contexto:** Blue Prism Studio es una app de escritorio (WPF), no automatizable vía MCP (no existe server MCP oficial) ni Playwright (solo navegadores). La rúbrica exige "Blue Prism en el centro, aporte visible".
- **Decisión:** proceso pequeño en Studio (~12–15 stages, construido a mano por Dev A con [`bot/BOT_BUILD_GUIDE.md`](../bot/BOT_BUILD_GUIDE.md)) que orquesta: monitor de carpeta → mover → ejecutar `bot/worker.py` (CLI Python: ingesta, validación, deltas, publicación) → leer resultado → clasificar salida. Lógica pesada testada en Python, no en Code stages C# (no verificables localmente).
- **Consecuencias:** worker 100% testeable contra datos reales; Studio mínima y demostrable; rechazos (`Rejected_Records_Report.xlsx`) y lotes con ID generados por el worker; riesgo residual: config de "Start Process" en Studio — mitigado con guía exacta.
- **Decidió:** Líder con recomendación del agente — 07-nov ~01:00.

## ADR-004 — Metodología de ejecución vía issues (ai-sdlc + workers IA)

- **Contexto:** el repo tiene pipeline ai-sdlc operativo (contract `.ai-sdlc.yaml`, nivel shadow) y el líder usa workers locales con IA (opencode, Gemini CLI).
- **Decisión:** la planificación vive en GitHub Issues: épicas (label `epic`, skip-label del pipeline) + subtareas conceptuales. Una subtarea se ejecuta cuando recibe label `ready-to-implement` → la toma ai-sdlc o un worker local sobre branch `feat/issue-<n>`, siguiendo AGENTS.md §4 (docs) y abriendo PR.
- **Consecuencias:** trazabilidad total decisión→issue→PR→commit; el pipeline (shadow) reporta sin mutar hasta que el líder suba el nivel; todo lo técnico pasa por issues, nada ad-hoc.
- **Decidió:** Líder — 07-nov ~01:00.

## ADR-005 — Desacoplamiento estricto del repo

- **Contexto:** avance rápido con 3 personas + agentes paralelos; riesgo de acoplamiento.
- **Decisión:** módulos independientes y ejecutables por separado: `backend/` sin frontend · `frontend/` solo consume API (mock-able) · `bot/worker.py` CLI autónomo sin backend · `tools/` sin dependencias del MVP. Interfaces: SQLite (esquema compartido) y HTTP JSON.
- **Consecuencias:** trabajo paralelo sin conflictos; pruebas por módulo; el contrato de datos (esquema SQLite + esquema JSON de worker) es la única dependencia cruzada y vive documentado.
- **Decidió:** Líder — 07-nov ~01:00.

---
## ADR-006 — Esquema SQLite normalizado con versionado por lote (D11)

 - **Contexto:** El worker (#11) ingiere Excel de contratos y parámetros, valida, calcula deltas y publica a BD. Necesita trazabilidad completa: saber qué lote originó cada fila, poder re-procesar sin duplicados, y consultar KPIs/plan-vs-real por lote (#20). El esquema debe crearse desde BD vacía sin ALTER manual.
 - **Decisión:** 9 tablas normalizadas con `lote_id` en todas las tablas de datos:
   - `lotes`: control de versionado (id, timestamp, duración, conteos válidos/rechazados, hash archivo)
   - `institutos`: catálogo (codigo_it, sigla, nombre, zona)
   - `contratos`: datos de personal (PK compuesta evita duplicados: PersonaId+IT+Periodo+lote_id)
   - `parametros_distribucion`: NAS/Directo/Indirecto por tramo/cargo/especialidad
   - `parametros_grupal`: PctGrupal, NPacientes, AteSemDirGrupal por cargo/especialidad
   - `asignaciones`: horas especiales (Líder, Tutor, etc.) por cargo/especialidad/instituto
   - `planes`: resultado del motor de cálculo (PlanAteDir_m, PlanAteInd_m, etc.)
   - `rechazados`: filas con error (fila_original, datos_json, motivo, severidad)
   - `sic_real`: atenciones ejecutadas (directas, indirectas, grupales)
   - Índices en lote_id, persona_id+periodo, it+periodo para queries #20
 - **Consecuencias:** Trazabilidad 100% por lote; re-procesamiento idempotente (UNIQUE en contratos/planes/sic_real); queries KPI/plan-vs-real sin JOIN imposibles; compatible con worker CLI y FastAPI.
 - **Decidió:** Agente IA (opencode) con validación del Líder — 07-nov ~02:00.

---

*(Nuevas decisiones se agregan como ADR-007, ADR-008… con fecha y quién decidió.)*

*(Nuevas decisiones se agregan como ADR-006, ADR-007… con fecha y quién decidió.)*
