# AI_USAGE_LOG.md — Registro de uso de Inteligencia Artificial

> **Por la rúbrica del desafío, el uso de IA debe declararse.** Todo agente (opencode, Gemini CLI, ai-sdlc, otro) agrega UNA FILA por intervención, en el mismo trabajo, sin excepciones (ver [`AGENTS.md`](../AGENTS.md) §4). Verificado por = humano que revisó/aprobó.

| Fecha/Hora | Agente · Modelo | Issue/Tarea | Qué generó | Artefactos | Verificado por |
|---|---|---|---|---|---|
| 06-nov 23:30–00:45 | opencode · z-ai/glm (GLM) | Contexto inicial + README | Auditoría de los 2 Excel (volúmenes, esquemas, trampas de formato, 44h→42h), resumen ejecutivo, estructura del README maestro | `README.md` (v1 completa) | Líder (revisión + commit) |
| 07-nov 00:45–01:15 | opencode · z-ai/glm | Integración doc. oficial | Lectura completa de `requerimientos_oficiales.pdf` (pdftotext), incorporación de hallazgos (asignaciones, zonas Arica/Ñuble/Aysén, deseables, rúbrica) al README | `README.md` (§2, §4, §5, §7, §8, §12) | Líder |
| 07-nov 01:15–01:45 | opencode · z-ai/glm | SIC sintético (issue-equivalente: §3.4) | Generador reproducible + archivo SIC_Atenciones_Reales.xlsx (3.123 filas, perfil balanceado seed 42, ratios por especialidad, licencias simuladas) + plan de referencia | `tools/generar_sic.py`, `SIC_Atenciones_Reales.xlsx`, `tools/plan_simplificado_referencia.csv` | Líder |
| 07-nov 01:45–02:00 | opencode · z-ai/glm | Casos dorados | Extracción de 10 casos reales de Dotacion_Asistencial; verificación Duda 1 al decimal (137732 → 60,9375%/14,0625%) | `tools/extraer_casos_dorados.py`, `tools/casos_dorados.csv` | Líder |
| 07-nov 02:00–02:30 | opencode · z-ai/glm | Documentación oficial + README | Transcripción del doc. oficial a markdown + actualización README (16h, VM, kit 2 Excel, rúbrica 9 dims) | `desafio_cada_hora_cuenta.md`, `README.md` | Líder |
| 07-nov 02:30–03:00 | opencode · z-ai/glm | Decisiones D1–D10 | Brief de decisiones con recomendaciones; aplicación de decisiones del líder al README (stack, 100% local, Blue Prism híbrido) | `README.md` §12, §9, §10, §11 | Líder (decidió) |
| 07-nov ~03:00 | opencode · z-ai/glm | Gobernanza de agentes | AGENTS.md (modo de trabajo + protocolo de documentación autónoma), ARCHITECTURE.md (ADR-001…005), AI_USAGE_LOG.md (este archivo), .gitignore | `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/AI_USAGE_LOG.md`, `.gitignore` | Líder |
| 07-nov ~03:15 | opencode · z-ai/glm | Planificación de issues (épicas + subtareas) | 7 épicas (#4–#10, label `epic`, no dispatcheables) + 24 subtareas conceptuales vinculadas (#11–#34) vía gh cli, agrupadas: ingesta/bot, motor, backend, dashboard, SIC, demo, gobernanza | GitHub Issues #4–#34 | Líder |

---

### Uso de IA a declarar en el pitch (resumen acumulado)

1. **Análisis de datos y reglas de negocio** (ingeniería inversa del Excel, 4 dudas operacionales) — opencode/GLM con supervisión humana.
2. **Generación de datos sintéticos** (SIC_Atenciones_Reales, casos dorados) — scripts IA verificados contra datos reales.
3. **Documentación y planificación** (README, épicas/issues, ADRs) — agentes IA, decisiones siempre del líder.
4. **Código** del MVP (backend/motor/dashboard/bot worker) — IA generando + tests obligatorios; humana revisa y mergea.
5. **Material de demo** (D9) — IA generativa Claude/Gemini por definir.
