# ARCHITECTURE.md — Registro de decisiones (ADR-lite)

> **Regla de mantenimiento autónomo:** cada decisión técnica nueva o cambio de decisión debe agregarse aquí en el MISMO trabajo que la produce (contexto → decisión → consecuencias → quién decidió). Ver [`AGENTS.md`](../AGENTS.md) §4.

| ID | Fecha | Decisión | Estado |
|---|---|---|---|
| D1 | 07-nov ~00:30 | Stack: React (Vite) + FastAPI + SQLite | Vigente |
| D2 | 07-nov ~00:30 | BD: SQLite (PostgreSQL solo producción) | Vigente |
| D3 | 07-nov ~00:30 | PDF oficial + set de práctica en repo | Vigente |
| D4 | 07-nov ~05:00 | Quién presenta / opera el bot (ensayo 09:00) | Vigente |
| D5 | 07-nov ~04:00 | Perfil SIC sintético: balanceado, seed 42 | Vigente |
| D6 | 07-nov ~07:00 | Vacantes (C1) fuera del guion (roadmap pitch) | Vigente |
| D7 | 07-nov ~01:00 | **100% local en PC del líder; VM del evento descartada** | Vigente (v2) |
| D8 | 07-nov ~00:00 | Pitch 10:00 sáb, congelar 08:00, video 08:30, ensayo 09:00 | Vigente |
| D9 | 07-nov ~00:30 | Demo con IA generativa (Claude vs Gemini por decidir) | Pendiente elección |
| D10 | 07-nov ~01:00 | Blue Prism manual + híbrido (worker Python) | Vigente |
| D11 | 07-nov ~02:15 | Motor asistencial desacoplado en funciones puras + caché SQLite | Vigente |
| D12 | 07-nov ~03:25 | Endpoints FastAPI (/api/kpis, /api/plan, /api/plan-vs-real, /api/lotes) con agregación SQLite y alertas WCAG 2.1 AA | Vigente |

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

## ADR-006 — Arquitectura del motor asistencial (D11, funciones puras + caché SQLite)

- **Contexto:** el motor de cálculo (issues #17 y #18) requiere replicar las fórmulas del §4 con exactitud absoluta: tramos inclusivos, absorción de asignaciones especiales sobre el % NAS basal, ajuste no retroactivo de 42h (mayo 2026), factor grupal y doble redondeo truncado piso (`floor`).
- **Decisión:** estructurar `backend/motor.py` como un conjunto de funciones puras independientes de I/O (`tramo_inclusivo`, `ajustar_tope_42h`, `calcular_distribucion_final`, `calcular_atenciones_semanales`, `ajustar_atencion_grupal`, `calcular_semanas_efectivas`, `calcular_plan_mensual`, `calcular_foja`), complementadas por la clase `CatalogosMotor` para lectura en memoria desde SQLite (`backend/db.sqlite`).
- **Consecuencias:** desacoplamiento absoluto de BD para pruebas unitarias instantáneas; interoperabilidad directa tanto para el bot worker (CLI offline) como para los endpoints de FastAPI; validación matemática 100% en verde con `tests/test_motor.py`.
- **Decidió:** Dev B (isabelrosemc) asistida por Antigravity — 07-nov ~02:15.

## ADR-007 — Documento oficial y set de práctica en repo (D3)

- **Contexto:** el enunciado oficial del desafío (PDF) y el set de práctica (2 Excel) son la fuente de verdad para reglas, fórmulas y datos de validación.
- **Decisión:** agregar `requerimientos_oficiales.pdf` (renombrado desde A.pdf) y mantener los 2 Excel fuente (`Nac - Base contratos x mes.xlsx`, `Nac - Planificación Asistencial x mes.xlsx`) en la raíz del repo como referencia inmutable. El set de práctica sigue ausente (no disponible).
- **Consecuencias:** trazabilidad total a la fuente; los scripts de extracción (`tools/extraer_casos_dorados.py`) y generación SIC (`tools/generar_sic.py`) leen directamente de estos archivos; prohibido modificar los Excel fuente.
- **Decidió:** Líder — 07-nov ~00:30.

## ADR-008 — Roles en ensayo 09:00 (D4)

- **Contexto:** el pitch (3 min) y demo (5 min) requieren asignación clara de quién presenta, quién opera el bot y quién responde preguntas técnicas.
- **Decisión:** definir roles durante el ensayo general a las 09:00 según fortalezas de cada integrante; decisión final del líder antes de congelar a las 08:00.
- **Consecuencias:** evita improvisación en el escenario; cada integrante sabe su parte; el líder tiene la última palabra.
- **Decidió:** Líder — 07-nov ~05:00.

## ADR-009 — Perfil SIC sintético balanceado seed 42 (D5)

- **Contexto:** el SIC sintético debe ser creíble para la demo y permitir validar alertas visibles (sobrecupo, subcupo) sin sesgos.
- **Decisión:** generar `SIC_Atenciones_Reales.xlsx` con 3.123 filas, perfil balanceado por especialidad, semilla 42 para reproducibilidad, ratios por especialidad y licencias simuladas.
- **Consecuencias:** datos determinísticos y auditables; validación del motor contra casos dorados extraídos de la dotación real; variación controlada para demo.
- **Decidió:** Dev A (asistido por agente) — 07-nov ~04:00.

## ADR-010 — Vacantes (C1) fuera del guion (D6)

- **Contexto:** el requisito C1 (vacantes) no está en los 4 pasos oficiales del guion (Paso 1: Carga, Paso 2: Validación, Paso 3: Cálculo, Paso 4: Publicación).
- **Decisión:** mantener las vacantes fuera del guion de demo; mencionar como roadmap/futuro en el pitch para mostrar visión de producto.
- **Consecuencias:** foco en lo obligatorio; el motor no implementa lógica de vacantes; se evita scope creep.
- **Decidió:** Líder — 07-nov ~07:00.

## ADR-011 — Cronograma de entrega sábado 10:00 (D8)

- **Contexto:** el desafío exige entrega sábado 07-nov a las 10:00 (pitch 3 min + demo 5 min).
- **Decisión:** congelar código a las 08:00, grabar video de respaldo a las 08:30, ensayo general 09:00–09:40, pitch/demo en vivo 10:00.
- **Consecuencias:** buffer sagrado de 2h antes del pitch; video de respaldo si falla el demo en vivo; ensayo con roles definidos (D4).
- **Decidió:** Líder — 07-nov ~00:00.

## ADR-012 — Demo con IA generativa (D9)

- **Contexto:** la rúbrica exige declarar uso de IA; el material de demo (guion, slides, datos de ejemplo) puede generarse con IA generativa.
- **Decisión:** usar IA generativa (Claude vs Gemini por decidir) para material de demo; declarar explícitamente en el pitch qué fue generado por IA.
- **Consecuencias:** cumplimiento de la rúbrica; transparencia; el líder elige el modelo antes de las 07:00.
- **Decidió:** Líder — 07-nov ~00:30 (pendiente elección de modelo).

## ADR-013 — Endpoints FastAPI asistenciales y doble codificación WCAG (D12)

- **Contexto:** el Dashboard accesible requiere KPIs consolidados (% FOJA, horas agregadas, meta 90%), dotación paginada y cruce Plan vs. Real con latencias inferiores a 300ms y alertas conformes a WCAG 2.1 AA (Issue #20).
- **Decisión:** implementar `backend/main.py` sobre FastAPI con agregaciones nativas en SQLite bajo WAL mode; soportar filtros multinivel (`it`, `periodo`, `cargo`, `area`, `cod_esp`) y entregar semáforo en `/api/plan-vs-real` con doble codificación obligatoria (etiquetas textuales explícitas + íconos vectoriales + badges: CRITICO, CUMPLIDO, SUPERAVIT) tanto agrupado como desagrupado.
- **Consecuencias:** respuestas en <20ms locales; tolerancia a estado cero sin caídas (0 contratos = ceros estructurados); desacoplamiento de entorno vía `BOTATHON_DB_PATH`; 9/9 pruebas unitarias automatizadas con `TestClient`.
- **Decidió:** Líder y Dev B asistidos por Antigravity — 07-nov ~03:25.

---

*(Nuevas decisiones se agregan como ADR-014, ADR-015… con fecha y quién decidió.)*
