/**
 * api.js — Cliente HTTP hacia FastAPI (/api/*) con fallback determinista de alta fidelidad
 * para que el Dashboard funcione 100% tanto conectado a SQLite como en modo Vite standalone.
 *
 * Incluye datos realistas del desafío Botathon 2026 Teletón:
 * - 16 Institutos Teletón (IT), 3.123 contratos, 298 profesionales
 * - Delta Mayo 2026 (Ley 42h), profesional multi-sede #125129 (Antofagasta/Calama), nueva alta #141845
 * - Lote con 6 registros rechazados y descarga directa de Rejected_Records_Report
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
  '2026-01-01': 'Enero 2026 (43h)',
  '2026-02-01': 'Febrero 2026 (43h)',
  '2026-03-01': 'Marzo 2026 (43h)',
  '2026-04-01': 'Abril 2026 (43h)',
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
    nota: 'Delta Mayo 2026 (Ley 42h) + Alta #141845 + Multi-sede #125129. 6 filas corruptas aisladas sin detener lote.',
  },
  {
    lote_id: 103,
    archivo: 'SIC_Atenciones_Reales_AbrilMayo2026.xlsx',
    tipo: 'SIC',
    fecha_corrida: '2026-05-02 08:40:02',
    duracion_ms: 960,
    validos: 2894,
    rechazados: 0,
    estado: 'OK',
    nota: 'Cruce SIC Real asistencial consolidado para 16 institutos.',
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
    nota: 'Línea base Enero–Abril 2026 (Jornada 43h congelada).',
  },
]

export const MOCK_REJECTED_RECORDS = [
  {
    fila_excel: 142,
    archivo: 'BUK_Dotacion_Mayo2026_Delta42h.xlsx',
    persona_id: 'NULO / VACIO',
    it: '1301 (SCL)',
    periodo: '2026-05-01',
    campo_error: 'persona_id',
    valor_recibido: '"" (vacío)',
    regla_violada: 'R-VAL-01: Identificador de profesional obligatorio',
    accion_bot: 'Fila aislada en Rejected_Records_Report; lote continúa',
  },
  {
    fila_excel: 389,
    archivo: 'BUK_Dotacion_Mayo2026_Delta42h.xlsx',
    persona_id: '138902',
    it: '801 (CCP)',
    periodo: '2026-05-01',
    campo_error: 'horas_semanales',
    valor_recibido: '-5.0',
    regla_violada: 'R-VAL-02: Horas contratadas deben estar en rango (0, 45]',
    accion_bot: 'Fila aislada en Rejected_Records_Report; lote continúa',
  },
  {
    fila_excel: 715,
    archivo: 'BUK_Dotacion_Mayo2026_Delta42h.xlsx',
    persona_id: '129441',
    it: '501 (VAL)',
    periodo: '2026-05-01',
    campo_error: 'cod_esp',
    valor_recibido: 'XYZ-999',
    regla_violada: 'R-VAL-03: Especialidad no existe en catálogo clínico vigente',
    accion_bot: 'Fila aislada en Rejected_Records_Report; lote continúa',
  },
  {
    fila_excel: 1120,
    archivo: 'BUK_Dotacion_Mayo2026_Delta42h.xlsx',
    persona_id: '131008',
    it: '9999 (INEXISTENTE)',
    periodo: '2026-05-01',
    campo_error: 'it',
    valor_recibido: '9999',
    regla_violada: 'R-VAL-04: Código de Instituto Teletón (IT) fuera de red nacional (16 sedes)',
    accion_bot: 'Fila aislada en Rejected_Records_Report; lote continúa',
  },
  {
    fila_excel: 1844,
    archivo: 'BUK_Dotacion_Mayo2026_Delta42h.xlsx',
    persona_id: '135610',
    it: '201 (ANT)',
    periodo: '2026-13-45',
    campo_error: 'periodo',
    valor_recibido: '2026-13-45',
    regla_violada: 'R-VAL-05: Formato de período inválido (esperado YYYY-MM-01)',
    accion_bot: 'Fila aislada en Rejected_Records_Report; lote continúa',
  },
  {
    fila_excel: 2490,
    archivo: 'BUK_Dotacion_Mayo2026_Delta42h.xlsx',
    persona_id: '140211',
    it: '1301 (SCL)',
    periodo: '2026-05-01',
    campo_error: 'horas_semanales',
    valor_recibido: '84.0',
    regla_violada: 'R-VAL-06: Excede tope legal de jornada semanal (>45h)',
    accion_bot: 'Fila aislada en Rejected_Records_Report; lote continúa',
  },
]

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
    // A partir de mayo 2026 entra en vigencia reducción de jornada 43h -> 42h (-2.32%)
    if (filters.mes >= '2026-05-01') {
      scale *= 42 / 43
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
  const monthScale = filters.mes ? (filters.mes >= '2026-05-01' ? 42 / 43 : 1.0) : 1.0
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
      return { items: data, source: 'api' }
    }
  } catch {
    // Fallback determinista
  }
  return { items: MOCK_LOTES, source: 'mock' }
}

export function downloadRejectedReport() {
  const headers = [
    'Fila_Excel',
    'Archivo_Origen',
    'Persona_ID',
    'Instituto_IT',
    'Periodo',
    'Campo_Error',
    'Valor_Recibido',
    'Regla_Negocio_Violada',
    'Accion_Bot_BluePrism',
  ]
  const rows = MOCK_REJECTED_RECORDS.map((r) => [
    r.fila_excel,
    r.archivo,
    r.persona_id,
    r.it,
    r.periodo,
    r.campo_error,
    r.valor_recibido,
    r.regla_violada,
    r.accion_bot,
  ])

  const csvContent =
    '\uFEFF' +
    [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'Rejected_Records_Report_Lote104.csv')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
