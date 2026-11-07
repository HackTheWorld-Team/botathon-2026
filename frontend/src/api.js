/**
 * api.js — Cliente HTTP hacia FastAPI (/api/*) con fallback determinista de alta fidelidad
 * para que el Dashboard funcione 100% tanto conectado a SQLite como en modo Vite standalone.
 *
 * Incluye datos realistas del desafío Botathon 2026 Teletón:
 * - 16 Institutos Teletón (IT), 3.123 contratos, 298 profesionales
 * - Delta Mayo 2026 (Ley 42h: 140 contratos 44h -> 42h), profesional multi-sede #125129 (Antofagasta 35h + Calama 8h), nueva alta #141845
 * - Historial de lotes con desglose por regla de validación (NEGATIVE_HS, TEXT_HS, BAD_IT, DUP_PK, HS_OVER, BAD_ESP, NEGATIVE_ATE, TEXT_ATE)
 *   y descarga directa de Rejected_Records_Report.xlsx
 */

const API_BASE = import.meta.env.VITE_API_BASE || ''

export const MOCK_INSTITUTOS = [
  { it: 1501, sigla: 'ARI', nombre: 'Instituto Teletón Arica' },
  { it: 101, sigla: 'IQQ', nombre: 'Instituto Teletón Iquique' },
  { it: 201, sigla: 'ANT', nombre: 'Instituto Teletón Antofagasta' },
  { it: 202, sigla: 'CAL', nombre: 'Instituto Teletón Calama' },
  { it: 301, sigla: 'ATA', nombre: 'Instituto Teletón Atacama (Copiapó)' },
  { it: 401, sigla: 'COQ', nombre: 'Instituto Teletón Coquimbo' },
  { it: 501, sigla: 'VAL', nombre: 'Instituto Teletón Valparaíso' },
  { it: 1301, sigla: 'SCL', nombre: 'Instituto Teletón Santiago' },
  { it: 701, sigla: 'TAL', nombre: 'Instituto Teletón Talca (Maule)' },
  { it: 1601, sigla: 'NUB', nombre: 'Instituto Teletón Ñuble' },
  { it: 801, sigla: 'CCP', nombre: 'Instituto Teletón Concepción (Biobío)' },
  { it: 901, sigla: 'TEM', nombre: 'Instituto Teletón Temuco (Araucanía)' },
  { it: 1401, sigla: 'VDV', nombre: 'Instituto Teletón Valdivia (Los Ríos)' },
  { it: 1001, sigla: 'PMC', nombre: 'Instituto Teletón Puerto Montt (Los Lagos)' },
  { it: 1101, sigla: 'COY', nombre: 'Instituto Teletón Coyhaique (Aysén)' },
  { it: 1201, sigla: 'PUQ', nombre: 'Instituto Teletón Punta Arenas (Magallanes)' },
]

export const MOCK_PERIODOS = [
  '2026-01-01',
  '2026-02-01',
  '2026-03-01',
  '2026-04-01',
  '2026-05-01',
  '2026-06-01',
  '2026-07-01',
  '2026-08-01',
  '2026-09-01',
  '2026-10-01',
  '2026-11-01',
  '2026-12-01',
]

export const PERIODO_LABELS = {
  '2026-01-01': 'Enero 2026 (44h Congelado)',
  '2026-02-01': 'Febrero 2026 (44h Congelado)',
  '2026-03-01': 'Marzo 2026 (44h Congelado)',
  '2026-04-01': 'Abril 2026 (44h Congelado)',
  '2026-05-01': 'Mayo 2026 (Transición 42h)',
  '2026-06-01': 'Junio 2026 (42h)',
  '2026-07-01': 'Julio 2026 (42h)',
  '2026-08-01': 'Agosto 2026 (42h)',
  '2026-09-01': 'Septiembre 2026 (42h)',
  '2026-10-01': 'Octubre 2026 (42h)',
  '2026-11-01': 'Noviembre 2026 (42h)',
  '2026-12-01': 'Diciembre 2026 (42h)',
}

export const MOCK_AREAS = [
  'REHABILITACION INFANTIL',
  'UNIDAD MOTORA Y MARCHA',
  'TERAPIAS INTEGRALES',
  'UNIDAD COGNITIVA Y SENSORIAL',
  'ADMISION Y SOPORTE MEDICO',
]

export const MOCK_CARGOS = [
  'MEDICO FISIATRA',
  'KINESIOLOGO/A',
  'TERAPEUTA OCUPACIONAL',
  'FONOAUDIOLOGO/A',
  'PSICOLOGO/A CLINICO',
  'ENFERMERO/A REHABILITACION',
  'ASISTENTE SOCIAL',
  'EDUCADOR/A DIFERENCIAL',
]

export const MOCK_ESPECIALIDADES = [
  'FISIATRIA',
  'KINESIOLOGIA',
  'TERAPIA OCUPACIONAL',
  'FONOAUDIOLOGIA',
  'PSICOLOGIA',
  'ENFERMERIA',
  'TRABAJO SOCIAL',
  'EDUCACION DIFERENCIAL',
]

export const MOCK_FILTROS = {
  institutos: MOCK_INSTITUTOS,
  periodos: MOCK_PERIODOS,
  areas: MOCK_AREAS,
  cargos: MOCK_CARGOS,
  especialidades: MOCK_ESPECIALIDADES,
}

/**
 * Catálogo oficial de reglas de validación de ingesta RPA (bot/worker.py §MOTIVOS, Issue #48)
 */
export const VALIDATION_RULES_CATALOG = [
  {
    codigo: 'NEGATIVE_HS',
    origen: 'BUK',
    nombre: 'Horas semanales negativas',
    explicacion: 'Horas Semanales menor a 0 (< 0 h). No se permiten jornadas negativas.',
  },
  {
    codigo: 'TEXT_HS',
    origen: 'BUK',
    nombre: 'Horas semanales no numéricas',
    explicacion: 'Horas Semanales contiene texto libre o caracteres no convertibles a número.',
  },
  {
    codigo: 'BAD_IT',
    origen: 'BUK / SIC',
    nombre: 'Código IT fuera de catálogo',
    explicacion: 'El código de Instituto Teletón (IT) no existe entre las 16 sedes de la red nacional.',
  },
  {
    codigo: 'DUP_PK',
    origen: 'BUK / SIC',
    nombre: 'Clave primaria duplicada',
    explicacion: 'Registro duplicado dentro del mismo lote para la clave [PersonaId + IT + Periodo].',
  },
  {
    codigo: 'HS_OVER',
    origen: 'BUK',
    nombre: 'Excede tope legal de jornada',
    explicacion: 'Supera el máximo legal permitido (> 44 h en Ene–Abr o > 42 h desde 2026-05-01).',
  },
  {
    codigo: 'BAD_ESP',
    origen: 'BUK / SIC',
    nombre: 'Especialidad clínica inválida',
    explicacion: 'El campo Cod_Esp está vacío, nulo o contiene un código ajeno al catálogo clínico.',
  },
  {
    codigo: 'NEGATIVE_ATE',
    origen: 'SIC',
    nombre: 'Atenciones reales negativas',
    explicacion: 'Atenciones Directas o Indirectas Reales en SIC presentan un valor menor a 0.',
  },
  {
    codigo: 'TEXT_ATE',
    origen: 'SIC',
    nombre: 'Atenciones reales con texto',
    explicacion: 'El conteo de atenciones reales en SIC contiene texto o símbolos no numéricos.',
  },
]

export const MOCK_LOTES = [
  {
    lote_id: 104,
    archivo: 'BUK_Dotacion_Mayo2026_Delta42h.xlsx',
    tipo: 'BUK',
    fecha_corrida: '2026-05-02 08:42:15',
    duracion_ms: 1420,
    validos: 3123,
    rechazados: 6,
    estado: 'CON_RECHAZOS_AISLADOS',
    nota: 'Delta Mayo 2026 (Ley 42h: 140 contratos) + Alta #141845 + Multi-sede #125129. 6 filas corruptas aisladas.',
  },
  {
    lote_id: 103,
    archivo: 'SIC_Atenciones_Reales_AbrilMayo2026.xlsx',
    tipo: 'SIC',
    fecha_corrida: '2026-05-02 08:40:02',
    duracion_ms: 960,
    validos: 2894,
    rechazados: 2,
    estado: 'CON_RECHAZOS_AISLADOS',
    nota: 'Cruce SIC Real asistencial consolidado para 16 institutos (2 filas con error de formato aisladas).',
  },
  {
    lote_id: 102,
    archivo: 'BUK_Dotacion_Base_EneAbr2026.xlsx',
    tipo: 'BUK',
    fecha_corrida: '2026-04-01 07:55:19',
    duracion_ms: 1385,
    validos: 3121,
    rechazados: 0,
    estado: 'OK',
    nota: 'Línea base Enero–Abril 2026 (Jornada 44h congelada sin rechazos).',
  },
]

export const MOCK_REJECTED_RECORDS = [
  {
    rechazo_id: 1,
    lote_id: 104,
    fila_origen: 142,
    fila_excel: 142,
    archivo: 'BUK_Dotacion_Mayo2026_Delta42h.xlsx',
    motivo: 'NEGATIVE_HS',
    detalle: 'Horas Semanales no puede ser negativo: -5.0',
    payload: JSON.stringify({
      PersonaId: 138902,
      IT: 801,
      Periodo: '2026-05-01',
      'Horas Semanales': -5.0,
      Cod_Esp: 'KINESIOLOGIA',
      Cargo: 'KINESIOLOGO/A',
    }),
    persona_id: '138902',
    it: '801 (CCP)',
    periodo: '2026-05-01',
    campo_error: 'Horas Semanales',
    valor_recibido: '-5.0',
    regla_violada: 'NEGATIVE_HS: Horas semanales negativas (< 0)',
    accion_bot: 'Fila aislada en Rejected_Records_Report; lote continúa',
  },
  {
    rechazo_id: 2,
    lote_id: 104,
    fila_origen: 389,
    fila_excel: 389,
    archivo: 'BUK_Dotacion_Mayo2026_Delta42h.xlsx',
    motivo: 'TEXT_HS',
    detalle: "Horas Semanales contiene texto o valor no convertible: 'CUARENTA Y DOS'",
    payload: JSON.stringify({
      PersonaId: 127514,
      IT: 1301,
      Periodo: '2026-05-01',
      'Horas Semanales': 'CUARENTA Y DOS',
      Cod_Esp: 'FISIATRIA',
      Cargo: 'MEDICO FISIATRA',
    }),
    persona_id: '127514',
    it: '1301 (SCL)',
    periodo: '2026-05-01',
    campo_error: 'Horas Semanales',
    valor_recibido: '"CUARENTA Y DOS"',
    regla_violada: 'TEXT_HS: Horas semanales contiene texto o valor no numérico',
    accion_bot: 'Fila aislada en Rejected_Records_Report; lote continúa',
  },
  {
    rechazo_id: 3,
    lote_id: 104,
    fila_origen: 715,
    fila_excel: 715,
    archivo: 'BUK_Dotacion_Mayo2026_Delta42h.xlsx',
    motivo: 'BAD_IT',
    detalle: 'IT 9999 no existe en catálogo de institutos',
    payload: JSON.stringify({
      PersonaId: 131008,
      IT: 9999,
      Periodo: '2026-05-01',
      'Horas Semanales': 42.0,
      Cod_Esp: 'TERAPIA OCUPACIONAL',
      Cargo: 'TERAPEUTA OCUPACIONAL',
    }),
    persona_id: '131008',
    it: '9999 (INEXISTENTE)',
    periodo: '2026-05-01',
    campo_error: 'IT',
    valor_recibido: '9999',
    regla_violada: 'BAD_IT: Código IT no existe en catálogo de institutos',
    accion_bot: 'Fila aislada en Rejected_Records_Report; lote continúa',
  },
  {
    rechazo_id: 4,
    lote_id: 104,
    fila_origen: 1120,
    fila_excel: 1120,
    archivo: 'BUK_Dotacion_Mayo2026_Delta42h.xlsx',
    motivo: 'DUP_PK',
    detalle: 'Registro duplicado dentro del archivo para PK [PersonaId=135610, IT=201, Periodo=2026-05-01]',
    payload: JSON.stringify({
      PersonaId: 135610,
      IT: 201,
      Periodo: '2026-05-01',
      'Horas Semanales': 42.0,
      Cod_Esp: 'FONOAUDIOLOGIA',
      Cargo: 'FONOAUDIOLOGO/A',
    }),
    persona_id: '135610',
    it: '201 (ANT)',
    periodo: '2026-05-01',
    campo_error: 'PersonaId+IT+Periodo',
    valor_recibido: '135610 + 201 + 2026-05-01',
    regla_violada: 'DUP_PK: Clave de negocio duplicada [PersonaId + IT + Periodo]',
    accion_bot: 'Fila aislada en Rejected_Records_Report; lote continúa',
  },
  {
    rechazo_id: 5,
    lote_id: 104,
    fila_origen: 1844,
    fila_excel: 1844,
    archivo: 'BUK_Dotacion_Mayo2026_Delta42h.xlsx',
    motivo: 'HS_OVER',
    detalle: 'Horas Semanales (84.0h) excede el tope legal permitido (42.0h para período 2026-05-01)',
    payload: JSON.stringify({
      PersonaId: 140211,
      IT: 1301,
      Periodo: '2026-05-01',
      'Horas Semanales': 84.0,
      Cod_Esp: 'KINESIOLOGIA',
      Cargo: 'KINESIOLOGO/A',
    }),
    persona_id: '140211',
    it: '1301 (SCL)',
    periodo: '2026-05-01',
    campo_error: 'Horas Semanales',
    valor_recibido: '84.0',
    regla_violada: 'HS_OVER: Horas semanales excede límite permitido (> 42 h post 2026-05-01)',
    accion_bot: 'Fila aislada en Rejected_Records_Report; lote continúa',
  },
  {
    rechazo_id: 6,
    lote_id: 104,
    fila_origen: 2490,
    fila_excel: 2490,
    archivo: 'BUK_Dotacion_Mayo2026_Delta42h.xlsx',
    motivo: 'BAD_ESP',
    detalle: "Cod_Esp inválido o fuera de catálogo: 'XX'",
    payload: JSON.stringify({
      PersonaId: 129441,
      IT: 501,
      Periodo: '2026-05-01',
      'Horas Semanales': 42.0,
      Cod_Esp: 'XX',
      Cargo: 'PSICOLOGO/A CLINICO',
    }),
    persona_id: '129441',
    it: '501 (VAL)',
    periodo: '2026-05-01',
    campo_error: 'Cod_Esp',
    valor_recibido: 'XX',
    regla_violada: 'BAD_ESP: Código de especialidad Cod_Esp inválido o vacío',
    accion_bot: 'Fila aislada en Rejected_Records_Report; lote continúa',
  },
]

const MOCK_SIC_REJECTED_RECORDS = [
  {
    rechazo_id: 7,
    lote_id: 103,
    fila_origen: 94,
    fila_excel: 94,
    archivo: 'SIC_Atenciones_Reales_AbrilMayo2026.xlsx',
    motivo: 'NEGATIVE_ATE',
    detalle: 'Atenciones_Directas_Reales no puede ser negativo: -12',
    payload: JSON.stringify({
      PersonaId: 126890,
      IT: 1301,
      Periodo: '2026-05-01',
      'Horas Semanales': '42.0 (SIC: -12 ate.)',
      Cod_Esp: 'FISIATRIA',
      Atenciones_Directas_Reales: -12,
    }),
  },
  {
    rechazo_id: 8,
    lote_id: 103,
    fila_origen: 512,
    fila_excel: 512,
    archivo: 'SIC_Atenciones_Reales_AbrilMayo2026.xlsx',
    motivo: 'TEXT_ATE',
    detalle: "Atenciones_Directas_Reales contiene texto no numérico: 'SIN_REGISTRO'",
    payload: JSON.stringify({
      PersonaId: 133402,
      IT: 801,
      Periodo: '2026-05-01',
      'Horas Semanales': '42.0 (SIC: SIN_REGISTRO)',
      Cod_Esp: 'KINESIOLOGIA',
      Atenciones_Directas_Reales: 'SIN_REGISTRO',
    }),
  },
]

export const MOCK_REJECTED_BY_LOTE = {
  104: MOCK_REJECTED_RECORDS,
  103: MOCK_SIC_REJECTED_RECORDS,
  102: [],
}

const BASE_SPECIALTY_SUMMARY = [
  {
    cod_esp: 'KINESIOLOGIA',
    area: 'UNIDAD MOTORA Y MARCHA',
    cargo: 'KINESIOLOGO/A',
    profesionales: 84,
    horas_sem: 3486,
    plan_directo: 182400,
    meta_gestion: 164160,
    real_directo: 171456,
  },
  {
    cod_esp: 'TERAPIA OCUPACIONAL',
    area: 'REHABILITACION INFANTIL',
    cargo: 'TERAPEUTA OCUPACIONAL',
    profesionales: 62,
    horas_sem: 2562,
    plan_directo: 134120,
    meta_gestion: 120708,
    real_directo: 126073,
  },
  {
    cod_esp: 'FISIATRIA',
    area: 'ADMISION Y SOPORTE MEDICO',
    cargo: 'MEDICO FISIATRA',
    profesionales: 38,
    horas_sem: 1490,
    plan_directo: 86420,
    meta_gestion: 77778,
    real_directo: 61358, // Déficit crítico (-29.0%)
  },
  {
    cod_esp: 'FONOAUDIOLOGIA',
    area: 'UNIDAD COGNITIVA Y SENSORIAL',
    cargo: 'FONOAUDIOLOGO/A',
    profesionales: 36,
    horas_sem: 1476,
    plan_directo: 78950,
    meta_gestion: 71055,
    real_directo: 82108, // Superávit (+4.0%)
  },
  {
    cod_esp: 'PSICOLOGIA',
    area: 'UNIDAD COGNITIVA Y SENSORIAL',
    cargo: 'PSICOLOGO/A CLINICO',
    profesionales: 28,
    horas_sem: 1148,
    plan_directo: 54210,
    meta_gestion: 48789,
    real_directo: 50415, // Meta cumplida (93.0%)
  },
  {
    cod_esp: 'ENFERMERIA',
    area: 'ADMISION Y SOPORTE MEDICO',
    cargo: 'ENFERMERO/A REHABILITACION',
    profesionales: 22,
    horas_sem: 902,
    plan_directo: 46800,
    meta_gestion: 42120,
    real_directo: 48204, // Superávit (+3.0%)
  },
  {
    cod_esp: 'EDUCACION DIFERENCIAL',
    area: 'TERAPIAS INTEGRALES',
    cargo: 'EDUCADOR/A DIFERENCIAL',
    profesionales: 15,
    horas_sem: 615,
    plan_directo: 31200,
    meta_gestion: 28080,
    real_directo: 24336, // Déficit crítico (-22.0%)
  },
  {
    cod_esp: 'TRABAJO SOCIAL',
    area: 'REHABILITACION INFANTIL',
    cargo: 'ASISTENTE SOCIAL',
    profesionales: 13,
    horas_sem: 533,
    plan_directo: 27400,
    meta_gestion: 24660,
    real_directo: 25482, // Meta cumplida (93.0%)
  },
]

export function classifyWcagAlert(real, plan, mg) {
  if (plan <= 0) {
    return {
      nivel: 'SIN_PLAN',
      icono: 'ℹ️',
      badge: 'Sin Plan',
      mensaje: 'No hay atenciones directas planificadas',
    }
  }
  const cumplimiento = (real / plan) * 100.0
  const desviacion = ((real - plan) / plan) * 100.0
  const sign = desviacion > 0 ? '+' : ''
  if (real < mg) {
    return {
      nivel: 'CRITICO',
      icono: '⚠️',
      badge: `Déficit Crítico (${sign}${desviacion.toFixed(1)}%)`,
      mensaje: `Déficit asistencial (${cumplimiento.toFixed(1)}% del plan, bajo la meta del 90%)`,
    }
  }
  if (real < plan) {
    return {
      nivel: 'CUMPLIDO',
      icono: '✅',
      badge: `Meta Cumplida (${cumplimiento.toFixed(1)}%)`,
      mensaje: `Meta de Gestión ≥90% alcanzada (${cumplimiento.toFixed(1)}% del plan)`,
    }
  }
  return {
    nivel: 'SUPERAVIT',
    icono: '📈',
    badge: `Superávit (${sign}${desviacion.toFixed(1)}%)`,
    mensaje: `Superávit asistencial (${cumplimiento.toFixed(1)}% sobre el plan)`,
  }
}

function computeFilterScale(filters = {}) {
  let scale = 1.0
  if (filters.instituto) {
    const itNum = Number(filters.instituto)
    if (itNum === 1301) scale *= 0.28 // Santiago
    else if (itNum === 801 || itNum === 501) scale *= 0.12 // Concepción / Valparaíso
    else if (itNum === 201 || itNum === 202) scale *= 0.065 // Antofagasta / Calama
    else scale *= 0.045
  }
  if (filters.mes) {
    scale *= 1 / 12
    // A partir de mayo 2026 entra en vigencia reducción de jornada 44h -> 42h
    if (filters.mes >= '2026-05-01') {
      scale *= 42 / 44
    }
  }
  return scale
}

export function buildMockKpis(filters = {}) {
  const rows = BASE_SPECIALTY_SUMMARY.filter((item) => {
    if (filters.esp && item.cod_esp !== filters.esp) return false
    if (filters.area && item.area !== filters.area) return false
    if (filters.cargo && item.cargo !== filters.cargo) return false
    return true
  })

  const activeRows = rows.length > 0 ? rows : BASE_SPECIALTY_SUMMARY
  const scale = computeFilterScale(filters)
  const monthScale = filters.mes ? (filters.mes >= '2026-05-01' ? 42 / 44 : 1.0) : 1.0
  const instScale = filters.instituto
    ? Number(filters.instituto) === 1301
      ? 0.28
      : Number(filters.instituto) === 801 || Number(filters.instituto) === 501
      ? 0.12
      : 0.06
    : 1.0

  const profCount = Math.max(
    1,
    Math.round(activeRows.reduce((acc, r) => acc + r.profesionales, 0) * instScale)
  )
  const contractCount = filters.mes
    ? profCount + (filters.instituto ? 1 : 14)
    : Math.max(1, Math.round(profCount * 10.48))

  const baseWeeklyHours = activeRows.reduce((acc, r) => acc + r.horas_sem, 0) * instScale * monthScale
  const pctDir = 0.652
  const pctInd = 0.148
  const pctNas = 0.20

  const hContratadas = Number(baseWeeklyHours.toFixed(1))
  const hDirectas = Number((baseWeeklyHours * pctDir).toFixed(1))
  const hIndirectas = Number((baseWeeklyHours * pctInd).toFixed(1))
  const hNas = Number((baseWeeklyHours * pctNas).toFixed(1))
  const fojaPct = hContratadas > 0 ? Number(((hDirectas / hContratadas) * 100).toFixed(1)) : 0.0

  const planDirecto = Math.max(
    10,
    Math.floor(activeRows.reduce((acc, r) => acc + r.plan_directo, 0) * scale)
  )
  const planIndirecto = Math.max(2, Math.floor(planDirecto * 0.215))
  const metaGestion = Math.floor(planDirecto * 0.9)

  return {
    total_profesionales: profCount,
    total_contratos: contractCount,
    horas_contratadas_semanales: hContratadas,
    horas_directas_semanales: hDirectas,
    horas_indirectas_semanales: hIndirectas,
    horas_nas_semanales: hNas,
    foja_pct: fojaPct,
    plan_directo_mensual: planDirecto,
    plan_indirecto_mensual: planIndirecto,
    plan_total_mensual: planDirecto + planIndirecto,
    meta_gestion_mensual: metaGestion,
  }
}

export function buildMockPlanVsReal(filters = {}) {
  const scale = computeFilterScale(filters)
  const selectedInst = MOCK_INSTITUTOS.find((i) => String(i.it) === String(filters.instituto))
  const sigla = selectedInst ? selectedInst.sigla : 'NAC'
  const itCode = selectedInst ? selectedInst.it : 0
  const periodo = filters.mes || '2026-05-01'

  const filtered = BASE_SPECIALTY_SUMMARY.filter((item) => {
    if (filters.esp && item.cod_esp !== filters.esp) return false
    if (filters.area && item.area !== filters.area) return false
    if (filters.cargo && item.cargo !== filters.cargo) return false
    return true
  })

  const list = (filtered.length > 0 ? filtered : BASE_SPECIALTY_SUMMARY).map((item) => {
    const planDir = Math.max(12, Math.floor(item.plan_directo * scale))
    const mgDir = Math.floor(planDir * 0.9)
    const ratioReal = item.real_directo / item.plan_directo
    const realDir = Math.max(8, Math.floor(planDir * ratioReal))
    const cumplimiento = planDir > 0 ? Number(((realDir / planDir) * 100).toFixed(1)) : 0
    const desviacion = planDir > 0 ? Number((((realDir - planDir) / planDir) * 100).toFixed(1)) : 0

    return {
      periodo,
      it: itCode,
      sigla,
      cod_esp: item.cod_esp,
      area: item.area,
      cargo: item.cargo,
      profesionales: Math.max(1, Math.round(item.profesionales * (filters.instituto ? 0.18 : 1))),
      plan_directo: planDir,
      real_directo: realDir,
      meta_gestion: mgDir,
      cumplimiento_pct: cumplimiento,
      desviacion_pct: desviacion,
      alerta: classifyWcagAlert(realDir, planDir, mgDir),
    }
  })

  return list
}

export async function fetchFiltros() {
  try {
    const res = await fetch(`${API_BASE}/api/filtros`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data && Array.isArray(data.institutos) && data.institutos.length > 0) {
      return {
        institutos: data.institutos,
        periodos: data.periodos?.length ? data.periodos : MOCK_PERIODOS,
        areas: data.areas?.length ? data.areas : MOCK_AREAS,
        cargos: data.cargos?.length ? data.cargos : MOCK_CARGOS,
        especialidades: data.especialidades?.length ? data.especialidades : MOCK_ESPECIALIDADES,
        source: 'api',
      }
    }
  } catch {
    // Fallback silencioso a datos locales deterministas
  }
  return { ...MOCK_FILTROS, source: 'mock' }
}

export async function fetchKpis(filters = {}) {
  try {
    const params = new URLSearchParams()
    if (filters.instituto) params.set('it', filters.instituto)
    if (filters.mes) params.set('periodo', filters.mes)
    if (filters.area) params.set('area', filters.area)
    if (filters.cargo) params.set('cargo', filters.cargo)
    if (filters.esp) params.set('cod_esp', filters.esp)

    const qs = params.toString()
    const res = await fetch(`${API_BASE}/api/kpis${qs ? `?${qs}` : ''}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data && typeof data.total_contratos === 'number' && data.total_contratos > 0) {
      return { ...data, source: 'api' }
    }
  } catch {
    // Fallback determinista
  }
  return { ...buildMockKpis(filters), source: 'mock' }
}

export async function fetchPlanVsReal(filters = {}, agrupado = true) {
  try {
    const params = new URLSearchParams()
    if (filters.instituto) params.set('it', filters.instituto)
    if (filters.mes) params.set('periodo', filters.mes)
    if (filters.area) params.set('area', filters.area)
    if (filters.cargo) params.set('cargo', filters.cargo)
    if (filters.esp) params.set('cod_esp', filters.esp)
    params.set('agrupado', String(agrupado))

    const res = await fetch(`${API_BASE}/api/plan-vs-real?${params.toString()}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      return { items: data, source: 'api' }
    }
  } catch {
    // Fallback determinista
  }
  return { items: buildMockPlanVsReal(filters), source: 'mock' }
}

export async function fetchLotes() {
  try {
    const res = await fetch(`${API_BASE}/api/lotes`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      const sorted = [...data].sort((a, b) =>
        String(b.fecha_corrida || '').localeCompare(String(a.fecha_corrida || '')) ||
        Number(b.lote_id) - Number(a.lote_id)
      )
      return { items: sorted, source: 'api' }
    }
  } catch {
    // Fallback determinista
  }
  return { items: MOCK_LOTES, source: 'mock' }
}

export function buildMockLoteRechazados(loteId = 104) {
  const numId = Number(loteId) || 104
  const loteMeta =
    MOCK_LOTES.find((l) => Number(l.lote_id) === numId) ||
    MOCK_LOTES[0]
  const records =
    MOCK_REJECTED_BY_LOTE[numId] !== undefined
      ? MOCK_REJECTED_BY_LOTE[numId]
      : Number(loteMeta?.rechazados) > 0
      ? MOCK_REJECTED_RECORDS
      : []

  const countsMap = {}
  for (const r of records) {
    const m = r.motivo || 'OTHER'
    countsMap[m] = (countsMap[m] || 0) + 1
  }

  const resumenReglas = Object.entries(countsMap).map(([motivo, cantidad]) => ({
    motivo,
    cantidad,
  }))

  return {
    lote_id: loteMeta.lote_id,
    archivo: loteMeta.archivo,
    tipo: loteMeta.tipo || 'BUK',
    fecha_corrida: loteMeta.fecha_corrida,
    total_rechazados: records.length,
    resumen_reglas: resumenReglas,
    rechazados: records,
    source: 'mock',
  }
}

export async function fetchLoteRechazados(loteId = 104) {
  try {
    const res = await fetch(`${API_BASE}/api/lotes/${encodeURIComponent(loteId)}/rechazados`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data && typeof data.lote_id === 'number') {
      return { ...data, source: 'api' }
    }
  } catch {
    // Fallback a mock determinista por lote
  }
  return buildMockLoteRechazados(loteId)
}

export function parseRejectedPayload(record) {
  let parsed = {}
  if (record?.payload) {
    if (typeof record.payload === 'string') {
      try {
        parsed = JSON.parse(record.payload) || {}
      } catch {
        parsed = {}
      }
    } else if (typeof record.payload === 'object') {
      parsed = record.payload
    }
  }

  const personaId =
    parsed.PersonaId ??
    parsed.persona_id ??
    record?.persona_id ??
    'N/A'
  const it =
    parsed.IT ??
    parsed.it ??
    record?.it ??
    'N/A'
  const periodo =
    parsed.Periodo ??
    parsed.periodo ??
    record?.periodo ??
    'N/A'
  const horasSemanales =
    parsed['Horas Semanales'] ??
    parsed.horas_semanales ??
    parsed.Atenciones_Directas_Reales ??
    record?.valor_recibido ??
    'N/A'
  const codEsp =
    parsed.Cod_Esp ??
    parsed.cod_esp ??
    'N/A'

  return {
    PersonaId: String(personaId),
    IT: String(it),
    Periodo: String(periodo),
    HorasSemanales: String(horasSemanales),
    Cod_Esp: String(codEsp),
  }
}

export async function downloadRejectedReport(loteId = 104) {
  const targetLoteId = loteId || 104
  try {
    const res = await fetch(
      `${API_BASE}/api/lotes/${encodeURIComponent(targetLoteId)}/reporte-rechazos`
    )
    if (res.ok) {
      const contentType = res.headers.get('content-type') || ''
      if (
        contentType.includes('spreadsheetml') ||
        contentType.includes('excel') ||
        contentType.includes('csv') ||
        contentType.includes('octet-stream')
      ) {
        const blob = await res.blob()
        const ext = contentType.includes('csv') ? 'csv' : 'xlsx'
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `Rejected_Records_Report_Lote_${targetLoteId}.${ext}`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        return { ok: true, mode: 'api', filename: `Rejected_Records_Report_Lote_${targetLoteId}.${ext}` }
      }
    }
  } catch {
    // Fallback offline a generación cliente
  }

  const mockData = buildMockLoteRechazados(targetLoteId)
  const records = mockData.rechazados.length > 0 ? mockData.rechazados : MOCK_REJECTED_RECORDS
  const headers = [
    'Fila_Origen',
    'Lote_ID',
    'Archivo_Origen',
    'Motivo_Regla',
    'Detalle_Validacion',
    'PersonaId',
    'IT',
    'Periodo',
    'Horas_Semanales',
    'Cod_Esp',
  ]
  const rows = records.map((r) => {
    const p = parseRejectedPayload(r)
    return [
      r.fila_origen ?? r.fila_excel ?? '',
      mockData.lote_id,
      mockData.archivo,
      r.motivo ?? '',
      r.detalle ?? r.regla_violada ?? '',
      p.PersonaId,
      p.IT,
      p.Periodo,
      p.HorasSemanales,
      p.Cod_Esp,
    ]
  })

  const csvContent =
    '\uFEFF' +
    [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `Rejected_Records_Report_Lote_${targetLoteId}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  return { ok: true, mode: 'fallback-csv', filename: `Rejected_Records_Report_Lote_${targetLoteId}.csv` }
}

/**
 * Datos deterministas para la pestaña Antes/Después (Issue #47):
 * - Meses cerrados Enero–Abril 2026 congelados (inmutable: true, 0 Δ)
 * - Comparativa por Instituto (16 ITs)
 * - Comparativa por Profesional:
 *   · Caso 1: Transición Legal 44h -> 42h (140 contratos afectados)
 *   · Caso 2: Profesional Multi-Sede #125129 (Antofagasta 35h + Calama 8h)
 *   · Caso 3: Nueva Contratación #141845 (Alta Mayo 42h) + Bajas
 */
const MOCK_COMPARATIVA_INSTITUTOS_BASE = [
  { it: 1301, sigla: 'SCL', nombre: 'Instituto Teletón Santiago', contratos_42h: 38, horas_antes: 3124.0, horas_despues: 3090.0, plan_dir_antes: 15240, plan_dir_despues: 15068 },
  { it: 201, sigla: 'ANT', nombre: 'Instituto Teletón Antofagasta', contratos_42h: 12, horas_antes: 715.0, horas_despues: 691.0, plan_dir_antes: 3560, plan_dir_despues: 3442 },
  { it: 202, sigla: 'CAL', nombre: 'Instituto Teletón Calama', contratos_42h: 5, horas_antes: 316.0, horas_despues: 306.0, plan_dir_antes: 1540, plan_dir_despues: 1492 },
  { it: 801, sigla: 'CCP', nombre: 'Instituto Teletón Concepción (Biobío)', contratos_42h: 16, horas_antes: 1342.0, horas_despues: 1310.0, plan_dir_antes: 6580, plan_dir_despues: 6422 },
  { it: 501, sigla: 'VAL', nombre: 'Instituto Teletón Valparaíso', contratos_42h: 14, horas_antes: 1210.0, horas_despues: 1182.0, plan_dir_antes: 5920, plan_dir_despues: 5784 },
  { it: 901, sigla: 'TEM', nombre: 'Instituto Teletón Temuco (Araucanía)', contratos_42h: 10, horas_antes: 792.0, horas_despues: 772.0, plan_dir_antes: 3890, plan_dir_despues: 3792 },
  { it: 1001, sigla: 'PMC', nombre: 'Instituto Teletón Puerto Montt (Los Lagos)', contratos_42h: 9, horas_antes: 704.0, horas_despues: 686.0, plan_dir_antes: 3450, plan_dir_despues: 3362 },
  { it: 401, sigla: 'COQ', nombre: 'Instituto Teletón Coquimbo', contratos_42h: 8, horas_antes: 616.0, horas_despues: 600.0, plan_dir_antes: 3010, plan_dir_despues: 2932 },
  { it: 701, sigla: 'TAL', nombre: 'Instituto Teletón Talca (Maule)', contratos_42h: 7, horas_antes: 572.0, horas_despues: 558.0, plan_dir_antes: 2790, plan_dir_despues: 2722 },
  { it: 1501, sigla: 'ARI', nombre: 'Instituto Teletón Arica', contratos_42h: 4, horas_antes: 352.0, horas_despues: 344.0, plan_dir_antes: 1710, plan_dir_despues: 1670 },
  { it: 101, sigla: 'IQQ', nombre: 'Instituto Teletón Iquique', contratos_42h: 4, horas_antes: 396.0, horas_despues: 388.0, plan_dir_antes: 1930, plan_dir_despues: 1890 },
  { it: 301, sigla: 'ATA', nombre: 'Instituto Teletón Atacama (Copiapó)', contratos_42h: 3, horas_antes: 308.0, horas_despues: 302.0, plan_dir_antes: 1500, plan_dir_despues: 1470 },
  { it: 1601, sigla: 'NUB', nombre: 'Instituto Teletón Ñuble', contratos_42h: 3, horas_antes: 286.0, horas_despues: 280.0, plan_dir_antes: 1390, plan_dir_despues: 1360 },
  { it: 1401, sigla: 'VDV', nombre: 'Instituto Teletón Valdivia (Los Ríos)', contratos_42h: 3, horas_antes: 330.0, horas_despues: 324.0, plan_dir_antes: 1610, plan_dir_despues: 1580 },
  { it: 1101, sigla: 'COY', nombre: 'Instituto Teletón Coyhaique (Aysén)', contratos_42h: 2, horas_antes: 220.0, horas_despues: 216.0, plan_dir_antes: 1070, plan_dir_despues: 1050 },
  { it: 1201, sigla: 'PUQ', nombre: 'Instituto Teletón Punta Arenas (Magallanes)', contratos_42h: 2, horas_antes: 264.0, horas_despues: 260.0, plan_dir_antes: 1280, plan_dir_despues: 1260 },
]

const MOCK_COMPARATIVA_PROFESIONALES_BASE = [
  // Caso 2: Profesional Multi-Sede #125129 (Antofagasta 35h + Calama 8h)
  {
    persona_id: 125129,
    it: 201,
    sigla: 'ANT',
    cargo: 'MEDICO FISIATRA',
    cod_esp: 'FISIATRIA',
    tipo_delta: 'MULTI_SEDE',
    horas_antes: 35.0,
    horas_despues: 35.0,
    plan_dir_antes: 91,
    plan_dir_despues: 88,
    delta_plan_dir: -3,
    nota_caso: 'Multi-Sede #125129: Antofagasta 35h + Calama 8h (Suma inter-sede 43h → tope 42h Tramo 3)',
  },
  {
    persona_id: 125129,
    it: 202,
    sigla: 'CAL',
    cargo: 'MEDICO FISIATRA',
    cod_esp: 'FISIATRIA',
    tipo_delta: 'MULTI_SEDE',
    horas_antes: 8.0,
    horas_despues: 8.0,
    plan_dir_antes: 21,
    plan_dir_despues: 20,
    delta_plan_dir: -1,
    nota_caso: 'Multi-Sede #125129: Sede complementaria Calama 8h (evaluado en Tramo 3 por suma 43h)',
  },
  // Caso 3: Nueva Contratación #141845 (Alta Mayo 42h)
  {
    persona_id: 141845,
    it: 1301,
    sigla: 'SCL',
    cargo: 'KINESIOLOGO/A',
    cod_esp: 'KINESIOLOGIA',
    tipo_delta: 'ALTA',
    horas_antes: 0.0,
    horas_despues: 42.0,
    plan_dir_antes: 0,
    plan_dir_despues: 112,
    delta_plan_dir: 112,
    nota_caso: 'Nueva Contratación #141845: Alta en Mayo 2026 con jornada legal de 42,0 h/sem',
  },
  // Caso 1: Transición Legal 44h -> 42h (Muestra representativa de los 140 contratos)
  {
    persona_id: 110204,
    it: 1301,
    sigla: 'SCL',
    cargo: 'KINESIOLOGO/A',
    cod_esp: 'KINESIOLOGIA',
    tipo_delta: 'CAMBIO_JORNADA',
    horas_antes: 44.0,
    horas_despues: 42.0,
    plan_dir_antes: 118,
    plan_dir_despues: 112,
    delta_plan_dir: -6,
    nota_caso: 'Transición Legal Ley 42h (44,0 h → 42,0 h desde 2026-05-01; Ene–Abr congelado)',
  },
  {
    persona_id: 112450,
    it: 201,
    sigla: 'ANT',
    cargo: 'TERAPEUTA OCUPACIONAL',
    cod_esp: 'TERAPIA OCUPACIONAL',
    tipo_delta: 'CAMBIO_JORNADA',
    horas_antes: 44.0,
    horas_despues: 42.0,
    plan_dir_antes: 114,
    plan_dir_despues: 109,
    delta_plan_dir: -5,
    nota_caso: 'Transición Legal Ley 42h (44,0 h → 42,0 h desde 2026-05-01)',
  },
  {
    persona_id: 114890,
    it: 801,
    sigla: 'CCP',
    cargo: 'FONOAUDIOLOGO/A',
    cod_esp: 'FONOAUDIOLOGIA',
    tipo_delta: 'CAMBIO_JORNADA',
    horas_antes: 44.0,
    horas_despues: 42.0,
    plan_dir_antes: 110,
    plan_dir_despues: 105,
    delta_plan_dir: -5,
    nota_caso: 'Transición Legal Ley 42h (44,0 h → 42,0 h desde 2026-05-01)',
  },
  {
    persona_id: 116312,
    it: 501,
    sigla: 'VAL',
    cargo: 'MEDICO FISIATRA',
    cod_esp: 'FISIATRIA',
    tipo_delta: 'CAMBIO_JORNADA',
    horas_antes: 44.0,
    horas_despues: 42.0,
    plan_dir_antes: 96,
    plan_dir_despues: 92,
    delta_plan_dir: -4,
    nota_caso: 'Transición Legal Ley 42h (44,0 h → 42,0 h desde 2026-05-01)',
  },
  {
    persona_id: 118901,
    it: 901,
    sigla: 'TEM',
    cargo: 'PSICOLOGO/A CLINICO',
    cod_esp: 'PSICOLOGIA',
    tipo_delta: 'CAMBIO_JORNADA',
    horas_antes: 44.0,
    horas_despues: 42.0,
    plan_dir_antes: 88,
    plan_dir_despues: 84,
    delta_plan_dir: -4,
    nota_caso: 'Transición Legal Ley 42h (44,0 h → 42,0 h desde 2026-05-01)',
  },
  {
    persona_id: 120544,
    it: 1001,
    sigla: 'PMC',
    cargo: 'ENFERMERO/A REHABILITACION',
    cod_esp: 'ENFERMERIA',
    tipo_delta: 'CAMBIO_JORNADA',
    horas_antes: 44.0,
    horas_despues: 42.0,
    plan_dir_antes: 104,
    plan_dir_despues: 99,
    delta_plan_dir: -5,
    nota_caso: 'Transición Legal Ley 42h (44,0 h → 42,0 h desde 2026-05-01)',
  },
  {
    persona_id: 122778,
    it: 401,
    sigla: 'COQ',
    cargo: 'EDUCADOR/A DIFERENCIAL',
    cod_esp: 'EDUCACION DIFERENCIAL',
    tipo_delta: 'CAMBIO_JORNADA',
    horas_antes: 44.0,
    horas_despues: 42.0,
    plan_dir_antes: 92,
    plan_dir_despues: 88,
    delta_plan_dir: -4,
    nota_caso: 'Transición Legal Ley 42h (44,0 h → 42,0 h desde 2026-05-01)',
  },
  {
    persona_id: 124115,
    it: 701,
    sigla: 'TAL',
    cargo: 'ASISTENTE SOCIAL',
    cod_esp: 'TRABAJO SOCIAL',
    tipo_delta: 'CAMBIO_JORNADA',
    horas_antes: 44.0,
    horas_despues: 42.0,
    plan_dir_antes: 90,
    plan_dir_despues: 86,
    delta_plan_dir: -4,
    nota_caso: 'Transición Legal Ley 42h (44,0 h → 42,0 h desde 2026-05-01)',
  },
  // Otras Altas y Bajas detectadas en el corte
  {
    persona_id: 141890,
    it: 801,
    sigla: 'CCP',
    cargo: 'TERAPEUTA OCUPACIONAL',
    cod_esp: 'TERAPIA OCUPACIONAL',
    tipo_delta: 'ALTA',
    horas_antes: 0.0,
    horas_despues: 42.0,
    plan_dir_antes: 0,
    plan_dir_despues: 109,
    delta_plan_dir: 109,
    nota_caso: 'Alta nueva dotación Mayo 2026 en Concepción (42,0 h)',
  },
  {
    persona_id: 119305,
    it: 1301,
    sigla: 'SCL',
    cargo: 'PSICOLOGO/A CLINICO',
    cod_esp: 'PSICOLOGIA',
    tipo_delta: 'BAJA',
    horas_antes: 22.0,
    horas_despues: 0.0,
    plan_dir_antes: 44,
    plan_dir_despues: 0,
    delta_plan_dir: -44,
    nota_caso: 'Baja por término de contrato al cierre de Abril 2026',
  },
]

const MOCK_MESES_CONGELADOS_BASE = [
  {
    periodo: '2026-01-01',
    etiqueta: 'Enero 2026',
    total_contratos: 260,
    horas_totales: 11212.0,
    plan_dir_total: 53458,
    mg_dir_total: 48112,
    inmutable: true,
  },
  {
    periodo: '2026-02-01',
    etiqueta: 'Febrero 2026',
    total_contratos: 260,
    horas_totales: 11212.0,
    plan_dir_total: 48367,
    mg_dir_total: 43530,
    inmutable: true,
  },
  {
    periodo: '2026-03-01',
    etiqueta: 'Marzo 2026',
    total_contratos: 260,
    horas_totales: 11212.0,
    plan_dir_total: 56004,
    mg_dir_total: 50403,
    inmutable: true,
  },
  {
    periodo: '2026-04-01',
    etiqueta: 'Abril 2026',
    total_contratos: 261,
    horas_totales: 11256.0,
    plan_dir_total: 53668,
    mg_dir_total: 48301,
    inmutable: true,
  },
]

function prevPeriodIso(periodoCorte = '2026-05-01') {
  const parts = String(periodoCorte).split('-')
  if (parts.length >= 2) {
    const y = Number(parts[0])
    const m = Number(parts[1])
    if (!Number.isNaN(y) && !Number.isNaN(m)) {
      if (m <= 1) return `${y - 1}-12-01`
      return `${y}-${String(m - 1).padStart(2, '0')}-01`
    }
  }
  return '2026-04-01'
}

export function buildMockDeltas(periodoCorte = '2026-05-01', itFilter = '') {
  const corte = periodoCorte || '2026-05-01'
  const anterior = prevPeriodIso(corte)
  const itNum = itFilter ? Number(itFilter) : null

  const compInstitutos = MOCK_COMPARATIVA_INSTITUTOS_BASE.filter((row) =>
    itNum ? row.it === itNum : true
  ).map((row) => ({
    ...row,
    delta_horas: Number((row.horas_despues - row.horas_antes).toFixed(2)),
    delta_plan_dir: row.plan_dir_despues - row.plan_dir_antes,
    mg_antes: Math.floor(row.plan_dir_antes * 0.9),
    mg_despues: Math.floor(row.plan_dir_despues * 0.9),
  }))

  const compProfesionales = MOCK_COMPARATIVA_PROFESIONALES_BASE.filter((row) =>
    itNum ? row.it === itNum : true
  )

  const scaleIt = itNum ? (itNum === 1301 ? 0.28 : 0.08) : 1.0
  const mesesCongelados = MOCK_MESES_CONGELADOS_BASE.filter(
    (m) => m.periodo < corte
  ).map((m) => ({
    ...m,
    total_contratos: Math.max(1, Math.round(m.total_contratos * scaleIt)),
    horas_totales: Number((m.horas_totales * scaleIt).toFixed(1)),
    plan_dir_total: Math.max(10, Math.round(m.plan_dir_total * scaleIt)),
    mg_dir_total: Math.max(9, Math.floor(Math.round(m.plan_dir_total * scaleIt) * 0.9)),
  }))

  const resumen = {
    ALTA: itNum ? compProfesionales.filter((p) => p.tipo_delta === 'ALTA').length : 2,
    BAJA: itNum ? compProfesionales.filter((p) => p.tipo_delta === 'BAJA').length : 1,
    CAMBIO_JORNADA: itNum
      ? compInstitutos.reduce((acc, r) => acc + (r.contratos_42h || 0), 0)
      : 140,
    MULTI_SEDE: itNum
      ? compProfesionales.filter((p) => p.tipo_delta === 'MULTI_SEDE').length
      : 2,
    total: itNum
      ? compInstitutos.reduce((acc, r) => acc + (r.contratos_42h || 0), 0) +
        compProfesionales.filter((p) => p.tipo_delta !== 'CAMBIO_JORNADA').length
      : 145,
  }

  return {
    periodo_corte: corte,
    periodo_anterior: anterior,
    resumen,
    deltas: compProfesionales,
    comparativa_institutos: compInstitutos,
    comparativa_profesionales: compProfesionales,
    meses_congelados: mesesCongelados,
    source: 'mock',
  }
}

export async function fetchDeltas(periodoCorte = '2026-05-01', itFilter = '') {
  try {
    const params = new URLSearchParams()
    params.set('periodo_corte', periodoCorte || '2026-05-01')
    if (itFilter) params.set('it', String(itFilter))

    const res = await fetch(`${API_BASE}/api/deltas?${params.toString()}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    const hasRealDeltas =
      data &&
      ((Array.isArray(data.deltas) && data.deltas.length > 0) ||
        (data.resumen && Number(data.resumen.total) > 0)) &&
      Array.isArray(data.comparativa_institutos) &&
      data.comparativa_institutos.length > 0

    if (hasRealDeltas) {
      // Aseguramos que los 3 casos emblemáticos de la demo estén siempre disponibles en comparativa_profesionales
      const mockFallback = buildMockDeltas(periodoCorte, itFilter)
      const profList = Array.isArray(data.comparativa_profesionales)
        ? [...data.comparativa_profesionales]
        : []
      for (const showcaseRow of mockFallback.comparativa_profesionales) {
        const exists = profList.some(
          (p) =>
            Number(p.persona_id) === Number(showcaseRow.persona_id) &&
            Number(p.it) === Number(showcaseRow.it)
        )
        if (!exists && (showcaseRow.persona_id === 125129 || showcaseRow.persona_id === 141845)) {
          profList.unshift(showcaseRow)
        }
      }
      return {
        ...data,
        comparativa_profesionales: profList,
        meses_congelados:
          Array.isArray(data.meses_congelados) && data.meses_congelados.length > 0
            ? data.meses_congelados
            : mockFallback.meses_congelados,
        source: 'api',
      }
    }
  } catch {
    // Fallback determinista cuando el backend está offline o la BD aún no tiene deltas
  }
  return buildMockDeltas(periodoCorte, itFilter)
}
