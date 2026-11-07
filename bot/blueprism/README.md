# Backup de Artefactos Blue Prism Studio (Issue #52 — D10 v2)

Esta carpeta contiene el respaldo versionado del proceso y objeto construidos en **Blue Prism Studio** para la demo del desafío **Cada Hora Cuenta**:

## Archivos incluidos

1. **`BOT - Archivos.bpobject`** (`Object`, GUID `25b8b6a8-fb7c-4845-8aae-e19db80bfc2c`):
   - `Listar_XLSX_Entrada`: lista archivos `.xlsx` en `bot/entrada/` ignorando temporales `~$`.
   - `Mover_Archivo`: mueve archivos entre `entrada/`, `procesados/procesando/`, `procesados/` y `rechazados/` con manejo de colisión de nombres.
   - `Ejecutar_Worker_Y_Leer_Resultado`: invoca `.venv\Scripts\python.exe bot/worker.py --entrada "<ruta>" --db backend/db.sqlite`, espera salida sincrónicamente y parsea `bot/reportes/ultimo_resultado.json` devolviendo `Estado`, `Lote_ID`, `Validos`, `Rechazados`, `Duracion_Ms`, `Fecha_Corrida` y `Resumen_Texto`.

2. **`BOT - Ingesta Asistencial.bpprocess`** (`Process`, GUID `9d337fe1-e888-4a6a-a981-2481764ac0f2`):
   - Flujo principal de 12 stages con bucle por archivo, decisiones por estado (`OK`, `CON_RECHAZOS`, `SIN_PUBLICABLES`), bloque de seguridad `Recover`/`Resume` que garantiza que el bot **nunca se detiene por datos sucios**, y cálculo de `Log_Trazabilidad`.

3. **`Proceso_Teleton.bpprocess`** (`Process`, GUID `e5b784f4-a262-4da4-9246-0f1b053e93de`):
   - Respaldo del proceso inicial de pruebas.

4. **`restore_blueprism.ps1`**:
   - Script PowerShell que inyecta o restaura directamente los `.bpobject` y `.bpprocess` en la base de datos local de Blue Prism (`(localdb)\BluePrismLocalDB` → `BluePrism.mdf`).

## Cómo restaurar

### Opción A — Automática por script (1 segundo)
```powershell
powershell -ExecutionPolicy Bypass -File bot/blueprism/restore_blueprism.ps1
```
*(Si Blue Prism Studio ya está abierto, pulsa `F5` o reabre la pestaña Studio para refrescar el árbol).*

### Opción B — Manual desde Blue Prism Studio
1. Abrir **Blue Prism Studio**.
2. Ir a **File → Import → Process / Object**.
3. Seleccionar primero `bot/blueprism/BOT - Archivos.bpobject` y luego `bot/blueprism/BOT - Ingesta Asistencial.bpprocess`.
