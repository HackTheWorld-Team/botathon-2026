# AGENTS.md — Condiciones de desarrollo y protocolo de agentes

> **Obligatorio para cualquier agente de IA (opencode, Gemini CLI, ai-sdlc, otro) y para humanos** que trabajen en este repo. Este archivo es la fuente de verdad del modo de trabajo. Cualquier agente debe leerlo antes de su primer prompt.

---

## 1. Contexto operativo (no negociable)

| Condición | Valor |
|---|---|
| Desafío | Botathon 2026 Teletón — "Cada hora cuenta" ([`desafio_cada_hora_cuenta.md`](desafio_cada_hora_cuenta.md)) |
| Entrega | sábado 07-nov-2026, 10:00 (pitch 3 min + demo 5 min) |
| Entorno | **100% local en el PC del líder.** La VM del evento está DESCARTADA. |
| Blue Prism | Instalado en el PC del líder (mismo equipo). Construcción **manual + híbrido**: proceso pequeño en Studio + lógica pesada en `bot/worker.py` (Python). **Sin MCP, sin Playwright** (no aplicables a Studio/WPF). |
| Stack | React (Vite) + FastAPI + SQLite · Python worker · pandas/openpyxl |
| Datos | Exclusivamente ficticios/anonimizados (normativa chilena de protección de datos). NO tocar los `.xlsx` fuente. |

## 2. Roles

| Rol | Responsabilidad |
|---|---|
| Líder (humano) | Decisiones, guion/lámina, QA accesibilidad, datos de demo, dirección de agentes |
| Dev A (humano) | Worker Python del bot + integración carpeta→worker→BD (proceso Studio: Dev B, D10 v2) |
| Dev B (humano) | Motor de cálculo, FastAPI, dashboard React + **proceso Blue Prism en Studio (#52, D10 v2)** |
| Agentes IA | Código, docs, análisis, tests — **siempre documentando** (§4) y vía issues (§5) |

## 3. Estructura del repo (mantener orden; desacoplado)

```
backend/   FastAPI + SQLite + motor de cálculo (independiente, sin deps de frontend)
frontend/  Vite React (solo consume API; build estático servido por FastAPI)
bot/       BOT_BUILD_GUIDE.md + worker.py (CLI autónomo: ingesta→validación→deltas→BD)
tools/     Scripts de datos (SIC sintético, casos dorados) — independientes del MVP
docs/      ARCHITECTURE.md · AI_USAGE_LOG.md · decisiones y evidencia
```

Reglas de orden:
- Cada módulo corre y se prueba **independiente** (backend sin frontend; worker sin backend; tools sin nada).
- Nada de código de producción fuera de esas carpetas. Scripts efímeros → `/tmp`.
- Archivos de entrada/salida del bot: `bot/entrada/ · procesados/ · rechazados/ · reportes/`.
- `.gitignore` obliga: `venv/`, `node_modules/`, `dist/`, `*.db`, `__pycache__/`, artefactos efímeros.

## 4. Protocolo de documentación autónoma (POR LA RÚBRICA — obligatorio)

El doc. oficial exige **declarar el uso de IA**. Por tanto, todo agente que produzca código, decisiones o contenido debe, en el MISMO trabajo, actualizar:

1. **[`docs/AI_USAGE_LOG.md`](docs/AI_USAGE_LOG.md)** — SIEMPRE. Una fila por intervención: fecha/hora · agente+modelo · issue o tarea · qué generó · artefactos · verificado por. Sin excepciones, incluso para fixes pequeños.
2. **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — cuando el trabajo implique una decisión técnica (nueva o cambio): añadir entrada ADR-lite (contexto → decisión → consecuencias → quién decidió).
3. **[`README.md`](README.md)** — cuando cambie contexto del desafío, KPIs, backlog o decisiones (§12).
4. Si el agente NO puede actualizar docs (limitación), debe dejarlo explícito en su respuesta final para que el líder lo registre.
5. **Sesiones de especificación (specs de UI, reglas, etc.):** al cerrar la sesión, TODO lo acordado queda materializado en el MISMO trabajo — docs (spec/ADR/log) + issues creados o ajustados. **Ninguna spec vive solo en la conversación.** El agente propone; el líder confirma cada decisión antes de ejecutar.

Regla práctica: **prompt terminado = docs al día**. Un PR/commit sin su fila en AI_USAGE_LOG.md está incompleto.

## 5. Flujo de trabajo vía issues (ai-sdlc + workers locales)

1. **Planificación**: épicas (label `epic`) + subtareas como issues normales, creadas con `gh cli`. Hecho por líder o agentes.
2. **Dispatch**: para ejecutar una subtarea se le aplica label `ready-to-implement` → la toma **ai-sdlc** (pipeline) o un **worker local con IA** (opencode, Gemini CLI) trabajando sobre un branch `feat/issue-<n>`.
3. Los agentes locales siguen §4 (docs) y abren PR; merge por ai-sdlc o humano.
4. Épicas NO se dispatchean (label `epic` es skip-label del pipeline).
5. Labels de bloqueo: `needs-human`, `hold`, `wip` — respetar siempre.
6. **Cola IA (label `ai-worker`)**: los issues derivados a IA se asignan **físicamente al líder (Axel-DaMage)** — único dueño de la cola IA; el worker IA ejecuta y abre PR **sin asignar reviewers humanos**: los devs **solo** revisan si el líder se lo pide explícitamente o si su código depende directamente del artefacto. **Dev A y Dev B nunca son assigned de issues o PRs IA** — nadie se asigna a trabajo que no va a tocar. Merge: líder.

## 6. Convenciones técnicas

- Commits convencionales: `feat:`, `fix:`, `docs:`, `chore:`, `test:` (+ `(#issue)`).
- Branches: `feat/issue-<n>` / `fix/issue-<n>` (compatibles con el sweep de ai-sdlc).
- Python: sin comentarios innecesarios; nombres claros; funciones puras donde se pueda; tests para el motor.
- Frontend: HTML semántico, `aria-label`, foco visible, contraste AA, base ≥16px — **WCAG 2.1 AA desde la primera pantalla, no al final**.
- Motor de cálculo: redondeos piso EXACTOS del §4 del README; validación contra `tools/casos_dorados.csv` obligatoria antes de mergear cambios del motor.
- Prohibido: commitear secretos, `db.sqlite` con datos, binarios grandes, tocar los Excel fuente.

## 7. Decisiones vigentes (resumen — detalle en docs/ARCHITECTURE.md)

D1 React+FastAPI+SQLite · D4 roles en ensayo 09:00 · D6 vacantes fuera del guion · D7 **100% local** · D9 demo con IA generativa (declarar) · D10 Blue Prism manual+híbrido.
