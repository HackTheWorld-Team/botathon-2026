# INFORME TÉCNICO Y PLAN ESTRATÉGICO DE IMPLEMENTACIÓN
## Sistema Automatizado de Planificación y Gestión Asistencial Teletón 2026
**Proyecto:** Desafío Botathon 2026 — Automatización y Accesibilidad en Gestión Clínica  
**Fecha de Emisión:** Noviembre 2026  
**Documento Base:** Requerimientos Oficiales (A.pdf) y Fuentes de Datos Excel  

---

## 1. RESUMEN EJECUTIVO Y ANÁLISIS DE LA PROBLEMÁTICA ACTUAL

La Fundación Teletón gestiona la atención médica y terapéutica de miles de pacientes a través de más de 600 profesionales distribuidos en 14 institutos a nivel nacional (desde Arica hasta Coyhaique). Actualmente, la asignación de carga horaria y proyección de metas asistenciales se realiza mediante un proceso manual, frágil e ineficiente, centrado en una planilla Excel de más de 200 columnas y 470 filas consolidada mediante "copiar y pegar" desde dos plataformas desconectadas:
*   **BUK:** Plataforma de Recursos Humanos que almacena los contratos, jornadas, altas, bajas y dotación del personal.
*   **SIC (Sistema de Información Clínica):** Plataforma operativa donde los profesionales registran las atenciones ejecutadas.

### Deficiencias Críticas del Modelo Previo
1.  **Fragilidad y Riesgo Operacional:** La manipulación manual de planillas propicia corrupción de fórmulas (`#REF!`), inconsistencias de formato y pérdida de integridad en celdas combinadas.
2.  **Falta de Trazabilidad y Versionado:** Los cambios contractuales o de asignación se marcan con colores o notas al margen, generando múltiples copias desconectadas sin registro histórico de autoría o fecha de vigencia.
3.  **Falta de Visibilidad y Dinamismo:** Las reglas de negocio se encuentran ocultas en tablas de parámetros estáticas; cuando cambia una jornada o dotación, las metas no se recalculan automáticamente hacia el futuro preservando el pasado cerrado.
4.  **Inaccesibilidad:** Las herramientas actuales no cumplen con normativas de diseño universal, impidiendo su uso por parte de colaboradores con discapacidad visual o motriz.

---

## 2. MAPEO Y ANÁLISIS EXHAUSTIVO DE LAS FUENTES DE DATOS

Para construir la solución, se realizó una auditoría profunda de los archivos entregados en el ecosistema del proyecto:

```
+-----------------------------------+------------------------------------+---------------------------------------+
| Archivo Fuente                    | Función en el Ecosistema           | Estado y Vacíos Detectados            |
+-----------------------------------+------------------------------------+---------------------------------------+
| Botathon 2026 - Teletón Práctica  | Set de Pruebas y Validación (RPA)  | Diseñado para fallar intencionalmente.|
|                                   | (Institutes, Professionals,        | No usa códigos definitivos de BUK;    |
|                                   | Planning, Invalid_Records).        | aporta patrones de validación limpia. |
+-----------------------------------+------------------------------------+---------------------------------------+
| Nac - Base contratos x mes.xlsx   | Input Primario Real (Reporte BUK)  | Contiene 3.123 filas (466 personas)   |
|                                   | Hoja 'Dotacion_2026'               | de ene a jul 2026. Fila 1 vacía.     |
|                                   |                                    | Requiere proyectar ago-dic 2026.      |
+-----------------------------------+------------------------------------+---------------------------------------+
| Nac - Planificación Asistencial   | Modelo Actual / Matriz de Reglas   | Sábana de 205 cols con celdas unidas  |
| x mes.xlsx                        | (Dotacion_Asistencial, Parámetros, | y fórmulas rotas. Aporta el diccionario|
|                                   | Distribucion_NAC, Excepciones).    | maestro para el motor de cálculo.     |
+-----------------------------------+------------------------------------+---------------------------------------+
| Reporte Clínico SIC               | Input Secundario Obligatorio       | Vacío en el Kit: No viene provisto.   |
| (No provisto físicamente)         | (Atenciones reales ejecutadas)     | Debe ser generado sintéticamente por  |
|                                   |                                    | el equipo para la comparativa.        |
+-----------------------------------+------------------------------------+---------------------------------------+
```

### Detalle de Estructuras por Hoja

#### A. Nac - Base contratos x mes.xlsx (`Dotacion_2026`)
*   **Volumen:** 3.123 registros entre el 2026-01-01 y el 2026-07-01.
*   **Columnas:** `IT` (Código instituto), `Instituto` (Sigla), `PersonaId`, `Área`, `Nombre Sub-área`, `Centro de Costo`, `Fecha de Nacimiento`, `Periodo`, `Tipo de Contrato`, `Tipo_Trab_161225`, `Fecha Ingreso Compañía`, `Fecha Término`, `Horas Semanales`, `Cargo`, `Tipo_Trabajador`, `Días de la Jornada`, `Reg_SIC`, `Cod_Esp`, `Ndias`.
*   **Particularidad técnica:** Los encabezados comienzan en la **fila 2** (la fila 1 está vacía). En `Fecha Término`, el 98% de los campos son nulos/vacíos (`NaT`), indicando contratos indefinidos vigentes.

#### B. Nac - Planificación Asistencial x mes.xlsx
*   **`Dotacion_Asistencial`:** Matriz de cálculo anual por profesional. Agrupa bloques mensuales con subcolumnas combinadas de Semanas Disponibles, Descuentos (Licencias, Permisos, Vacaciones Legales/Progresivas), Atenciones Semanales y Mensuales.
*   **`Parámetros`:** Homologación de cargos (`Cargo Homologado`), códigos de especialidad (`Cod_Esp`) y días hábiles por mes.
*   **`Distribucion_NAC`:** Porcentajes basales de distribución de jornada por cargo y tramo horario.
*   **`Excepciones`:** Casos especiales de profesionales multi-sede o con variaciones manuales de carga horaria (`H/S`).
*   **`LOP`:** Metas institucionales globales de atenciones por sede.

#### C. Reporte Faltante SIC (Estructura Simulada a Integrar)
Para habilitar la comparación obligatoria *Plan vs. Realizado*, se define el esquema de ingestión para el archivo `SIC_Atenciones_Reales.xlsx`:
*   `Periodo` (Fecha mensual: YYYY-MM-01)
*   `IT` (Código sede)
*   `PersonaId` (Identificador del profesional)
*   `Cod_Esp` (Código de especialidad)
*   `Atenciones_Directas_Reales` (Entero)
*   `Atenciones_Indirectas_Reales` (Entero)

---

## 3. RESOLUCIÓN MATEMÁTICA DE REGLAS DE NEGOCIO (INGENIERÍA INVERSA)

A partir del análisis exhaustivo de los datos fuente, se resuelven de forma estricta las cuatro dudas operacionales planteadas en el requerimiento:

### Duda 1: Asignaciones Especiales vs. Porcentaje NAS
**Resolución:** Las asignaciones especiales **se descuentan además del % NAS base del cargo**. El porcentaje restante (asistencial) se redistribuye manteniendo la proporción relativa original entre Directo e Indirecto.

$$\text{Horas Asistenciales Semanales} = \text{Horas Base} - \text{Horas NAS Base} - \sum \text{Horas Asignaciones Especiales}$$

$$\% \text{NAS Total} = \% \text{NAS Base} + \left( \frac{\sum \text{Horas Asignaciones}}{\text{Jornada Total}} \right)$$

$$\% \text{Asistencial Disponible} = 100\% - \% \text{NAS Total}$$

$$\% \text{Directo Final} = \% \text{Asistencial Disponible} \times \left( \frac{\% \text{Directo Base}}{\% \text{Directo Base} + \% \text{Indirecto Base}} \right)$$

$$\% \text{Indirecto Final} = \% \text{Asistencial Disponible} \times \left( \frac{\% \text{Indirecto Base}}{\% \text{Directo Base} + \% \text{Indirecto Base}} \right)$$

*Validación real en datos:* Fila 5 de la planilla (`PersonaId = 137732`, Fisiatra $40\text{ h}$, Líder de Equipo $2\text{ h}$):  
NAS Base = $20\%$, Asignación = $5\% \rightarrow$ NAS Total = $25\%$. Asistencial = $75\%$.  
Directo Final = $75\% \times (65 / 80) = \mathbf{60.9375\%}$; Indirecto Final = $75\% \times (15 / 80) = \mathbf{14.0625\%}$.

### Duda 2: Tramos de Jornada, Ponderación Anual y Congelamiento Histórico
**Resolución:**
1.  **Tramos Inclusivos (según `Distribucion_NAC`):**
    *   **Tramo 1:** $\ge 40\text{ h}$ semanales.
    *   **Tramo 2:** $\ge 22\text{ h}$ y $< 40\text{ h}$ semanales.
    *   **Tramo 3:** $< 22\text{ h}$ semanales.
2.  **Principio de No Retroactividad:** Si un profesional modifica su jornada a mitad de período (ej. mayo), el contrato se segmenta por intervalos de vigencia (`Periodo Inicio` y `Periodo Fin`). Los meses transcurridos permanecen inmutables en base de datos. El recálculo dinámico rige exclusivamente a partir del mes de vigencia en adelante.

### Duda 3: Conversión de Horas a Atenciones, Atención Grupal y Redondeos
**Resolución secuencial de cálculo:**

1.  **Conversión Semanal Individual (Redondeo hacia abajo truncado con función piso):**
    $$\text{AteDir\_Sem} = \left\lfloor \frac{\text{Horas Semanales} \times \% \text{Directo Final} \times 60}{\text{Minutos Estándar Directa}} \right\rfloor$$
    $$\text{AteInd\_Sem} = \left\lfloor \frac{\text{Horas Semanales} \times \% \text{Indirecto Final} \times 60}{30} \right\rfloor$$

2.  **Ajuste por Atención Grupal:**  
    Aplica exclusivamente a especialidades autorizadas (`AS`, `ED`, `UTAC`, `UEDA`, `ULAB`). Se incrementa la capacidad semanal en función del porcentaje grupal y el multiplicador de pacientes por grupo ($N_{\text{pac}}$, parametrizado en $3.0$ para Santiago/Concepción y $1.5$ para el resto de institutos):
    $$\text{AteDir\_Total\_Sem} = \text{AteDir\_Sem} \times \left[ (1 - \% \text{Grupal}) + (\% \text{Grupal} \times N_{\text{pac}}) \right]$$

3.  **Proyección Mensual y Meta de Gestión (Segundo Redondeo Truncado):**  
    Para cada mes $m$, se deduce a las semanas hábiles base del calendario ($\text{SemHab}_m$) los descuentos de licencias, vacaciones y permisos:
    $$\text{PlanAteDir}_m = \lfloor \text{AteDir\_Total\_Sem} \times \text{SemEfectivas}_m \rfloor$$
    $$\text{MetaGestion\_Dir}_m = \lfloor \text{PlanAteDir}_m \times 0.90 \rfloor$$

### Duda 4: Transición Legal de Jornada 44h a 42h (Mayo 2026)
**Resolución:** En el reporte histórico de BUK, 140 registros con contrato de 44 h pasan automáticamente a 42 h en el período de mayo de 2026.  
*Regla del Sistema:* Si el reporte BUK ya viene actualizado, el bot procesa el cambio de forma nativa. Si se procesa una carga temprana con foto de enero, el motor de reglas aplica forzosamente el tope de 42 h desde el 1 de mayo de 2026, reconociéndolo como un ajuste normativo legal y no como una disminución unilateral de contrato.

---

## 4. ESPECIFICACIÓN DE REQUERIMIENTOS DEL MVP

```
+---------------------------------------------------------------------------------------------------------+
|                                ARQUITECTURA DE LA SOLUCIÓN PROPUESTA                                    |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|   +-----------------------+     +------------------------+                                              |
|   |   Reportes BUK        |     |     Reportes SIC       |                                              |
|   |   (RR.HH. / Contratos)|     |     (Atenciones Reales)|                                              |
|   +-----------+-----------+     +-----------+------------+                                              |
|               |                             |                                                           |
|               +--------------+--------------+                                                           |
|                              |                                                                          |
|                              v                                                                          |
|         +-----------------------------------------+                                                     |
|         |        CORE BLUE PRISM (RPA BOT)        |                                                     |
|         | - Monitoreo automático de archivos      |                                                     |
|         | - Ingesta e higiene de datos            |                                                     |
|         | - Detección de anomalías y rechazos     |                                                     |
|         | - Detección de deltas (Altas/Bajas/42h) |                                                     |
|         | - Publicación hacia Base de Datos       |                                                     |
|         +--------------------+--------------------+                                                     |
|                              |                                                                          |
|                              v                                                                          |
|         +-----------------------------------------+                                                     |
|         |      CAPA DE DATOS Y MOTOR DE REGLAS    |                                                     |
|         | - Base de datos relacional normalizada  |                                                     |
|         | - Tabla de parámetros editables en UI   |                                                     |
|         | - Versionado y auditoría de cambios     |                                                     |
|         | - Motor de proyección matemática (90%)  |                                                     |
|         +--------------------+--------------------+                                                     |
|                              |                                                                          |
|                              v                                                                          |
|         +-----------------------------------------+                                                     |
|         |          DASHBOARD ACCESIBLE            |                                                     |
|         | - Tarjetas de KPI: % FOJA y Metas       |                                                     |
|         | - Tablas de resumen Directa/Ind/NAS     |                                                     |
|         | - Comparativa Plan vs. Real (Alertas)   |                                                     |
|         | - Accesibilidad WCAG 2.1 AA certificada |                                                     |
|         +-----------------------------------------+                                                     |
+---------------------------------------------------------------------------------------------------------+
```

### A. Capacidades del Bot en Blue Prism (Obligatorio)
1.  **Ingesta No Invasiva:** Lectura programada de directorios locales o compartidos para archivos `.xlsx` o `.csv` sin requerir copy-paste de operadores.
2.  **Validación de Calidad de Datos (Módulo de Anomalías):**
    *   Verificación de integridad referencial contra catálogos maestros (`IT` y `Cod_Esp`).
    *   Filtro de valores numéricos absurdos ($<0\text{ h}$, nulos, textos alfanuméricos, jornadas $>44\text{ h}$ o $>42\text{ h}$).
    *   Detección de duplicados en clave primaria compuesta `[PersonaId + IT + Periodo]`.
    *   Generación de reporte automático de logs y excepciones de negocio (`Rejected_Records_Report.xlsx`).
3.  **Detección Automática de Deltas:** Identificación de diferencias entre la carga mensual y el estado previo en base de datos: altas de personal, desvinculaciones y modificaciones de jornada semanal.
4.  **Trazabilidad:** Generación de un identificador único por lote procesado con registro de timestamp y cálculo de tiempo de ejecución.

### B. Módulo de Parametrización (Reglas Sin Código)
La interfaz debe disponer de una sección administrativa donde los planificadores puedan:
*   Ajustar porcentajes base de Directa, Indirecta y NAS por cada cargo y tramo.
*   Modificar los minutos estándar por atención (30, 40, 45, 60 min).
*   Configurar el catálogo de asignaciones especiales (horas y requerimiento de V°B° de Dirección Médica Nacional).
*   Simular escenarios activando o desactivando la inclusión de vacantes presupuestadas.

### C. Dashboard Interactivo y KPIs Requeridos
1.  **Filtros Globales Dinámicos:** Selector por Instituto, Mes, Cargo y Especialidad.
2.  **KPIs Esenciales:**
    *   **Meta de Gestión Asistencial:** Sumatoria de atenciones directas proyectadas al 90%.
    *   **% FOJA (Factor de Ocupación de Jornada Asistencial):**
        $$\% \text{FOJA} = \left( \frac{\text{Horas Mensuales Disponibles para Atención Directa}}{\text{Horas Mensuales Contratadas}} \right) \times 100$$
    *   **Desglose de Capacidad Semanal:** Tarjetas con la suma agregada de Horas Totales, Horas Directas, Horas Indirectas y Horas NAS.
    *   **Monitoreo de Desviación Plan vs. Real:** Indicador porcentual de cumplimiento cruzando las atenciones del plan con las registradas en SIC.

### D. Requisitos de Accesibilidad Universal e Inclusión (WCAG 2.1 Nivel AA)
*   **Contraste y Doble Codificación:** Prohibición estricta de usar únicamente colores para señalar estados. Todo indicador de alerta o error debe incluir íconos vectoriales y etiquetas de texto explícitas (ej. `[⚠️ Error: Jornada Negativa]`, `[📉 Déficit de Cobertura]`).
*   **Tipografía y Lectura Fácil:** Empleo de fuentes sans-serif legibles (`Roboto` o `Verdana`) con tamaño base superior a `16px`, sin texto justificado para evitar barreras cognitivas o problemas en usuarios con dislexia.
*   **Navegación Teclado Integral:** Recorrido funcional del 100% de la interfaz mediante tabulación secuencial (`Tab`, `Shift+Tab`, `Enter`, `Escape`), garantizando estados de foco visibles (`:focus-visible`).
*   **Lectores de Pantalla:** Semántica HTML5 nativa (`<main>`, `<nav>`, `<section>`, `<table>`), encabezados ordenados (`<h1>` a `<h3>`) y atributos `aria-label` claros en controles interactivos.

---

## 5. GUION ESTRATÉGICO PARA PRESENTACIÓN Y DEMOSTRACIÓN EN VIVO

Para maximizar el puntaje de la rúbrica oficial, el equipo debe ejecutar una presentación coordinada dividida en dos bloques estrictos:

```
TIEMPO TOTAL: 8 MINUTOS
+-------------------------------------------------------------+
| BLOQUE 1: PITCH DE PRESENTACIÓN TÉCNICA (3 MINUTOS)         |
+-------------------------------------------------------------+
| 00:00 - 00:45 | Introducción del problema: El costo de los  |
|               | errores manuales en la salud de los niños.  |
| 00:45 - 01:45 | Exposición de la Lámina de Arquitectura:     |
|               | Blue Prism como corazón de datos + UI Web.  |
| 01:45 - 02:30 | Innovación en Accesibilidad Universal y     |
|               | resolución de vacíos matemáticos.           |
| 02:30 - 03:00 | Declaración de uso transparente de IA.       |
+-------------------------------------------------------------+
| BLOQUE 2: DEMOSTRACIÓN EN VIVO DEL MVP (5 MINUTOS)          |
+-------------------------------------------------------------+
| 00:00 - 01:00 | Paso 1: Estado inicial del Dashboard.       |
|               | Visibilidad de % FOJA, metas y accesibilidad|
| 01:00 - 02:15 | Paso 2: Ejecución Blue Prism - Calidad Datos|
|               | Ingestión con anomalías y log de rechazos.  |
| 02:15 - 03:45 | Paso 3: Ejecución Blue Prism - Deltas       |
|               | Carga de mayo (42h, altas y multi-sede).    |
| 03:45 - 05:00 | Paso 4: Ajuste de Parámetros y Plan vs Real |
|               | Modificación en vivo y cruce contra SIC.    |
+-------------------------------------------------------------+
```

### Detalle de los Pasos de la Demostración

#### Paso 1: Dashboard Inicial y Accesibilidad (1:00 min)
*   Se proyecta el Dashboard cargado con los datos de enero a abril de 2026.
*   Se demuestra la navegación íntegra usando la tecla `Tab` sin tocar el ratón.
*   Se destacan los KPIs obligatorios: Total Horas Contratadas, Horas Directas, Horas NAS, Meta de Gestión al 90% y el **% FOJA**.

#### Paso 2: Resiliencia de Blue Prism y Control de Anomalías (1:15 min)
*   Se deposita en la carpeta de entrada un archivo BUK corrupto que contiene intencionalmente los errores de `Invalid_Records` (jornada de -44 h, texto "Tres Cientos", código de sede inexistente).
*   Se ejecuta el proceso en Blue Prism Studio mostrando el flujo de decisión.
*   El bot descarta los registros viciados sin detener el proceso y genera el reporte `Rejected_Records.xlsx`, demostrando estabilidad absoluta.

#### Paso 3: Detección Automática de Deltas y Transición Legal a 42 Horas (1:30 min)
*   Se carga el archivo correspondiente a mayo de 2026 conteniendo una nueva contratación, un médico multi-instituto (Antofagasta/Calama) y la reducción obligatoria de jornada a 42 horas.
*   El bot detecta de forma inteligente los cambios, registra el versionado histórico y dispara el recálculo afectando exclusivamente desde el período de mayo en adelante.
*   En el Dashboard se muestra la comparativa visual "Antes vs. Después" del instituto seleccionado.

#### Paso 4: Motor de Reglas en Pantalla y Comparativa SIC (1:15 min)
*   Desde la vista administrativa del Dashboard, se edita un parámetro de asignación especial (ej. Líder de Equipo a 3 horas) o se ajusta un porcentaje directo.
*   Se observa cómo los indicadores se recalculan en tiempo real sin requerir modificaciones en el código fuente.
*   Se activa la capa de cruce con el reporte **SIC**, visualizando gráficos de desviación que indican si cada especialidad se encuentra en déficit o superávit asistencial.

---

## 6. CONCLUSIONES Y BENEFICIOS ESPERADOS

1.  **Erradicación del Error Humano:** Supresión absoluta del copiado y pegado manual, asegurando un 100% de coherencia en los datos maestros.
2.  **Cumplimiento Normativo Inmediato:** Automatización completa de la rebaja de jornada legal a 42 horas sin distorsión de los indicadores contractuales previos.
3.  **Gobernanza y Transparencia:** Trazabilidad integral de modificaciones con historial auditable y segregación de perfiles de usuario.
4.  **Impacto Social y Ético:** Cumplimiento de estándares internacionales de inclusión digital, garantizando una herramienta operativa accesible para toda la comunidad Teletón.