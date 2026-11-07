# BOT_BUILD_GUIDE.md — Guía de construcción del bot en Blue Prism Studio

> **Para Dev A.** Modo trabajo: **manual + híbrido** (ADR-003): Studio orquesta (proceso pequeño y visible), la lógica pesada vive en `bot/worker.py` (ya probado con datos reales). Objetivo: proceso de ~12–15 stages, construible en ~1,5–2 h, demostrable de punta a punta. **100% local en el PC del líder — sin VM.**

---

## 0. Antes de empezar (5 min)

1. Confirmar que existen las carpetas: `bot/entrada · procesados · rechazados · reportes`.
2. Confirmar Python accesible desde consola: `python --version` (el worker se ejecuta igual que en consola).
3. Generar los archivos de prueba:
   - Foto válida: `python3 tools/make_demo_invalidos.py` NO — para válidos usar el BUK real filtrado a enero (el worker también acepta el archivo completo).
   - Archivo corrupto: `python tools/make_demo_invalidos.py` → deja `bot/entrada/BUK_demo_invalidos.xlsx`.
4. Blue Prism abierto con Studio y permisos para crear Process y Object.

## 1. Object: "BOT - Archivos" (Utility de archivos, ~5 stages)

Crear **Object** nuevo (Object Studio) con las acciones mínimas — usar VBOs existentes siempre que se pueda:

| Action | VBO origen | Qué hace |
|---|---|---|
| `Listar_XLSX_Entrada` | **Utility - File Management** → `Get Files` | Lista `bot/entrada/*.xlsx`; salida: colección `archivos(Nombre, Ruta)` |
| `Mover_A_Procesando` | Utility - File Management → `Move File` | Mueve el `.xlsx` a `bot/procesados/procesando/` (evita reprocesar) |
| `Mover_A_Procesados` | ídem | Mueve el archivo desde `procesando/` a su lugar final tras éxito |
| `Mover_A_Rechazados` | ídem | Si el worker devuelve `estado=CON_RECHAZOS_TOTAL` (nada publicable) |

Si la VBO "Utility - File Management" no está cargada: **System → Objects → VBO → Import** (viene de fábrica con Blue Prism).

## 2. Process: "BOT - Ingesta Asistencial" (flujo principal, ~12 stages)

Crear **Process** nuevo. Diagrama en este orden (los nombres exactos son los que se muestran en la demo):

```
[Start]
  → [Stage 1] Action: Listar_XLSX_Entrada        (Object BOT - Archivos)
  → [Stage 2] Decision: ¿Hay archivos?
        No  → [End "Sin pendientes"]
        Sí  → [Stage 3] Loop: Para cada archivo
                  → [Stage 4] Action: Mover_A_Procesando
                  → [Stage 5] Action: "Utility - Environment" → Start Process
                       Aplicación: python
                       Argumentos: bot/worker.py --entrada "<ruta>" --db backend/db.sqlite
                       WorkingDir: <raíz del repo>
                       WaitForExit: True          ← clave: esperar al worker
                  → [Stage 6] Action: "Utility - Environment" → Read (resultado JSON)
                       (leer bot/reportes/ultimo_resultado.json como texto)
                  → [Stage 7] Decision: ¿estado = OK?
                        Sí → [Stage 8] Action: Mover_A_Procesados + [Calc] Log OK
                        Con rechazos parciales → [Stage 9] Calc: mensaje rechazos +
                                                 Action: Reporte ya generado por worker
                        Sin publicables → [Stage 10] Action: Mover_A_Rechazados
                  → [Stage 11] Navigate/Send log a cola o Write Log (System log)
                → fin Loop
  → [Stage 12] [End "Lote procesado"]
```

**Manejo de excepciones (Stage Recovery):** envolver Stages 4–10 en un bloque con `Recover`: si algo explota (archivo abierto en Excel, Python no encontrado) → log del error + mover a `rechazados/` + continuar con el siguiente archivo. **El bot NUNCA se detiene por datos sucios** — ese es el mensaje de la demo.

## 3. El worker (`bot/worker.py`) — lo que YA está hecho

`python bot/worker.py --entrada <archivo.xlsx> --db backend/db.sqlite`

- Normaliza (header fila 2, NaT, 19 columnas) y valida: IT/Cod_Esp en catálogo, horas <0, >44 (o >42 desde mayo), texto-en-número, duplicados `[PersonaId+IT+Periodo]`.
- Publica válidos a SQLite + registra lote (ID, timestamp, duración, contadores).
- Genera SIEMPRE: `bot/reportes/Rejected_Records_Report.xlsx` + `bot/reportes/ultimo_resultado.json` con:
  `{"estado": "OK" | "CON_RECHAZOS" | "SIN_PUBLICABLES", "validos": n, "rechazados": n, "deltas": {"altas": n, "bajas": n, "cambio_jornada": n, "ajuste_42h": n}, "lote_id": ...}`

> Estado actual: si `bot/worker.py` aún no existe (issue #11 en curso), Stage 5 puede apuntar a un placeholder que solo valide columnas — la guía del diagrama NO cambia.

## 4. Configuración exacta del Start Process (Stage 5)

| Campo | Valor |
|---|---|
| Application | `python` (o ruta absoluta del venv si lo usan: `C:\...\venv\Scripts\python.exe`) |
| Arguments | `bot/worker.py --entrada "{RutaArchivo}" --db backend/db.sqlite` |
| Working directory | raíz del repo (donde está `backend/`) |
| WaitForExit | True (timeout 300s) |

Capturar `ExitCode`: 0 = OK · 2 = con rechazos · 1 = error (mapear a Stages 7–10).

## 5. Prueba E2E en el PC del líder (checklist de Dev A)

- [ ] Corrida 1 — BUK real (enero): termina OK; SQLite crece; `procesados/` tiene el archivo.
- [ ] Corrida 2 — archivo corrupto (`make_demo_invalidos.py`): termina CON_RECHAZOS; `Rejected_Records_Report.xlsx` con las 6 filas malas; proceso NO se cae.
- [ ] Corrida 3 — reinyectar el mismo archivo: duplicados PK detectados (o archivados por nombre con timestamp — como decida el worker).
- [ ] El diagrama completo corre visible en Studio con Run Mode = foreground (para la demo).

## 6. Lo que se muestra en la demo (Paso 2, 1:15 min)

1. Arrastrar el archivo corrupto a `bot/entrada/` **en vivo**.
2. Ejecutar el proceso en Studio (foreground): se ven los stages recorridos.
3. Abrir `Rejected_Records_Report.xlsx`: los 6 errores con motivo legible.
4. Frase clave: *"el bot aisló los datos sucios y siguió funcionando"*.
