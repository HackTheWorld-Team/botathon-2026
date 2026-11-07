# ARCHITECTURE.md — Registro de decisiones (ADR-lite)

> **Regla de mantenimiento autónomo:** cada decisión técnica nueva o cambio de decisión debe agregarse aquí en el MISMO trabajo que la produce (contexto → decisión → consecuencias → quién decidió). Ver [`AGENTS.md`](../AGENTS.md) §4.

| ID | Fecha | Decisión | Estado |
|---|---|---|---|
| D1 | 07-nov ~00:30 | Stack: React (Vite) + FastAPI + SQLite | Vigente |
| D2 | 07-nov ~00:30 | BD: SQLite (PostgreSQL solo producción) | Vigente (reforzada por ADR-006) |
| D7 | 07-nov ~01:00 | **100% local en PC del líder; VM del evento descartada** | Vigente (v2) |
| D10 | 07-nov ~01:00 | Blue Prism manual + híbrido (worker Python) | Vigente |
| D9 | 07-nov ~00:30 | Demo con IA generativa (Claude vs Gemini por decidir) | Pendiente elección |
| D11 | 07-nov ~02:45 | UI: lenguaje pixel-zen + one-page 5 pestañas + tipografía no pixel (ADR-007) | Vigente |

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

> **v2 (07-nov ~03:15):** el líder reasignó la construcción del proceso en Studio a **Dev B (Isabel)** — issue #52, sí o sí. Dev A mantiene `worker.py`, carpetas, rechazos, deltas/42h e ingesta SIC (#11 #13 #15 #28). Resto de la decisión sin cambios. Nota operativa (D7): Studio vive en el PC del líder → Isabel construye en ese equipo (presencial o dirigida por el líder).

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

## ADR-006 — NoSQL evaluado y descartado; SQLite se mantiene (refuerza D2)

- **Contexto:** en fase early, el líder planteó migrar la BD a NoSQL ante posible cambio de datos/ingesta "a futuro en producción".
- **Decisión:** mantener SQLite. Argumentos: dominio relacional (PK `[PersonaId+IT+Periodo]`, catálogos, deltas, integridad referencial `IT`/`Cod_Esp` es requerimiento puntado §6.1); stack pandas-céntrico (`df.to_sql` trivial); la tolerancia a formatos desconocidos ya vive en el worker (parsea→valida→normaliza→rechaza), no en el storage; sin server extra en el PC del líder (modo de fallo nuevo para la demo en vivo, R2).
- **Consecuencias:** la flexibilidad de ingesta se resuelve en la capa correcta (worker + JSON de publicación, ADR-005); path a producción documentado = PostgreSQL (SQL→SQL); material de pitch: "evaluamos NoSQL y lo descartamos por integridad referencial".
- **Decidió:** Líder con análisis del agente — 07-nov ~02:00.

## ADR-007 — Lenguaje visual pixel-zen, one-page y tipografía no pixel (D11)

- **Contexto:** sesión de especificación de UI con el líder (~02:00–02:45). Deseo: minimalismo zen con toque pixel geométrico y máxima legibilidad/accesibilidad; paleta de 5 colores aportada (white/pearl-aqua/turquoise/onyx/racing-red).
- **Decisión:** ver [`UI_SPEC.md`](UI_SPEC.md) como fuente de verdad. Resumen: lo pixel vive SOLO en geometría (bordes rectos, sombras duras sin blur, barras segmentadas, iconos pixel-art, chips cuadrados, grid 4px, transiciones `steps()` con reduced-motion) — **cero fuentes pixel en texto** (Roboto única, tabular-nums). One-page con shell persistente (marca + statusbar del bot + filtros globales SIEMPRE visibles) y 5 pestañas ARIA Tabs sin router de librería (deep-link hash nativo: pushState tabs / replaceState filtros). Paleta con derivados AA obligatorios (`#0a6b63`, `#c62828`; turquoise prohibido como texto/focus sobre blanco; gradientes descartados). Contraste verificado programáticamente sobre mock. Issues: shell #46, split #27→#47, lotes #48, auditoría WCAG #49, enmienda tokens en #23, cierre #22.
- **Consecuencias:** identidad distintiva sin sacrificar WCAG 2.1 AA (diferenciador de rúbrica); shell desacoplado de las vistas (ADR-005); URLs reproducibles para recovery en demo (R2), ensayos y video respaldo.
- **Decidió:** Líder en sesión de specs — 07-nov ~02:45.

---

*(Nuevas decisiones se agregan como ADR-008, ADR-009… con fecha y quién decidió.)*
