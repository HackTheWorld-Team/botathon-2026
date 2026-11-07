# BOT_BUILD_GUIDE.md — Guía de construcción del proceso en Blue Prism Studio (Modo Híbrido D10)

> **Contexto:** Decisión D10 (ADR-003) — Proceso pequeño en Studio (~12–15 stages) que orquesta la lógica pesada en `bot/worker.py` (Python CLI testeable). 100% local en el PC del líder (D7), sin VM.
> **Objetivo:** Dev A construye el proceso siguiendo esta guía **sin adivinar**. Cada stage, VBO, ruta y código de salida está especificado.

---

## 1. VBOs (Visual Business Objects) requeridos

| # | VBO (nombre exacto en instalación local) | Action / Stage usado | Propósito en el proceso |
|---|---|---|---|
| 1 | **File Management** | `Create Directory` | Crear carpetas `entrada/`, `procesados/`, `rechazados/`, `reportes/` si no existen |
| 2 | **File Management** | `Move File` | Mover archivo de `entrada/` → `procesados/` (éxito) o `rechazados/` (fallo) |
| 3 | **File Management** | `Get Files` | Listar archivos `.xlsx` en carpeta `entrada/` para procesar en lote |
| 4 | **Environment** | `Start Process` | Invocar `bot/worker.py` con argumentos (ver §3) |
| 5 | **Environment** | `Get Environment Variable` | Leer `BOT_WORKER_PATH` (ruta absoluta a `worker.py`) y `BOT_BASE_PATH` (raíz del bot) |
| 6 | **Utility - Strings** | `Concat` / `Format` | Construir rutas dinámicas y nombre de archivo de reporte con timestamp |
| 7 | **Utility - JSON** | `Parse JSON` | Leer `result.json` que emite `worker.py` (códigos de salida, resumen, ruta reporte) |
| 8 | **Utility - File Management** | `Write Text File` | (Opcional) Log de auditoría del proceso Blue Prism |

> **Nota:** Los VBOs *File Management*, *Environment*, *Utility - Strings*, *Utility - JSON* vienen **out-of-the-box** en Blue Prism 7.x. No requieren importación adicional. Verificar en **System → VBOs** que estén presentes y habilitados.

---

## 2. Diagrama completo del proceso (~14 stages)

Orden de ejecución (top-down en el diagrama de Studio). Cada fila = un stage.

| # | Stage (tipo) | Nombre en Studio | Propósito | Entradas clave | Salidas clave | Excepción (retry/abort) |
|---|---|---|---|---|---|---|
| 1 | **Start** | `Start` | Punto de entrada | — | — | — |
| 2 | **Action** (File Management) | `Ensure Folders` | Crear `entrada/`, `procesados/`, `rechazados/`, `reportes/` | `BOT_BASE_PATH` (env var) | — | **Retry 2x / 5s** → Abort si falla (permisos) |
| 3 | **Action** (File Management) | `List Input Files` | Obtener lista de `.xlsx` en `entrada/` | `BOT_BASE_PATH + "/entrada"`, pattern `*.xlsx` | Collection `Files` (col: `FullPath`, `FileName`) | **Retry 1x / 3s** → Abort (carpeta inaccesible) |
| 4 | **Decision** | `Any Files?` | ¿Hay archivos para procesar? | `Files.Count > 0` | Yes / No | — |
| 5 | **Loop** (For Each) | `Loop Files` | Iterar cada archivo de la colección `Files` | `Files` | Item actual: `CurrentFile` (FullPath, FileName) | — |
| 6 | **Action** (Environment) | `Run Worker` | Ejecutar `worker.py` con el archivo actual | Ver §3 (comando, args, cwd) | `ExitCode`, `StdOut`, `StdErr` | **Retry 1x / 10s** → Abort (worker colgado) |
| 7 | **Decision** | `Worker OK?` | ¿`ExitCode == 0`? | `ExitCode` | Yes / No | — |
| 8 | **Action** (File Management) | `Move to Procesados` | Mover archivo original a `procesados/` | `CurrentFile.FullPath`, `BOT_BASE_PATH + "/procesados/"` | — | **Retry 2x / 3s** → Abort (disco lleno/permisos) |
| 9 | **Action** (Utility - JSON) | `Parse Result` | Leer `result.json` generado por worker | `BOT_BASE_PATH + "/reportes/result_<timestamp>.json"` | `ResultData` (JSON parseado: `status`, `summary`, `report_path`) | **Abort** (JSON inválido = bug worker) |
| 10 | **Decision** | `Validation OK?` | ¿`ResultData.status == "success"`? | `ResultData.status` | Yes / No | — |
| 11 | **Action** (File Management) | `Move to Rechazados` | (Rama No) Mover archivo a `rechazados/` + log | `CurrentFile.FullPath`, `BOT_BASE_PATH + "/rechazados/"` | — | **Retry 2x / 3s** → Abort |
| 12 | **Action** (Utility - Strings) | `Build Demo Message` | (Rama Sí) Construir mensaje visible para demo: "✅ Lote procesado: X registros, Y deltas, reporte en Z" | `ResultData.summary`, `ResultData.report_path` | `DemoMessage` (Data Item texto) | — |
| 13 | **Action** (Utility - File Management) | `Write Audit Log` | (Opcional) Append a `bot/logs/blueprism_audit.log` | `DemoMessage`, timestamp | — | **Retry 1x / 2s** → Continue (no bloquea) |
| 14 | **End** | `End` | Fin del proceso | — | — | — |

> **Total stages: 14** (Start + End + 12 funcionales). Cumple rango 12–15.

### Flujo de decisión visible para la demo (rama "Validation OK?")

```
                    ┌─────────────────────┐
                    │   Validation OK?    │
                    │  (ResultData.status)│
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
         ┌─────────┐                       ┌─────────┐
         │   Yes   │                       │   No    │
         └────┬────┘                       └────┬────┘
              │                                 │
              ▼                                 ▼
    ┌─────────────────────┐           ┌─────────────────────┐
    │ Build Demo Message  │           │ Move to Rechazados  │
    │  (visible en demo)  │           │  (visible en demo)  │
    └──────────┬──────────┘           └──────────┬──────────┘
               │                                 │
               └────────────────┬────────────────┘
                                ▼
                       ┌─────────────────┐
                       │   Write Audit   │
                       │      Log        │
                       └────────┬────────┘
                                ▼
                       ┌─────────────────┐
                       │      End        │
                       └─────────────────┘
```

**Para la demo:** En Studio, poner **breakpoint** en stage `Build Demo Message` y `Move to Rechazados`. Al ejecutar en modo debug, el panel "Data Items" muestra `DemoMessage` con el resumen legible ("✅ Lote procesado: 42 registros, 7 deltas, reporte en reportes/Reporte_20261107_103000.xlsx"). Esa es la **rama visible** que el jurado ve en 5 min.

---

## 3. Invocación de `bot/worker.py` (stage `Run Worker`)

### Configuración del stage `Start Process` (VBO Environment)

| Campo | Valor |
|---|---|
| **Application** | `python` (o ruta absoluta: `C:\Users\<lider>\AppData\Local\Programs\Python\Python311\python.exe`) |
| **Arguments** | `worker.py --input "[CurrentFile.FullPath]" --base-path "[BOT_BASE_PATH]" --output-json "[BOT_BASE_PATH]/reportes/result_[Timestamp].json"` |
| **Working Directory** | `[BOT_BASE_PATH]` (ej: `C:\Users\<lider>\botathon-2026\bot`) |
| **Window Style** | `Hidden` (0) |
| **Timeout (ms)** | `120000` (2 min — worker procesa validación + deltas + BD) |
| **Output** | `ExitCode` (Number), `StdOut` (Text), `StdErr` (Text) |

### Variables de entorno requeridas (configurar en PC del líder)

| Variable | Valor de ejemplo (PC del líder) | Uso |
|---|---|---|
| `BOT_BASE_PATH` | `C:\Users\lider\botathon-2026\bot` | Raíz del bot (carpetas entrada/procesados/rechazados/reportes) |
| `BOT_WORKER_PATH` | `C:\Users\lider\botathon-2026\bot\worker.py` | Ruta absoluta al script Python (para verificación) |
| `PYTHONPATH` | `C:\Users\lider\botathon-2026\backend` | Para que worker importe `backend.calculo` si comparte código |

> **Importante:** El worker **NO** usa la BD SQLite del backend directamente. Escribe `result.json` y el reporte Excel. El backend expone API para el dashboard; el bot es ingesta → validación → deltas → publicación (archivos).

### Códigos de salida interpretados por Blue Prism

| ExitCode | Significado | Acción en Blue Prism (stage `Worker OK?`) |
|---|---|---|
| `0` | Éxito total: archivo válido, deltas calculados, reporte generado | Rama **Yes** → `Move to Procesados` → `Parse Result` → `Build Demo Message` |
| `1` | Error de validación (formato, columnas, datos) — archivo rechazado | Rama **No** → `Move to Rechazados` |
| `2` | Error de I/O (no se puede leer/escribir) | Rama **No** → `Move to Rechazados` + log error |
| `3` | Error interno del worker (excepción no controlada) | Rama **No** → `Move to Rechazados` + alerta |
| `>3` | Reservado / futuro | Rama **No** → `Move to Rechazados` |

> El worker **siempre** escribe `result.json` (aunque sea error) con estructura:
> ```json
> {"status": "success|error", "exit_code": 0, "summary": "...", "report_path": "...", "error": "..."}
> ```

---

## 4. Manejo de excepciones por stage

| Stage | Excepción típica | Retry | Acción tras retry fallido | Rama visible demo |
|---|---|---|---|---|
| `Ensure Folders` | Permisos, ruta inválida | 2x / 5s | **Abort** proceso (log crítico) | No (falla antes de demo) |
| `List Input Files` | Carpeta no existe, red | 1x / 3s | **Abort** | No |
| `Run Worker` | Timeout, Python no encontrado, worker crashea | 1x / 10s | **Abort** → mover a `rechazados/` | Sí (stage `Move to Rechazados`) |
| `Move to Procesados` | Disco lleno, archivo bloqueado | 2x / 3s | **Abort** (requiere intervención manual) | No |
| `Parse Result` | JSON malformado (bug worker) | 0 | **Abort** inmediato | No |
| `Move to Rechazados` | Permisos, disco lleno | 2x / 3s | **Abort** | Sí (stage visible: archivo en rechazados) |
| `Write Audit Log` | Permisos, disco lleno | 1x / 2s | **Continue** (no bloquea proceso principal) | No |

**Política global:** El proceso **nunca** se queda "colgado" en excepción. Cada stage crítico tiene retry acotado y abort controlado que mueve el archivo a `rechazados/` para que el operador (Dev A en demo) vea el resultado.

---

## 5. Rutas locales absolutas de ejemplo (PC del líder — 100% local, sin VM)

> Ajustar `<lider>` al usuario real del PC. Estas rutas se configuran en **System → Environment Variables** del Blue Prism Server local (o en el archivo `.env` que el proceso lee via `Get Environment Variable`).

| Variable / Ruta | Valor de ejemplo | Descripción |
|---|---|---|
| `BOT_BASE_PATH` | `C:\Users\lider\botathon-2026\bot` | Raíz del bot |
| `entrada` | `C:\Users\lider\botathon-2026\bot\entrada` | Carpeta monitorizada (drop zone) |
| `procesados` | `C:\Users\lider\botathon-2026\bot\procesados` | Archivos OK (histórico) |
| `rechazados` | `C:\Users\lider\botathon-2026\bot\rechazados` | Archivos con error (para revisión) |
| `reportes` | `C:\Users\lider\botathon-2026\bot\reportes` | Reportes Excel + `result.json` generados por worker |
| `worker.py` | `C:\Users\lider\botathon-2026\bot\worker.py` | Script Python CLI |
| `logs` | `C:\Users\lider\botathon-2026\bot\logs` | (Opcional) `blueprism_audit.log` |

**Estructura de carpetas esperada (creada por stage `Ensure Folders`):**
```
C:\Users\lider\botathon-2026\bot\
├── entrada\           ← Drop zone (usuario copia .xlsx aquí)
├── procesados\        ← Archivos procesados OK
├── rechazados\        ← Archivos con error de validación
├── reportes\          ← Reporte_YYYYMMDD_HHMMSS.xlsx + result_YYYYMMDD_HHMMSS.json
├── logs\              ← blueprism_audit.log (opcional)
└── worker.py          ← CLI Python (ingesta→validación→deltas→publicación)
```

---

## 6. Data Items (variables de proceso) — lista completa

| Nombre | Tipo | Uso |
|---|---|---|
| `BOT_BASE_PATH` | Text | Leída de env var al inicio |
| `Files` | Collection | Columns: `FullPath` (Text), `FileName` (Text) |
| `CurrentFile` | Collection (row) | Item actual en Loop |
| `ExitCode` | Number | Salida de `Run Worker` |
| `StdOut` | Text | Salida estándar del worker |
| `StdErr` | Text | Error estándar del worker |
| `ResultData` | Collection / JSON | Parse de `result.json` (cols: `status`, `exit_code`, `summary`, `report_path`, `error`) |
| `DemoMessage` | Text | Mensaje legible para demo |
| `Timestamp` | Text | Formato `YYYYMMDD_HHMMSS` para nombres de archivo |

---

## 7. Checklist de validación humana (Dev A)

Antes de dar por terminada la construcción, Dev A confirma **cada ítem**:

- [ ] **VBOs presentes:** File Management, Environment, Utility - Strings, Utility - JSON, Utility - File Management aparecen en System → VBOs.
- [ ] **14 stages** creados en orden exacto de la tabla §2, con nombres idénticos.
- [ ] **Stage `Run Worker`** configurado con Application=`python`, Arguments con placeholders `[CurrentFile.FullPath]`, `[BOT_BASE_PATH]`, `[Timestamp]`, Working Directory=`[BOT_BASE_PATH]`, Timeout=120000.
- [ ] **Variables de entorno** `BOT_BASE_PATH`, `BOT_WORKER_PATH`, `PYTHONPATH` creadas en Windows (System → Environment Variables) y leídas con `Get Environment Variable`.
- [ ] **Carpetas** `entrada/`, `procesados/`, `rechazados/`, `reportes/`, `logs/` existen bajo `BOT_BASE_PATH` (stage `Ensure Folders` las crea al primer run).
- [ ] **Excepciones** configuradas: Retry counts y timeouts según tabla §4; Abort en stages críticos, Continue solo en `Write Audit Log`.
- [ ] **Rama visible demo:** Breakpoints en `Build Demo Message` y `Move to Rechazados`; Data Item `DemoMessage` muestra resumen legible.
- [ ] **Test manual:** Copiar un `.xlsx` válido a `entrada/` → Run proceso → Verificar: archivo en `procesados/`, reporte en `reportes/`, `DemoMessage` en Data Items.
- [ ] **Test error:** Copiar `.xlsx` inválido (columnas faltantes) → Run → Verificar: archivo en `rechazados/`, `DemoMessage` no aparece (rama No), `result.json` con `status: "error"`.

> **Firma Dev A:** _________________________   **Fecha:** _______________

---

## 8. Referencias cruzadas

- **ADR-003** (Blue Prism manual + híbrido): [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
- **Worker Python** (CLI, validación, deltas, códigos de salida): [`bot/worker.py`](../bot/worker.py) — *debe existir y pasar tests antes de construir el proceso en Studio*
- **Esquema de datos entrada** (Dotacion_2026, 19 columnas, header fila 2): [`README.md`](../README.md) §3.1
- **Casos dorados** (validación motor): [`tools/casos_dorados.csv`](../tools/casos_dorados.csv)

---

*Guía generada por agente IA (opencode/GLM) — validada por Dev A. Registrada en `docs/AI_USAGE_LOG.md` según protocolo AGENTS.md §4.*