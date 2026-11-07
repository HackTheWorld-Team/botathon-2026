# Playbook de la Demo Oficial — Casos de Uso Simulados y Estados en Vivo
**Desafío Botathon 2026 Teletón — "Cada hora cuenta"**

> Este documento es la **fuente de verdad operacional y cheat-sheet rápida** para el presentador durante los 8 minutos de evaluación (3 min pitch + 5 min demo). Permite saltar o recuperarse de cualquier estado en <3 segundos usando el CLI `tools/simular_casos_demo.py`.

---

## 1. Comandos de Rescate Rápido (<3 segundos)

Si durante la presentación en vivo se necesita reiniciar, saltar o reparar el estado de la demo:

```powershell
# Estado Paso 1 (Solo Ene–Abr: bot/entrada/ listo con archivos para procesar)
python tools/simular_casos_demo.py --escenario paso1-inicial

# Estado Paso 2 (Lote con los 6 errores procesado, reporte generado, bot intacto)
python tools/simular_casos_demo.py --escenario paso2-rechazos

# Estado Paso 3 (Mayo cargado, transición 42h, deltas versionados, Ene–Abr congelados)
python tools/simular_casos_demo.py --escenario paso3-deltas-mayo

# Estado Paso 4 (Parametrización auditada desde mayo + Capa SIC Real con alertas)
python tools/simular_casos_demo.py --escenario paso4-completo

# Verificación de diagnóstico E2E completa (ejecuta los 4 pasos y valida cifras)
python tools/simular_casos_demo.py --verificar-todo
```

---

## 2. Resumen Métrico de los 4 Escenarios de la Demo

Valores extraídos y certificados por la suite de pruebas unitarias y E2E (`tests/test_e2e_demo_pasos.py`, `tests/test_logica_negocio_exhaustiva.py` y `tests/test_simulador_demo.py`):

| Escenario | Lotes | Contratos | % FOJA | Plan Dir Mensual | Plan Tot Mensual | Meta Gestión 90% | Rechazos | Deltas Mayo | Auditoría Parámetros |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Paso 1: Inicial (Ene–Abr)** | 1 | 1.785 | **61,27%** | 265.752 | 333.579 | 238.292 | 0 | 448 | 0 |
| **Paso 2: Archivo Corrupto** | 2 | 1.785 | **61,27%** | 265.752 | 333.579 | 238.292 | **6** | 448 | 0 |
| **Paso 3: Deltas Mayo 42h** | 3 | 2.235 | **61,29%** | 325.463 | 408.403 | 291.845 | 6 | **149** | 0 |
| **Paso 4: Completo + SIC** | 4 | 2.235 | **61,32%** | 325.619 | 408.379 | 291.989 | 6 | 149 | **2** |

---

## 3. Guion Paso a Paso para la Demo (5 Minutos)

### Paso 1: Dashboard Inicial y Accesibilidad WCAG (1:00 min)
- **Acción:** Abrir dashboard web (`http://localhost:8000`). Navegar **exclusivamente con teclado** (`Tab`, `Shift+Tab`, flechas en `role="tablist"`).
- **Qué mostrar:**
  - Pestaña **Resumen Asistencial**: Tarjetas KPI `% FOJA` (**61,27%**), `Meta de Gestión 90%` (**238.292** atenciones), `Plan Mensual` (**265.752** dir / **333.579** tot) y desglose de horas semanales (Directa **40.665,8h** / Indirecta **8.354,4h** / NAS **17.346,3h**).
  - Filtro multinivel: seleccionar instituto (ej. Arica `IT=11` o Santiago `IT=131`), mes `2026-04`.
  - BotStatusBar: muestra estado del bot en tiempo real ("Inactivo - Último lote #1 OK").
- **Frase clave del presentador:**
  > *"Navegamos 100% por teclado bajo WCAG 2.1 AA. El % FOJA del 61,27% y las metas institucionales se calculan en milisegundos con doble piso truncado por regla asistencial."*

---

### Paso 2: El Bot RPA y la Resiliencia ante Datos Sucios (1:15 min)
- **Acción:**
  - Mostrar la carpeta `bot/entrada/` con `BUK_demo_invalidos.xlsx` (o arrastrarlo en vivo).
  - Ejecutar en Blue Prism Studio el proceso `BOT - Ingesta Asistencial` (o vía CLI `python bot/worker.py --entrada bot/entrada/BUK_demo_invalidos.xlsx`).
  - Ir a la pestaña **Lotes de Ingesta** en el dashboard.
- **Qué mostrar:**
  - Lote #2 marcado con estado accesible `[CON RECHAZOS]` (ícono vectorial + etiqueta textual).
  - **Tabla de 6 registros rechazados con motivos legibles:**
    1. `PersonaId 999901`: `HORAS_NEGATIVAS` (Jornada -44h absurda).
    2. `PersonaId 999902`: `FORMATO_NUMERICO_INVALIDO` (Texto `"Tres Cientos"` en horas semanales).
    3. `PersonaId 999903`: `IT_NO_EXISTE` (Instituto 99 fuera de catálogo).
    4. `PersonaId 999904`: `COD_ESP_NO_EXISTE` (Especialidad 999 no existe).
    5. `PersonaId 71279`: `DUPLICADO_PK` (Mismo contrato duplicado en el mismo período).
    6. `PersonaId 999906`: `JORNADA_EXCEDE_MAXIMO` (Jornada de 44h en mayo violando tope legal 42h).
  - Botón de descarga de `Rejected_Records_Report.xlsx` para enviar directo a RRHH.
- **Frase clave del presentador:**
  > *"El bot aisló las 6 anomalías sin caerse ni corromper la base de datos. Los 445 registros sanos continuaron su flujo, demostrando tolerancia a fallas de nivel clínico."*

---

### Paso 3: Carga Mayo 2026, Ley 40h y No Retroactividad (1:30 min)
- **Acción:**
  - Ingestar `BUK_Dotacion_2026_Mayo.xlsx` (Lote #3).
  - Ir a la pestaña **Antes / Después**.
- **Qué mostrar:**
  - **Resumen de 149 deltas detectados:**
    - `1 ALTA`: PersonaId `141845` contratada en mayo ya bajo el tope legal de **42h**.
    - `140 CAMBIOS DE JORNADA`: Transición legal masiva `44h -> 42h`.
    - `2 MULTI-SEDE`: PersonaId `125129` con split Antofagasta (**35h**, 4 días) + Calama (**8h**, 1 día).
  - **Garantía de No Retroactividad (Meses congelados):**
    - Tabla comparativa de meses cerrados Enero, Febrero, Marzo y Abril: todos con `Diferencia = 0` y badge `[CONGELADO]`.
  - Comparativa por instituto y profesional antes y después de mayo.
- **Frase clave del presentador:**
  > *"La ley de 40 horas se aplica con estricta no retroactividad: el pasado de enero a abril permanece inmutable al centésimo, recalculando exclusivamente desde la vigencia legal de mayo."*

---

### Paso 4: Parametrización en Vivo y Capa SIC Real (1:15 min)
- **Acción:**
  - Ir a la pestaña **Parámetros**.
  - Mostrar catálogo editable sin código: asignaciones especiales y % base por cargo.
  - Activar toggle **"Simular vacantes presupuestadas (+1.047h)"**: ver en tiempo real el impacto proyectado de **+15.118 atenciones** sin alterar la BD.
  - Editar parámetro: por ejemplo, `Líder Equipo` de 2h a 3h o % Directo de Médicos Fisiatras con vigencia `2026-05`.
  - Ir a la pestaña **Plan vs. Real**:
    - Ver atenciones reales provenientes del SIC (`SIC_Atenciones_Reales.xlsx`).
    - Alertas accesibles de doble codificación: `[Déficit Crítico]`, `[Meta Cumplida]`, `[Superávit]`.
- **Frase clave del presentador:**
  > *"La jefatura médica puede simular vacantes o ajustar asignaciones sin escribir una sola línea de código, auditando cada decisión con trazabilidad total frente a la producción real del SIC."*

---

## 4. Casos Estrella para Q&A del Jurado

Datos exactos para responder preguntas técnicas difíciles del jurado:

### Caso 1: `PersonaId 137732` (Duda 1 — Absorción en NAS)
- **Perfil:** Médico Fisiatra en Arica (`IT=11`), 40h semanales, Tramo 1.
- **Asignación especial:** `Líder Equipo 2h` (2/40 = 5% de la jornada).
- **Cálculo exacto:**
  - Base Fisiatra T1: Directo 65% · Indirecto 15% · NAS 20%.
  - NAS absorbe la asignación: 20% + 5% = **25,0000% NAS**.
  - Asistencial disponible: 100% - 25% = **75,0000%**.
  - Proporción relativa: $75 \times \frac{65}{80} =$ **60,9375% Directo** · $75 \times \frac{15}{80} =$ **14,0625% Indirecto**.
  - Invariante de suma: $60,9375\% + 14,0625\% + 25,0000\% = 100,0000\%$.
  - Atenciones semanales abril: $\lfloor (40 \times 0,609375 \times 60) / 40 \rfloor = \mathbf{36\text{ directas}}$ y $\mathbf{11\text{ indirectas}}$.
  - Plan abril (4,2 semanas): $\lfloor 36 \times 4,2 \rfloor = \mathbf{151\text{ atenciones directas}}$, Meta Gestión (90%) = $\mathbf{135}$.

### Caso 2: `PersonaId 125129` (Multi-sede con Split de Horas)
- **Perfil:** Médico Fisiatra en la Segunda Región.
- **En abril:** 1 solo contrato de 35h en Antofagasta.
- **En mayo:** Split según hoja Excepciones:
  - Antofagasta (`IT=21`): **35h semanales** (4 días/semana) $\rightarrow$ Tramo 2, Plan mayo = **129 directas**.
  - Calama (`IT=22`): **8h semanales** (1 día/semana) $\rightarrow$ Tramo 3, Plan mayo = **26 directas**.
  - Total mayo: **43h semanales**, **155 atenciones directas**.

### Caso 3: `PersonaId 141845` (Alta Nueva bajo Tope Legal de 42h)
- **Perfil:** Kinesiólogo alta nueva en mayo 2026 (`IT=101`, Puerto Montt).
- **Jornada:** **42h semanales** (nace directamente con la jornada reducida).
- **Plan mayo:** 54 atenciones directas/semana $\times$ 4,0 sem efectivas = **215 directas**, Meta Gestión = **193**.

### Caso 4: `PersonaId 115444` (Multi-sede con Caso Dorado)
- **Perfil:** Fisiatra en Iquique (`IT=12`) 44h en abril $\rightarrow$ ajustado a 42h en mayo.
- **Excepción Coyhaique:** 6h semanales en Coyhaique (`IT=111`, Tramo 3):
  - 5 atenciones directas/semana, Plan abril = **21 atenciones**, Meta Gestión = **18**.

---

## 5. Matriz de Validación de Suites Automatizadas

Todas las suites de prueba en `tests/` deben estar 100% en verde antes de subir al escenario:

```powershell
# Ejecución de la batería completa en botathon-2026-e2e
pytest tests/test_motor.py -v                      # 14 tests unitarios de motor
pytest tests/test_worker.py -v                     # 5 tests de worker y deltas
pytest tests/test_api.py -v                        # 34 tests de endpoints FastAPI
pytest tests/test_logica_negocio_exhaustiva.py -v  # 89 tests exhaustivos de reglas D1-D4
pytest tests/test_e2e_demo_pasos.py -v             # 4 tests E2E de los 4 pasos de la demo
pytest tests/test_simulador_demo.py -v             # 3 tests de los estados simulados
```
*(Total: **149 pruebas unitarias, de integración y E2E en verde**).*
