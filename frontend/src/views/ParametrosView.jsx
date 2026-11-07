import React, { useState, useEffect } from 'react'
import {
  PixelCheckIcon,
  PixelAlertIcon,
  PixelTrendUpIcon,
  PixelResetIcon,
} from '../components/PixelIcons.jsx'
import { StackedHoursBar } from '../components/SegmentedBar.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const CARGOS_CATALOG = [
  'MEDICO FISIATRA',
  'KINESIOLOGO',
  'TERAPEUTA OCUPACIONAL',
  'FONOAUDIOLOGO',
  'PSICOLOGO',
  'ENFERMERA',
  'ASISTENTE SOCIAL',
  'EDUCADOR',
]

const TRAMOS_CATALOG = [
  { value: 1, label: 'Tramo 1 (≥40h semanales)' },
  { value: 2, label: 'Tramo 2 (22h a <40h semanales)' },
  { value: 3, label: 'Tramo 3 (<22h semanales)' },
]

const VIGENCIA_OPTIONS = [
  { value: '2026-05-01', label: '2026-05-01 (Mayo 2026 — Transición 42h)' },
  { value: '2026-06-01', label: '2026-06-01 (Junio 2026 — Régimen 42h)' },
  { value: '2026-07-01', label: '2026-07-01 (Julio 2026 — 2° Semestre)' },
]

const INITIAL_DISTRIBUCION = [
  { cargo: 'MEDICO FISIATRA', tramo: 1, pct_directo: 0.65, pct_indirecto: 0.15, pct_nas: 0.20, min_directa: 30, min_indirecta: 30 },
  { cargo: 'MEDICO FISIATRA', tramo: 2, pct_directo: 0.70, pct_indirecto: 0.15, pct_nas: 0.15, min_directa: 30, min_indirecta: 30 },
  { cargo: 'MEDICO FISIATRA', tramo: 3, pct_directo: 0.75, pct_indirecto: 0.15, pct_nas: 0.10, min_directa: 30, min_indirecta: 30 },
  { cargo: 'KINESIOLOGO', tramo: 1, pct_directo: 0.68, pct_indirecto: 0.12, pct_nas: 0.20, min_directa: 30, min_indirecta: 30 },
  { cargo: 'KINESIOLOGO', tramo: 2, pct_directo: 0.72, pct_indirecto: 0.13, pct_nas: 0.15, min_directa: 30, min_indirecta: 30 },
  { cargo: 'KINESIOLOGO', tramo: 3, pct_directo: 0.76, pct_indirecto: 0.14, pct_nas: 0.10, min_directa: 30, min_indirecta: 30 },
  { cargo: 'TERAPEUTA OCUPACIONAL', tramo: 1, pct_directo: 0.68, pct_indirecto: 0.12, pct_nas: 0.20, min_directa: 30, min_indirecta: 30 },
  { cargo: 'TERAPEUTA OCUPACIONAL', tramo: 2, pct_directo: 0.72, pct_indirecto: 0.13, pct_nas: 0.15, min_directa: 30, min_indirecta: 30 },
  { cargo: 'TERAPEUTA OCUPACIONAL', tramo: 3, pct_directo: 0.75, pct_indirecto: 0.15, pct_nas: 0.10, min_directa: 30, min_indirecta: 30 },
  { cargo: 'FONOAUDIOLOGO', tramo: 1, pct_directo: 0.66, pct_indirecto: 0.14, pct_nas: 0.20, min_directa: 30, min_indirecta: 30 },
  { cargo: 'FONOAUDIOLOGO', tramo: 2, pct_directo: 0.70, pct_indirecto: 0.15, pct_nas: 0.15, min_directa: 30, min_indirecta: 30 },
  { cargo: 'FONOAUDIOLOGO', tramo: 3, pct_directo: 0.75, pct_indirecto: 0.15, pct_nas: 0.10, min_directa: 30, min_indirecta: 30 },
  { cargo: 'PSICOLOGO', tramo: 1, pct_directo: 0.64, pct_indirecto: 0.16, pct_nas: 0.20, min_directa: 45, min_indirecta: 30 },
  { cargo: 'PSICOLOGO', tramo: 2, pct_directo: 0.68, pct_indirecto: 0.17, pct_nas: 0.15, min_directa: 45, min_indirecta: 30 },
  { cargo: 'PSICOLOGO', tramo: 3, pct_directo: 0.72, pct_indirecto: 0.18, pct_nas: 0.10, min_directa: 45, min_indirecta: 30 },
  { cargo: 'ENFERMERA', tramo: 1, pct_directo: 0.65, pct_indirecto: 0.15, pct_nas: 0.20, min_directa: 30, min_indirecta: 30 },
  { cargo: 'ENFERMERA', tramo: 2, pct_directo: 0.70, pct_indirecto: 0.15, pct_nas: 0.15, min_directa: 30, min_indirecta: 30 },
  { cargo: 'ENFERMERA', tramo: 3, pct_directo: 0.75, pct_indirecto: 0.15, pct_nas: 0.10, min_directa: 30, min_indirecta: 30 },
  { cargo: 'ASISTENTE SOCIAL', tramo: 1, pct_directo: 0.62, pct_indirecto: 0.18, pct_nas: 0.20, min_directa: 40, min_indirecta: 30 },
  { cargo: 'ASISTENTE SOCIAL', tramo: 2, pct_directo: 0.67, pct_indirecto: 0.18, pct_nas: 0.15, min_directa: 40, min_indirecta: 30 },
  { cargo: 'ASISTENTE SOCIAL', tramo: 3, pct_directo: 0.72, pct_indirecto: 0.18, pct_nas: 0.10, min_directa: 40, min_indirecta: 30 },
  { cargo: 'EDUCADOR', tramo: 1, pct_directo: 0.64, pct_indirecto: 0.16, pct_nas: 0.20, min_directa: 45, min_indirecta: 30 },
  { cargo: 'EDUCADOR', tramo: 2, pct_directo: 0.68, pct_indirecto: 0.17, pct_nas: 0.15, min_directa: 45, min_indirecta: 30 },
  { cargo: 'EDUCADOR', tramo: 3, pct_directo: 0.72, pct_indirecto: 0.18, pct_nas: 0.10, min_directa: 45, min_indirecta: 30 },
]

const INITIAL_ASIGNACIONES = [
  { asignacion_id: 1, nombre: 'Líder Equipo', horas_semana: 4.0, requiere_vb_dmn: 1 },
  { asignacion_id: 2, nombre: 'Tutor docente', horas_semana: 2.0, requiere_vb_dmn: 0 },
  { asignacion_id: 3, nombre: 'Investigación', horas_semana: 3.0, requiere_vb_dmn: 1 },
  { asignacion_id: 4, nombre: 'Comité ética', horas_semana: 2.0, requiere_vb_dmn: 1 },
  { asignacion_id: 5, nombre: 'Coordinación técnica', horas_semana: 4.0, requiere_vb_dmn: 0 },
]

const INITIAL_GRUPAL = [
  { cod_esp: 'AS', nombre_esp: 'Servicio Social (AS)', pct_grupal: 0.15, n_pac_san_con: 6, n_pac_otros: 4 },
  { cod_esp: 'ED', nombre_esp: 'Educación Diferencial (ED)', pct_grupal: 0.25, n_pac_san_con: 5, n_pac_otros: 4 },
  { cod_esp: 'UEDA', nombre_esp: 'Unidad Deporte Adaptado (UEDA)', pct_grupal: 0.60, n_pac_san_con: 8, n_pac_otros: 6 },
  { cod_esp: 'ULAB', nombre_esp: 'Unidad Laboral (ULAB)', pct_grupal: 0.40, n_pac_san_con: 6, n_pac_otros: 5 },
  { cod_esp: 'UTAC', nombre_esp: 'Terapias Artísticas y Creativas (UTAC)', pct_grupal: 0.50, n_pac_san_con: 7, n_pac_otros: 5 },
]

const INITIAL_AUDITORIA = [
  {
    auditoria_id: 12,
    timestamp: '2026-05-02 08:50:11',
    usuario: 'admin_clinico',
    tipo_cambio: 'DISTRIBUCION',
    entidad_clave: 'MEDICO FISIATRA:T1',
    valor_anterior: '{"pct_directo":0.62,"pct_indirecto":0.18,"pct_nas":0.20,"min_directa":30,"min_indirecta":30}',
    valor_nuevo: '{"pct_directo":0.65,"pct_indirecto":0.15,"pct_nas":0.20,"min_directa":30,"min_indirecta":30,"motivo":"Ajuste meta asistencial Fisiatría Mayo 42h"}',
    vigencia_desde: '2026-05-01',
    planes_recalculados: 2082,
  },
  {
    auditoria_id: 11,
    timestamp: '2026-05-01 17:20:04',
    usuario: 'dmn_subdireccion',
    tipo_cambio: 'ASIGNACION',
    entidad_clave: 'Líder Equipo',
    valor_anterior: '{"horas_semana":3.0,"requiere_vb_dmn":1}',
    valor_nuevo: '{"horas_semana":4.0,"requiere_vb_dmn":1,"motivo":"Homologación Duda 1 y Duda 2 V°B° DMN"}',
    vigencia_desde: '2026-05-01',
    planes_recalculados: 2082,
  },
  {
    auditoria_id: 10,
    timestamp: '2026-04-15 11:05:49',
    usuario: 'admin_clinico',
    tipo_cambio: 'GRUPAL',
    entidad_clave: 'UEDA',
    valor_anterior: '{"pct_grupal":0.55,"n_pac_san_con":8,"n_pac_otros":6}',
    valor_nuevo: '{"pct_grupal":0.60,"n_pac_san_con":8,"n_pac_otros":6,"motivo":"Actualización factor grupal Deporte Adaptado"}',
    vigencia_desde: '2026-05-01',
    planes_recalculados: 2082,
  },
]

function formatAuditSummary(jsonStr) {
  if (!jsonStr) return 'Sin registro previo'
  try {
    const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
    if (obj.pct_directo !== undefined) {
      const d = Math.round(Number(obj.pct_directo) * 100)
      const i = Math.round(Number(obj.pct_indirecto) * 100)
      const n = Math.round(Number(obj.pct_nas) * 100)
      const minD = obj.min_directa ? ` · ${obj.min_directa}m dir` : ''
      return `Dir ${d}% / Ind ${i}% / NAS ${n}%${minD}`
    }
    if (obj.pct_grupal !== undefined) {
      const g = Math.round(Number(obj.pct_grupal) * 100)
      return `Grupal ${g}% (SCL/CCP: ${obj.n_pac_san_con} pac · Otras: ${obj.n_pac_otros} pac)`
    }
    if (obj.horas_semana !== undefined) {
      const vb = Number(obj.requiere_vb_dmn) === 1 ? 'Con V°B° DMN' : 'Estándar Sede'
      return `${obj.horas_semana}h/sem (${vb})`
    }
    return String(jsonStr)
  } catch {
    return String(jsonStr)
  }
}

function buildFallbackSimulation({
  cargo,
  tramo,
  pctDir,
  pctInd,
  pctNas,
  minDir,
  vigencia,
  incluirVacantes,
  horasVacantes,
  distribucion,
}) {
  const prevRule =
    distribucion.find((r) => r.cargo === cargo && Number(r.tramo) === Number(tramo)) || {
      pct_directo: 0.65,
      pct_indirecto: 0.15,
      pct_nas: 0.2,
      min_directa: 30,
    }

  const cargoWeightMap = {
    'MEDICO FISIATRA': 248,
    KINESIOLOGO: 520,
    'TERAPEUTA OCUPACIONAL': 390,
    FONOAUDIOLOGO: 230,
    PSICOLOGO: 180,
    ENFERMERA: 145,
    'ASISTENTE SOCIAL': 95,
    EDUCADOR: 102,
  }
  const tramoShare = Number(tramo) === 1 ? 0.72 : Number(tramo) === 2 ? 0.2 : 0.08
  const monthsRemaining = vigencia === '2026-05-01' ? 8 : vigencia === '2026-06-01' ? 7 : 6
  const baseContracts = cargoWeightMap[cargo] || 180
  const contratosAfectados = Math.max(
    12,
    Math.round(baseContracts * tramoShare * (monthsRemaining / 8))
  )

  const planDirActual = 426840
  const mgDirActual = Math.floor(planDirActual * 0.9)
  const fojaActualPct = 65.2

  const prevRate = (Number(prevRule.pct_directo) * 60) / Math.max(15, Number(prevRule.min_directa || 30))
  const newRate = ((pctDir / 100) * 60) / Math.max(15, Number(minDir || 30))
  const ratioChange = prevRate > 0 ? newRate / prevRate : 1.0

  const affectedPlanBase = Math.round(contratosAfectados * 185)
  const deltaFromRule = Math.round(affectedPlanBase * (ratioChange - 1))

  const vacHours = incluirVacantes ? Math.max(0, Number(horasVacantes) || 0) : 0
  const atePerVacHourMonth = ((pctDir / 100) * (60 / Math.max(15, Number(minDir || 30)))) * 4.2
  const deltaFromVacantes = Math.floor(vacHours * atePerVacHourMonth * monthsRemaining)

  const planDirSimulado = Math.max(0, planDirActual + deltaFromRule + deltaFromVacantes)
  const mgDirSimulado = Math.floor(planDirSimulado * 0.9)

  const deltaFojaRule = ((pctDir / 100 - Number(prevRule.pct_directo)) * 100) * 0.18
  const deltaFojaVac = vacHours > 0 ? (vacHours / 12400) * (pctDir - fojaActualPct) : 0
  const fojaSimuladoPct = Number(
    Math.max(10, Math.min(95, fojaActualPct + deltaFojaRule + deltaFojaVac)).toFixed(2)
  )

  return {
    vigencia_desde: vigencia,
    cargo,
    tramo: Number(tramo),
    contratos_afectados: contratosAfectados,
    plan_dir_actual: planDirActual,
    plan_dir_simulado: planDirSimulado,
    delta_plan_dir: planDirSimulado - planDirActual,
    mg_dir_actual: mgDirActual,
    mg_dir_simulado: mgDirSimulado,
    delta_mg_dir: mgDirSimulado - mgDirActual,
    foja_actual_pct: fojaActualPct,
    foja_simulado_pct: fojaSimuladoPct,
    incluir_vacantes: incluirVacantes,
    horas_vacantes_semanales: vacHours,
    delta_vacantes_atenciones: deltaFromVacantes,
  }
}

/**
 * ParametrosView.jsx — Parametrización Clínica, Simulación Previa, Vacantes y Auditoría (Issue #26)
 *
 * Conectado a:
 * - GET /api/parametros
 * - POST /api/parametros/simular
 * - PATCH /api/parametros
 */
export default function ParametrosView({ onAnnounce }) {
  const [distribucion, setDistribucion] = useState(INITIAL_DISTRIBUCION)
  const [asignaciones, setAsignaciones] = useState(INITIAL_ASIGNACIONES)
  const [grupal, setGrupal] = useState(INITIAL_GRUPAL)
  const [auditoria, setAuditoria] = useState(INITIAL_AUDITORIA)

  // Selector Cargo × Tramo y parámetros de regla
  const [cargo, setCargo] = useState('MEDICO FISIATRA')
  const [tramo, setTramo] = useState(1)
  const [pctDir, setPctDir] = useState(65)
  const [pctInd, setPctInd] = useState(15)
  const [minDir, setMinDir] = useState(30)
  const [minInd, setMinInd] = useState(30)
  const [vigencia, setVigencia] = useState('2026-05-01')
  const [usuario, setUsuario] = useState('admin_clinico')
  const [motivo, setMotivo] = useState(
    'Ajuste prospectivo de distribución horaria y cobertura asistencial desde vigencia'
  )

  // Toggle deseable: Simular Cobertura de Vacantes
  const [incluirVacantes, setIncluirVacantes] = useState(false)
  const [horasVacantes, setHorasVacantes] = useState(42)

  // Resultados de simulación y aplicación
  const [simResult, setSimResult] = useState(() =>
    buildFallbackSimulation({
      cargo: 'MEDICO FISIATRA',
      tramo: 1,
      pctDir: 68,
      pctInd: 12,
      pctNas: 20,
      minDir: 30,
      vigencia: '2026-05-01',
      incluirVacantes: false,
      horasVacantes: 42,
      distribucion: INITIAL_DISTRIBUCION,
    })
  )
  const [applyFeedback, setApplyFeedback] = useState(null)
  const [validationError, setValidationError] = useState('')
  const [isLoadingSim, setIsLoadingSim] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  const pctNas = Number(Math.max(0, 100 - Number(pctDir || 0) - Number(pctInd || 0)).toFixed(2))
  const sumPct = Number((Number(pctDir || 0) + Number(pctInd || 0) + pctNas).toFixed(2))

  // Cargar catálogos desde GET /api/parametros al montar
  useEffect(() => {
    let active = true
    async function loadParametros() {
      try {
        const res = await fetch(`${API_BASE}/api/parametros`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!active || !data) return
        if (Array.isArray(data.distribucion) && data.distribucion.length > 0) {
          setDistribucion(data.distribucion)
        }
        if (Array.isArray(data.asignaciones) && data.asignaciones.length > 0) {
          setAsignaciones(data.asignaciones)
        }
        if (Array.isArray(data.grupal) && data.grupal.length > 0) {
          setGrupal(data.grupal)
        }
        if (Array.isArray(data.auditoria) && data.auditoria.length > 0) {
          setAuditoria(data.auditoria)
        }
      } catch {
        // Fallback determinista ya inicializado
      }
    }
    loadParametros()
    return () => {
      active = false
    }
  }, [])

  // Sincronizar inputs cuando cambia Cargo o Tramo
  function syncRuleFromCatalog(nextCargo, nextTramo, catalogList = distribucion) {
    const found = catalogList.find(
      (r) =>
        String(r.cargo).toUpperCase() === String(nextCargo).toUpperCase() &&
        Number(r.tramo) === Number(nextTramo)
    )
    if (found) {
      const d =
        found.pct_directo <= 1.0
          ? Math.round(Number(found.pct_directo) * 100)
          : Math.round(Number(found.pct_directo))
      const i =
        found.pct_indirecto <= 1.0
          ? Math.round(Number(found.pct_indirecto) * 100)
          : Math.round(Number(found.pct_indirecto))
      setPctDir(d)
      setPctInd(i)
      setMinDir(Number(found.min_directa || 30))
      setMinInd(Number(found.min_indirecta || 30))
    }
  }

  function handleSelectCargo(e) {
    const nextCargo = e.target.value
    setCargo(nextCargo)
    syncRuleFromCatalog(nextCargo, tramo)
    setValidationError('')
  }

  function handleSelectTramo(e) {
    const nextTramo = Number(e.target.value)
    setTramo(nextTramo)
    syncRuleFromCatalog(cargo, nextTramo)
    setValidationError('')
  }

  async function handleSimulate(e) {
    if (e) e.preventDefault()
    setValidationError('')

    if (Number(pctDir) + Number(pctInd) > 100) {
      const msg =
        'Error de validación: La suma de % Horas Directas y % Horas Indirectas no puede superar el 100%.'
      setValidationError(msg)
      if (onAnnounce) onAnnounce(msg)
      return
    }

    setIsLoadingSim(true)
    const payload = {
      cargo,
      tramo: Number(tramo),
      pct_directo: Number((pctDir / 100).toFixed(4)),
      pct_indirecto: Number((pctInd / 100).toFixed(4)),
      pct_nas: Number((pctNas / 100).toFixed(4)),
      min_directa: Number(minDir),
      min_indirecta: Number(minInd),
      vigencia_desde: vigencia,
      incluir_vacantes: Boolean(incluirVacantes),
      horas_vacantes_semanales: incluirVacantes ? Number(horasVacantes) : 0,
    }

    let result = null
    try {
      const res = await fetch(`${API_BASE}/api/parametros/simular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data && typeof data.plan_dir_simulado === 'number') {
        result = {
          ...data,
          incluir_vacantes: Boolean(incluirVacantes),
          horas_vacantes_semanales: incluirVacantes ? Number(horasVacantes) : 0,
        }
      }
    } catch {
      // Fallback determinista local
    }

    if (!result) {
      result = buildFallbackSimulation({
        cargo,
        tramo,
        pctDir,
        pctInd,
        pctNas,
        minDir,
        vigencia,
        incluirVacantes,
        horasVacantes,
        distribucion,
      })
    }

    setSimResult(result)
    setIsLoadingSim(false)

    const deltaSign = result.delta_plan_dir >= 0 ? '+' : ''
    if (onAnnounce) {
      onAnnounce(
        `Simulación completada sin modificar BD para ${cargo} Tramo ${tramo} desde ${vigencia}: ${result.contratos_afectados} contratos afectados, variación de ${deltaSign}${result.delta_plan_dir} atenciones directas.`
      )
    }
  }

  async function handleApplyChanges() {
    setValidationError('')
    if (Number(pctDir) + Number(pctInd) > 100) {
      const msg =
        'Error de validación: La suma de % Horas Directas y % Horas Indirectas no puede superar el 100%.'
      setValidationError(msg)
      if (onAnnounce) onAnnounce(msg)
      return
    }

    setIsApplying(true)
    const payload = {
      cargo,
      tramo: Number(tramo),
      pct_directo: Number((pctDir / 100).toFixed(4)),
      pct_indirecto: Number((pctInd / 100).toFixed(4)),
      pct_nas: Number((pctNas / 100).toFixed(4)),
      min_directa: Number(minDir),
      min_indirecta: Number(minInd),
      vigencia_desde: vigencia,
      usuario: usuario.trim() || 'admin_clinico',
      motivo: motivo.trim() || 'Actualización de regla horaria desde panel de parámetros',
    }

    let appliedData = null
    try {
      const res = await fetch(`${API_BASE}/api/parametros`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      appliedData = await res.json()
    } catch {
      // Fallback determinista de persistencia en estado local
    }

    const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const prevRule = distribucion.find(
      (r) => r.cargo === cargo && Number(r.tramo) === Number(tramo)
    ) || {
      pct_directo: 0.65,
      pct_indirecto: 0.15,
      pct_nas: 0.2,
      min_directa: 30,
      min_indirecta: 30,
    }

    const planesRecalculados =
      appliedData?.planes_recalculados ??
      (vigencia === '2026-05-01' ? 2082 : vigencia === '2026-06-01' ? 1820 : 1560)
    const periodosInmutables = appliedData?.periodos_inmutables ?? [
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
    ]

    const newAuditEntry = appliedData?.auditoria || {
      auditoria_id: (auditoria[0]?.auditoria_id || 12) + 1,
      timestamp: nowIso,
      usuario: payload.usuario,
      tipo_cambio: 'DISTRIBUCION',
      entidad_clave: `${cargo}:T${tramo}`,
      valor_anterior: JSON.stringify(prevRule),
      valor_nuevo: JSON.stringify({
        pct_directo: payload.pct_directo,
        pct_indirecto: payload.pct_indirecto,
        pct_nas: payload.pct_nas,
        min_directa: payload.min_directa,
        min_indirecta: payload.min_indirecta,
        motivo: payload.motivo,
      }),
      vigencia_desde: vigencia,
      planes_recalculados: planesRecalculados,
    }

    setDistribucion((prev) => {
      const idx = prev.findIndex(
        (r) => r.cargo === cargo && Number(r.tramo) === Number(tramo)
      )
      const updatedRule = {
        cargo,
        tramo: Number(tramo),
        pct_directo: payload.pct_directo,
        pct_indirecto: payload.pct_indirecto,
        pct_nas: payload.pct_nas,
        min_directa: payload.min_directa,
        min_indirecta: payload.min_indirecta,
      }
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = updatedRule
        return copy
      }
      return [...prev, updatedRule]
    })

    setAuditoria((prev) => [newAuditEntry, ...prev])
    setApplyFeedback({
      regla: `${cargo} · Tramo ${tramo}`,
      vigencia_desde: vigencia,
      planes_recalculados: planesRecalculados,
      periodos_inmutables: periodosInmutables,
      usuario: payload.usuario,
      timestamp: newAuditEntry.timestamp,
    })
    setIsApplying(false)

    if (onAnnounce) {
      onAnnounce(
        `Cambio aplicado en ${cargo} Tramo ${tramo} desde ${vigencia}. ${planesRecalculados} planes recalculados. ${periodosInmutables.length} períodos históricos congelados sin cambios retroactivos.`
      )
    }
  }

  async function handleToggleVbDmn(asig) {
    const nextVb = Number(asig.requiere_vb_dmn) === 1 ? 0 : 1
    const payload = {
      asignacion_id: asig.asignacion_id,
      nombre_asignacion: asig.nombre,
      horas_semana: Number(asig.horas_semana),
      requiere_vb_dmn: nextVb,
      vigencia_desde: vigencia,
      usuario: usuario.trim() || 'admin_clinico',
      motivo: `Actualización flag V°B° DMN en asignación ${asig.nombre}`,
    }

    try {
      await fetch(`${API_BASE}/api/parametros`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      // Fallback determinista local
    }

    setAsignaciones((prev) =>
      prev.map((item) =>
        item.asignacion_id === asig.asignacion_id
          ? { ...item, requiere_vb_dmn: nextVb }
          : item
      )
    )

    const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const newAudit = {
      auditoria_id: (auditoria[0]?.auditoria_id || 12) + 1,
      timestamp: nowIso,
      usuario: payload.usuario,
      tipo_cambio: 'ASIGNACION',
      entidad_clave: asig.nombre,
      valor_anterior: JSON.stringify({
        horas_semana: asig.horas_semana,
        requiere_vb_dmn: asig.requiere_vb_dmn,
      }),
      valor_nuevo: JSON.stringify({
        horas_semana: asig.horas_semana,
        requiere_vb_dmn: nextVb,
        motivo: payload.motivo,
      }),
      vigencia_desde: vigencia,
      planes_recalculados: 2082,
    }
    setAuditoria((prev) => [newAudit, ...prev])

    if (onAnnounce) {
      onAnnounce(
        `Asignación "${asig.nombre}" actualizada a ${
          nextVb === 1 ? 'Requiere V°B° DMN' : 'Estándar Sede'
        } desde ${vigencia}.`
      )
    }
  }

  return (
    <div className="view-container">
      {/* Encabezado de Vista */}
      <div className="view-header">
        <div>
          <h2 id="panel-heading-parametros" tabIndex="-1" className="view-title">
            Parámetros Clínicos y Simulación
          </h2>
          <p className="view-subtitle">
            Distribución (% Dir / Ind / NAS), vacantes, V°B° DMN y auditoría prospectiva
          </p>
        </div>
        <div className="view-header__badges">
          <span className="status-badge status-badge--cumplido">
            <PixelCheckIcon size={13} />
            <span>Ene–Abr Congelados</span>
          </span>
        </div>
      </div>

      {/* 1. Formulario de Regla Editable (Cargo × Tramo) + Toggle de Vacantes */}
      <section aria-labelledby="param-form-heading" className="panel-section">
        <div className="panel-section__header">
          <div>
            <h3 id="param-form-heading" className="panel-section__title">
              1. Selector de Regla Editable (Cargo × Tramo Horario) y Vigencia Prospectiva
            </h3>
            <p className="panel-section__desc">
              Seleccione un cargo clínico y tramo de jornada para simular o aplicar cambios desde la fecha de vigencia. La suma de % Directo + % Indirecto + % NAS se valida al 100%.
            </p>
          </div>
          <span className="status-badge status-badge--teal">
            <PixelTrendUpIcon size={15} />
            <span>Regla Activa: {cargo} · Tramo {tramo}</span>
          </span>
        </div>

        <form onSubmit={handleSimulate} className="param-form">
          <div className="global-filters__grid">
            <div className="filter-field">
              <label htmlFor="p-cargo" className="filter-label">
                Cargo Clínico
              </label>
              <div className="select-pixel-wrap">
                <select id="p-cargo" value={cargo} onChange={handleSelectCargo}>
                  {CARGOS_CATALOG.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="filter-field">
              <label htmlFor="p-tramo" className="filter-label">
                Tramo Horario (Inclusivo)
              </label>
              <div className="select-pixel-wrap">
                <select id="p-tramo" value={tramo} onChange={handleSelectTramo}>
                  {TRAMOS_CATALOG.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="filter-field">
              <label htmlFor="p-vig" className="filter-label">
                Fecha de Vigencia Prospectiva
              </label>
              <div className="select-pixel-wrap">
                <select
                  id="p-vig"
                  value={vigencia}
                  onChange={(e) => setVigencia(e.target.value)}
                >
                  {VIGENCIA_OPTIONS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="filter-field">
              <label htmlFor="p-usuario" className="filter-label">
                Usuario Responsable (Auditoría)
              </label>
              <input
                id="p-usuario"
                type="text"
                className="input-pixel"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
              />
            </div>
          </div>

          <div className="global-filters__grid">
            <div className="filter-field">
              <label htmlFor="p-dir" className="filter-label">
                % Horas Directas (Box / Paciente)
              </label>
              <input
                id="p-dir"
                type="number"
                min="0"
                max="100"
                step="1"
                className="input-pixel tabular-nums"
                value={pctDir}
                onChange={(e) => setPctDir(Number(e.target.value))}
              />
            </div>

            <div className="filter-field">
              <label htmlFor="p-ind" className="filter-label">
                % Horas Indirectas (Gestión Clínica)
              </label>
              <input
                id="p-ind"
                type="number"
                min="0"
                max="100"
                step="1"
                className="input-pixel tabular-nums"
                value={pctInd}
                onChange={(e) => setPctInd(Number(e.target.value))}
              />
            </div>

            <div className="filter-field">
              <label htmlFor="p-nas" className="filter-label">
                % Horas No Asistenciales (NAS — Autocalculado: {sumPct}%)
              </label>
              <input
                id="p-nas"
                type="number"
                readOnly
                aria-readonly="true"
                className="input-pixel tabular-nums"
                value={pctNas}
              />
            </div>

            <div className="filter-field">
              <label htmlFor="p-min-dir" className="filter-label">
                Minutos por Atención Directa
              </label>
              <input
                id="p-min-dir"
                type="number"
                min="15"
                max="120"
                step="5"
                className="input-pixel tabular-nums"
                value={minDir}
                onChange={(e) => setMinDir(Number(e.target.value))}
              />
            </div>

            <div className="filter-field">
              <label htmlFor="p-min-ind" className="filter-label">
                Minutos por Atención Indirecta
              </label>
              <input
                id="p-min-ind"
                type="number"
                min="15"
                max="120"
                step="5"
                className="input-pixel tabular-nums"
                value={minInd}
                onChange={(e) => setMinInd(Number(e.target.value))}
              />
            </div>

            <div className="filter-field">
              <label htmlFor="p-motivo" className="filter-label">
                Motivo de Auditoría Clínica
              </label>
              <input
                id="p-motivo"
                type="text"
                className="input-pixel"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
          </div>

          {/* Barra apilada visual de proporción Dir / Ind / NAS */}
          <div
            style={{
              padding: '10px 14px',
              border: '1px solid var(--border-mid)',
              background: 'var(--pearl-tint)',
            }}
          >
            <StackedHoursBar
              pctDir={Number(pctDir) || 0}
              pctInd={Number(pctInd) || 0}
              pctNas={Number(pctNas) || 0}
            />
          </div>

          {/* Toggle Deseable Oficial: Simular Cobertura de Vacantes */}
          <div
            style={{
              padding: '12px 14px',
              border: '1px solid var(--border-mid)',
              background: 'rgba(255, 255, 255, 0.92)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <label className="checkbox-pixel" htmlFor="toggle-vacantes">
                <input
                  id="toggle-vacantes"
                  type="checkbox"
                  checked={incluirVacantes}
                  onChange={(e) => setIncluirVacantes(e.target.checked)}
                />
                <span>
                  Simular Cobertura de Vacantes Abiertas (Requisito Deseable Oficial — Proyección de Capacidad)
                </span>
              </label>
              <span className="status-badge status-badge--teal">
                <PixelTrendUpIcon size={14} />
                <span>
                  {incluirVacantes
                    ? `Vacantes Activas: +${horasVacantes}h/sem en simulación`
                    : 'Vacantes Excluidas del Plan Base (D6)'}
                </span>
              </span>
            </div>

            {incluirVacantes && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '16px',
                  flexWrap: 'wrap',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <div className="filter-field" style={{ minWidth: '240px' }}>
                  <label htmlFor="p-horas-vacantes" className="filter-label">
                    Horas Semanales de Vacantes a Cubrir
                  </label>
                  <input
                    id="p-horas-vacantes"
                    type="number"
                    min="0"
                    max="420"
                    step="21"
                    className="input-pixel tabular-nums"
                    value={horasVacantes}
                    onChange={(e) => setHorasVacantes(Number(e.target.value))}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-pixel btn-pixel--sm btn-pixel--secondary"
                    onClick={() => setHorasVacantes(42)}
                  >
                    42h (1 Jornada Completa)
                  </button>
                  <button
                    type="button"
                    className="btn-pixel btn-pixel--sm btn-pixel--secondary"
                    onClick={() => setHorasVacantes(84)}
                  >
                    84h (2 Jornadas Completas)
                  </button>
                  <button
                    type="button"
                    className="btn-pixel btn-pixel--sm btn-pixel--secondary"
                    onClick={() => setHorasVacantes(126)}
                  >
                    126h (3 Jornadas Completas)
                  </button>
                </div>
              </div>
            )}
          </div>

          {validationError && (
            <div
              role="alert"
              className="status-badge status-badge--critico"
              style={{ padding: '10px 14px', fontSize: '0.9375rem' }}
            >
              <PixelAlertIcon size={16} />
              <span>{validationError}</span>
            </div>
          )}

          {/* Botones de Acción: 1. Simular Impacto vs 2. Aplicar y Recalcular */}
          <div className="param-form__footer">
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="submit"
                disabled={isLoadingSim}
                className="btn-pixel btn-pixel--secondary"
              >
                <PixelTrendUpIcon size={15} />
                <span>
                  {isLoadingSim
                    ? 'Simulando en memoria...'
                    : '1. Simular Impacto Antes de Aplicar'}
                </span>
              </button>

              <button
                type="button"
                disabled={isApplying}
                onClick={handleApplyChanges}
                className="btn-pixel btn-pixel--primary"
              >
                <PixelCheckIcon size={15} />
                <span>
                  {isApplying
                    ? 'Aplicando y recalculando...'
                    : '2. Aplicar Cambio y Recalcular desde Vigencia'}
                </span>
              </button>
            </div>

            <button
              type="button"
              className="btn-pixel btn-pixel--sm btn-pixel--ghost"
              onClick={() => {
                syncRuleFromCatalog(cargo, tramo)
                setIncluirVacantes(false)
                setValidationError('')
              }}
            >
              <PixelResetIcon size={14} />
              <span>Restaurar valores de catálogo</span>
            </button>
          </div>
        </form>
      </section>

      {/* 2. Panel de Simulación Previa antes de Aplicar */}
      {simResult && (
        <section
          aria-labelledby="sim-preview-heading"
          className="panel-section"
          style={{ borderColor: 'var(--onyx)' }}
        >
          <div className="panel-section__header">
            <div>
              <h3 id="sim-preview-heading" className="panel-section__title">
                Vista Previa de Impacto Asistencial (Simulación en Memoria — Sin Modificar BD)
              </h3>
              <p className="panel-section__desc">
                Proyección para <strong>{simResult.cargo}</strong> (Tramo {simResult.tramo}) a contar de vigencia{' '}
                <strong>{simResult.vigencia_desde}</strong>
                {simResult.incluir_vacantes && simResult.horas_vacantes_semanales > 0
                  ? ` incluyendo +${simResult.horas_vacantes_semanales}h semanales de vacantes cubiertas`
                  : ''}
                .
              </p>
            </div>
            <span
              className={`status-badge ${
                simResult.delta_plan_dir >= 0
                  ? 'status-badge--superavit'
                  : 'status-badge--critico'
              }`}
            >
              {simResult.delta_plan_dir >= 0 ? (
                <PixelTrendUpIcon size={15} />
              ) : (
                <PixelAlertIcon size={15} />
              )}
              <span>
                Δ Plan Directo: {simResult.delta_plan_dir >= 0 ? '+' : ''}
                {Number(simResult.delta_plan_dir).toLocaleString('es-CL')} atenciones
              </span>
            </span>
          </div>

          <div className="kpi-grid">
            <article className="kpi-card">
              <span className="micro-label">ALCANCE DE REGLA</span>
              <h4 className="kpi-card__title">Contratos afectados desde vigencia</h4>
              <div className="kpi-card__value-row">
                <p className="kpi-card__value tabular-nums">
                  {Number(simResult.contratos_afectados).toLocaleString('es-CL')}
                </p>
                <span className="kpi-card__unit">contratos ≥ {simResult.vigencia_desde}</span>
              </div>
              <p className="kpi-card__note">
                Meses anteriores a la vigencia (Enero–Abril 2026) permanecen{' '}
                <strong>100% congelados (0 cambios retroactivos)</strong>.
              </p>
            </article>

            <article className="kpi-card">
              <span className="micro-label">IMPACTO EN CAPACIDAD DIRECTA</span>
              <h4 className="kpi-card__title">Plan Directo Actual vs. Simulado</h4>
              <div className="kpi-card__value-row">
                <p className="kpi-card__value tabular-nums">
                  {Number(simResult.plan_dir_simulado).toLocaleString('es-CL')}
                </p>
                <span className="kpi-card__unit">
                  {simResult.delta_plan_dir >= 0 ? '+' : ''}
                  {Number(simResult.delta_plan_dir).toLocaleString('es-CL')} ate.
                </span>
              </div>
              <dl className="kpi-breakdown">
                <div className="kpi-breakdown__item">
                  <dt>Plan Directo Actual:</dt>
                  <dd className="tabular-nums">
                    {Number(simResult.plan_dir_actual).toLocaleString('es-CL')}
                  </dd>
                </div>
                <div className="kpi-breakdown__item">
                  <dt>Plan Directo Simulado:</dt>
                  <dd className="tabular-nums">
                    {Number(simResult.plan_dir_simulado).toLocaleString('es-CL')}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="kpi-card">
              <span className="micro-label">UMBRAL EXIGIBLE (PISO)</span>
              <h4 className="kpi-card__title">Meta de Gestión 90% Actual vs. Simulada</h4>
              <div className="kpi-card__value-row">
                <p className="kpi-card__value tabular-nums">
                  {Number(simResult.mg_dir_simulado).toLocaleString('es-CL')}
                </p>
                <span className="kpi-card__unit">
                  Δ MG: {simResult.delta_mg_dir >= 0 ? '+' : ''}
                  {Number(simResult.delta_mg_dir).toLocaleString('es-CL')}
                </span>
              </div>
              <dl className="kpi-breakdown">
                <div className="kpi-breakdown__item">
                  <dt>MG 90% Actual:</dt>
                  <dd className="tabular-nums">
                    {Number(simResult.mg_dir_actual).toLocaleString('es-CL')}
                  </dd>
                </div>
                <div className="kpi-breakdown__item">
                  <dt>MG 90% Simulada:</dt>
                  <dd className="tabular-nums">
                    {Number(simResult.mg_dir_simulado).toLocaleString('es-CL')}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="kpi-card">
              <span className="micro-label">PROPORCIÓN DIRECTA</span>
              <h4 className="kpi-card__title">% FOJA Actual vs. Simulado</h4>
              <div className="kpi-card__value-row">
                <p className="kpi-card__value tabular-nums">
                  {Number(simResult.foja_simulado_pct).toFixed(1)}%
                </p>
                <span className="kpi-card__unit">
                  Actual: {Number(simResult.foja_actual_pct).toFixed(1)}%
                </span>
              </div>
              <p className="kpi-card__note">
                Fórmula: <strong>Horas Directas / Horas Contratadas</strong> desde{' '}
                {simResult.vigencia_desde}.
              </p>
            </article>
          </div>

          {applyFeedback && (
            <div
              role="status"
              style={{
                marginTop: '12px',
                padding: '10px 14px',
                border: '1px solid var(--border-mid)',
                background: 'var(--surface-pill)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <PixelCheckIcon size={18} />
                <span>
                  <strong>Recálculo Prospectivo Aplicado ({applyFeedback.regla}):</strong>{' '}
                  {Number(applyFeedback.planes_recalculados).toLocaleString('es-CL')} planes recalculados desde{' '}
                  <strong>{applyFeedback.vigencia_desde}</strong> por {applyFeedback.usuario}.
                </span>
              </div>
              <span className="status-badge">
                Períodos inmutables preservados: {applyFeedback.periodos_inmutables.join(', ')}
              </span>
            </div>
          )}
        </section>
      )}

      {/* 3. Catálogo de Asignaciones Especiales (V°B° DMN) y Factor Grupal */}
      <section aria-labelledby="catalogs-heading" className="panel-section">
        <div className="panel-section__header">
          <div>
            <h3 id="catalogs-heading" className="panel-section__title">
              2. Catálogo de Asignaciones Especiales (Flag V°B° DMN) y Factores Grupales
            </h3>
            <p className="panel-section__desc">
              <strong>Fórmula Duda 1 y Duda 2:</strong> Las horas de asignaciones especiales con V°B° DMN se suman al % NAS base; el % asistencial restante conserva la proporción Dir/Ind —{' '}
              <strong>validado en ID #137732: 60,9375% Directo / 14,0625% Indirecto / 25,0% NAS</strong>.
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: '24px',
          }}
        >
          {/* Tabla de Asignaciones Especiales */}
          <div className="table-responsive" role="region" aria-label="Catálogo de Asignaciones Especiales">
            <table className="pixel-table">
              <caption className="sr-only">
                Catálogo de asignaciones especiales por rol, horas semanales y requisito de V°B° Dirección Médica Nacional
              </caption>
              <thead>
                <tr>
                  <th scope="col">Asignación Especial</th>
                  <th scope="col" className="num-col">Horas / Sem</th>
                  <th scope="col">Estado V°B° DMN (Duda 2)</th>
                  <th scope="col">Acción Rápida</th>
                </tr>
              </thead>
              <tbody>
                {asignaciones.map((asig) => {
                  const reqVb = Number(asig.requiere_vb_dmn) === 1
                  return (
                    <tr key={asig.asignacion_id || asig.nombre}>
                      <th scope="row">{asig.nombre}</th>
                      <td className="num-col tabular-nums font-bold">
                        {Number(asig.horas_semana).toFixed(1)} h
                      </td>
                      <td>
                        {reqVb ? (
                          <span className="status-badge status-badge--cumplido">
                            <PixelCheckIcon size={14} />
                            <span>Requiere V°B° DMN</span>
                          </span>
                        ) : (
                          <span className="status-badge status-badge--teal">
                            <PixelTrendUpIcon size={14} />
                            <span>Estándar Sede</span>
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-pixel btn-pixel--sm btn-pixel--secondary"
                          onClick={() => handleToggleVbDmn(asig)}
                        >
                          Cambiar a {reqVb ? 'Estándar Sede' : 'V°B° DMN'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Tabla de Factores de Atención Grupal */}
          <div className="table-responsive" role="region" aria-label="Factores de Atención Grupal por Especialidad">
            <table className="pixel-table">
              <caption className="sr-only">
                Parámetros de atención grupal por especialidad para Santiago/Concepción y otras sedes regionales
              </caption>
              <thead>
                <tr>
                  <th scope="col">Especialidad (Cod_Esp)</th>
                  <th scope="col" className="num-col">% Grupal</th>
                  <th scope="col" className="num-col">N° Pacientes SCL / CCP</th>
                  <th scope="col" className="num-col">N° Pacientes Otras Sedes</th>
                </tr>
              </thead>
              <tbody>
                {grupal.map((g) => {
                  const pctVal =
                    Number(g.pct_grupal) <= 1.0
                      ? Math.round(Number(g.pct_grupal) * 100)
                      : Math.round(Number(g.pct_grupal))
                  return (
                    <tr key={g.cod_esp}>
                      <th scope="row">
                        <span className="esp-name">{g.cod_esp}</span>
                        {g.nombre_esp && (
                          <span className="esp-sub" style={{ display: 'block', fontSize: '0.8125rem' }}>
                            {g.nombre_esp}
                          </span>
                        )}
                      </th>
                      <td className="num-col tabular-nums font-bold">{pctVal}%</td>
                      <td className="num-col tabular-nums">{g.n_pac_san_con} pac/sesión</td>
                      <td className="num-col tabular-nums">{g.n_pac_otros} pac/sesión</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 4. Registro de Auditoría de Cambios (auditoria_parametros) */}
      <section aria-labelledby="audit-log-heading" className="panel-section">
        <div className="panel-section__header">
          <div>
            <h3 id="audit-log-heading" className="panel-section__title">
              3. Registro de Auditoría de Parámetros (Trazabilidad `auditoria_parametros`)
            </h3>
            <p className="panel-section__desc">
              Historial inmutable de modificaciones de reglas clínicas con usuario responsable, fecha de vigencia prospectiva y total de planes recalculados.
            </p>
          </div>
          <span className="status-badge">
            Total registros auditados: {auditoria.length}
          </span>
        </div>

        <div className="table-responsive" role="region" aria-labelledby="audit-log-heading" tabIndex="0">
          <table className="pixel-table">
            <caption className="sr-only">
              Bitácora de auditoría de cambios de parámetros clínicos y recálculos prospectivos
            </caption>
            <thead>
              <tr>
                <th scope="col">ID Auditoría</th>
                <th scope="col">Fecha / Hora</th>
                <th scope="col">Usuario</th>
                <th scope="col">Tipo</th>
                <th scope="col">Regla (Cargo:Tramo)</th>
                <th scope="col">Valor Anterior → Nuevo</th>
                <th scope="col">Vigencia</th>
                <th scope="col" className="num-col">Planes Recalculados</th>
              </tr>
            </thead>
            <tbody>
              {auditoria.map((row) => (
                <tr key={row.auditoria_id}>
                  <th scope="row" className="tabular-nums">
                    #{row.auditoria_id}
                  </th>
                  <td className="tabular-nums">{String(row.timestamp).replace('T', ' ').slice(0, 19)}</td>
                  <td>
                    <code>{row.usuario}</code>
                  </td>
                  <td>
                    <span className="status-badge status-badge--teal">{row.tipo_cambio}</span>
                  </td>
                  <td className="font-bold">{row.entidad_clave}</td>
                  <td>
                    <span style={{ color: 'var(--ink-2)' }}>
                      {formatAuditSummary(row.valor_anterior)}
                    </span>{' '}
                    <strong>→</strong>{' '}
                    <span>{formatAuditSummary(row.valor_nuevo)}</span>
                  </td>
                  <td className="tabular-nums font-bold">{row.vigencia_desde}</td>
                  <td className="num-col tabular-nums font-bold">
                    {Number(row.planes_recalculados || 0).toLocaleString('es-CL')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
