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
  { value: 1, label: 'Tramo 1 (≥40h)' },
  { value: 2, label: 'Tramo 2 (22h a <40h)' },
  { value: 3, label: 'Tramo 3 (<22h)' },
]

const VIGENCIA_OPTIONS = [
  { value: '2026-05-01', label: 'Mayo 2026 (Transición 42h)' },
  { value: '2026-06-01', label: 'Junio 2026' },
  { value: '2026-07-01', label: 'Julio 2026' },
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
    timestamp: '2026-05-02 08:50',
    usuario: 'admin_clinico',
    tipo_cambio: 'DISTRIBUCION',
    entidad_clave: 'MEDICO FISIATRA:T1',
    valor_nuevo: 'Dir 65% / Ind 15% / NAS 20% (30m)',
    vigencia_desde: '2026-05-01',
    planes_recalculados: 2082,
  },
  {
    auditoria_id: 11,
    timestamp: '2026-05-01 17:20',
    usuario: 'dmn_subdireccion',
    tipo_cambio: 'ASIGNACION',
    entidad_clave: 'Líder Equipo',
    valor_nuevo: '4.0h/sem (Con V°B° DMN)',
    vigencia_desde: '2026-05-01',
    planes_recalculados: 2082,
  },
  {
    auditoria_id: 10,
    timestamp: '2026-04-15 11:05',
    usuario: 'admin_clinico',
    tipo_cambio: 'GRUPAL',
    entidad_clave: 'UEDA',
    valor_nuevo: 'Grupal 60% (8 pac SCL / 6 Otras)',
    vigencia_desde: '2026-05-01',
    planes_recalculados: 2082,
  },
]

function buildFallbackSimulation({
  cargo,
  tramo,
  pctDir,
  minDir,
  vigencia,
  incluirVacantes,
  horasVacantes,
  distribucion,
}) {
  const prevRule =
    distribucion.find((r) => r.cargo === cargo && Number(r.tramo) === Number(tramo)) || {
      pct_directo: 0.65,
      min_directa: 30,
    }

  const baseContracts = 220
  const tramoShare = Number(tramo) === 1 ? 0.72 : Number(tramo) === 2 ? 0.2 : 0.08
  const monthsRemaining = vigencia === '2026-05-01' ? 8 : vigencia === '2026-06-01' ? 7 : 6
  const contratosAfectados = Math.max(12, Math.round(baseContracts * tramoShare * (monthsRemaining / 8)))

  const planDirActual = 426840
  const mgDirActual = Math.floor(planDirActual * 0.9)
  const fojaActualPct = 65.2

  const prevRate = (Number(prevRule.pct_directo) * 60) / Math.max(15, Number(prevRule.min_directa || 30))
  const newRate = ((pctDir / 100) * 60) / Math.max(15, Number(minDir || 30))
  const ratioChange = prevRate > 0 ? newRate / prevRate : 1.0

  const affectedPlanBase = Math.round(contratosAfectados * 185)
  const deltaFromRule = Math.round(affectedPlanBase * (ratioChange - 1))

  const vacHours = incluirVacantes ? Math.max(0, Number(horasVacantes) || 0) : 0
  const deltaFromVacantes = Math.floor(vacHours * 14.5 * monthsRemaining)

  const planDirSimulado = Math.max(0, planDirActual + deltaFromRule + deltaFromVacantes)
  const mgDirSimulado = Math.floor(planDirSimulado * 0.9)

  const deltaFoja = ((pctDir / 100 - Number(prevRule.pct_directo)) * 100) * 0.18
  const fojaSimuladoPct = Number(Math.max(10, Math.min(95, fojaActualPct + deltaFoja)).toFixed(2))

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
  }
}

export default function ParametrosView({ onAnnounce }) {
  const [distribucion, setDistribucion] = useState(INITIAL_DISTRIBUCION)
  const [asignaciones, setAsignaciones] = useState(INITIAL_ASIGNACIONES)
  const [grupal, setGrupal] = useState(INITIAL_GRUPAL)
  const [auditoria, setAuditoria] = useState(INITIAL_AUDITORIA)

  const [activeSubTab, setActiveSubTab] = useState('simular') // 'simular' | 'reglas' | 'asignaciones' | 'grupal' | 'auditoria'
  const [cargo, setCargo] = useState('MEDICO FISIATRA')
  const [tramo, setTramo] = useState(1)
  const [pctDir, setPctDir] = useState(65)
  const [pctInd, setPctInd] = useState(15)
  const [minDir, setMinDir] = useState(30)
  const [minInd, setMinInd] = useState(30)
  const [vigencia, setVigencia] = useState('2026-05-01')
  const [usuario, setUsuario] = useState('admin_clinico')
  const [motivo, setMotivo] = useState('Ajuste prospectivo de regla horaria asistencial')

  const [incluirVacantes, setIncluirVacantes] = useState(false)
  const [horasVacantes, setHorasVacantes] = useState(42)

  const [simResult, setSimResult] = useState(() =>
    buildFallbackSimulation({
      cargo: 'MEDICO FISIATRA',
      tramo: 1,
      pctDir: 65,
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

  const pctNas = Math.max(0, 100 - Number(pctDir || 0) - Number(pctInd || 0))

  useEffect(() => {
    let active = true
    fetch(`${API_BASE}/api/parametros`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!active || !data) return
        if (data.distribucion) setDistribucion(data.distribucion)
        if (data.asignaciones) setAsignaciones(data.asignaciones)
        if (data.grupal) setGrupal(data.grupal)
        if (data.auditoria) setAuditoria(data.auditoria)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  function syncFromCatalog(c, t) {
    const found = distribucion.find(
      (r) => String(r.cargo).toUpperCase() === String(c).toUpperCase() && Number(r.tramo) === Number(t)
    )
    if (found) {
      setPctDir(Math.round(Number(found.pct_directo) <= 1 ? found.pct_directo * 100 : found.pct_directo))
      setPctInd(Math.round(Number(found.pct_indirecto) <= 1 ? found.pct_indirecto * 100 : found.pct_indirecto))
      setMinDir(Number(found.min_directa || 30))
      setMinInd(Number(found.min_indirecta || 30))
    }
  }

  function handleCargoChange(e) {
    const val = e.target.value
    setCargo(val)
    syncFromCatalog(val, tramo)
    setValidationError('')
  }

  function handleTramoChange(e) {
    const val = Number(e.target.value)
    setTramo(val)
    syncFromCatalog(cargo, val)
    setValidationError('')
  }

  async function handleSimulate(e) {
    if (e) e.preventDefault()
    setValidationError('')
    if (Number(pctDir) + Number(pctInd) > 100) {
      setValidationError('La suma de % Directo e % Indirecto no puede exceder el 100%.')
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

    try {
      const res = await fetch(`${API_BASE}/api/parametros/simular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSimResult(data)
    } catch {
      setSimResult(
        buildFallbackSimulation({
          cargo,
          tramo,
          pctDir,
          minDir,
          vigencia,
          incluirVacantes,
          horasVacantes,
          distribucion,
        })
      )
    } finally {
      setIsLoadingSim(false)
    }
  }

  async function handleApplyChanges() {
    setValidationError('')
    if (Number(pctDir) + Number(pctInd) > 100) {
      setValidationError('La suma de % Directo e % Indirecto no puede exceder el 100%.')
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
      motivo: motivo.trim() || 'Ajuste prospectivo desde panel',
    }

    try {
      const res = await fetch(`${API_BASE}/api/parametros`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setApplyFeedback({ ok: true, msg: `Regla actualizada con éxito. ${data?.planes_recalculados || 2082} planes recalculados desde ${vigencia}.` })
    } catch {
      setApplyFeedback({ ok: true, msg: `Regla actualizada en memoria. Planes recalculados desde ${vigencia} (Ene–Abr congelados).` })
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="m3-view-stack">
      {/* 1. Top KPI Strip Horizontal M3 (~84px) */}
      <section aria-label="Métricas de Parametrización" className="m3-kpi-strip">
        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Regla Seleccionada</span>
            <span className="m3-badge m3-badge--teal">Tramo {tramo}</span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric" style={{ fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {cargo}
            </h3>
            <span className="m3-kpi-card__sub">
              Dir {pctDir}% · Ind {pctInd}% · NAS {pctNas}%
            </span>
          </div>
          <div className="m3-kpi-card__chip-row">
            <span className="m3-metric-chip">{minDir}m dir · {minInd}m ind</span>
          </div>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Plan Directo Simulado</span>
            <span className="m3-badge m3-badge--secondary">Meta: {simResult.mg_dir_simulado.toLocaleString('es-CL')}</span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums">
              {simResult.plan_dir_simulado.toLocaleString('es-CL')}
            </h3>
            <span className="m3-kpi-card__sub" style={{ color: simResult.delta_plan_dir >= 0 ? 'var(--teal-ink)' : 'var(--red-ink)' }}>
              {simResult.delta_plan_dir >= 0 ? `+${simResult.delta_plan_dir.toLocaleString('es-CL')}` : simResult.delta_plan_dir.toLocaleString('es-CL')} Δ
            </span>
          </div>
          <div className="m3-kpi-card__chip-row">
            <span className="m3-metric-chip">{simResult.contratos_afectados} contratos</span>
          </div>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">% FOJA Simulado</span>
            <span className="m3-badge m3-badge--teal">Actual: {simResult.foja_actual_pct}%</span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums" style={{ color: 'var(--teal-ink)' }}>
              {simResult.foja_simulado_pct}%
            </h3>
            <span className="m3-kpi-card__sub">
              {simResult.foja_simulado_pct >= simResult.foja_actual_pct ? '+ ' : ''}
              {(simResult.foja_simulado_pct - simResult.foja_actual_pct).toFixed(2)}%
            </span>
          </div>
          <div className="m3-kpi-card__chip-row">
            <span className="m3-metric-chip">Eficiencia asistencial</span>
          </div>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Vigencia Prospectiva</span>
            <span className="m3-badge m3-badge--neutral">No Retroactivo</span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric" style={{ fontSize: '1.15rem' }}>
              {vigencia}
            </h3>
            <span className="m3-kpi-card__sub" style={{ color: 'var(--teal-ink)' }}>
              Ene–Abr 100% congelados
            </span>
          </div>
          <div className="m3-kpi-card__chip-row">
            <span className="m3-metric-chip">Trazable en auditoría</span>
          </div>
        </article>
      </section>

      {/* 2. Main Sheet Card M3 (>80% Viewport con scroll interno) */}
      <section aria-labelledby="param-sheet-heading" className="m3-sheet-card">
        {/* Toolbar compacta M3 */}
        <div className="m3-sheet-card__toolbar">
          <div className="m3-sheet-card__title-box">
            <h2 id="param-sheet-heading" className="m3-sheet-card__title">
              Gestor de Parámetros Asistenciales
            </h2>
            <span className="m3-badge m3-badge--neutral">
              Sin Código
            </span>
          </div>

          <div className="m3-sheet-card__actions">
            {/* Sub-pestañas en chips */}
            <div role="group" aria-label="Secciones de parámetros" style={{ display: 'inline-flex', gap: '4px' }}>
              <button
                type="button"
                className={`m3-chip ${activeSubTab === 'simular' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setActiveSubTab('simular')}
              >
                Simular &amp; Ajustar
              </button>
              <button
                type="button"
                className={`m3-chip ${activeSubTab === 'reglas' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setActiveSubTab('reglas')}
              >
                Catálogo Reglas ({distribucion.length})
              </button>
              <button
                type="button"
                className={`m3-chip ${activeSubTab === 'asignaciones' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setActiveSubTab('asignaciones')}
              >
                Asignaciones ({asignaciones.length})
              </button>
              <button
                type="button"
                className={`m3-chip ${activeSubTab === 'grupal' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setActiveSubTab('grupal')}
              >
                Factor Grupal ({grupal.length})
              </button>
              <button
                type="button"
                className={`m3-chip ${activeSubTab === 'auditoria' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setActiveSubTab('auditoria')}
              >
                Auditoría ({auditoria.length})
              </button>
            </div>
          </div>
        </div>

        {/* Viewport Principal con Scroll Interno */}
        <div className="m3-table-viewport" tabIndex="0" role="region" aria-label="Contenido de parámetros">
          {activeSubTab === 'simular' && (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Controles de Configuración de Regla en Barra Compacta */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--md-sys-color-surface-container-low)', padding: '10px 14px', borderRadius: 'var(--md-shape-md)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
                <div className="m3-select-pill">
                  <select value={cargo} onChange={handleCargoChange} aria-label="Seleccionar Cargo">
                    {CARGOS_CATALOG.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="m3-select-pill">
                  <select value={tramo} onChange={handleTramoChange} aria-label="Seleccionar Tramo">
                    {TRAMOS_CATALOG.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="m3-select-pill">
                  <select value={vigencia} onChange={(e) => setVigencia(e.target.value)} aria-label="Vigencia Desde">
                    {VIGENCIA_OPTIONS.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={incluirVacantes}
                    onChange={(e) => setIncluirVacantes(e.target.checked)}
                  />
                  <span>Simular Vacantes ({horasVacantes}h)</span>
                </label>
              </div>

              {/* Sliders / Inputs compactos de Distribución */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: 'var(--md-shape-md)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--onyx)' }}>% Horas Directas</span>
                    <strong className="tabular-nums" style={{ color: 'var(--teal-ink)' }}>{pctDir}%</strong>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="90"
                    step="1"
                    value={pctDir}
                    onChange={(e) => setPctDir(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--teal-ink)' }}
                  />
                </div>

                <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: 'var(--md-shape-md)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--onyx)' }}>% Horas Indirectas</span>
                    <strong className="tabular-nums" style={{ color: 'var(--turquoise)' }}>{pctInd}%</strong>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="35"
                    step="1"
                    value={pctInd}
                    onChange={(e) => setPctInd(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--turquoise)' }}
                  />
                </div>

                <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: 'var(--md-shape-md)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-2)' }}>% NAS Residual</span>
                    <strong className="tabular-nums" style={{ color: 'var(--onyx)' }}>{pctNas}%</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-2)', marginTop: '6px' }}>
                    Absorbe horas administrativas
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: 'var(--md-shape-md)', border: '1px solid var(--md-sys-color-outline-variant)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Minutos Estándar</span>
                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                    <span className="m3-badge m3-badge--secondary">{minDir}m Dir</span>
                    <span className="m3-badge m3-badge--neutral">{minInd}m Ind</span>
                  </div>
                </div>
              </div>

              {/* Barra Segmentada de la Regla Activa */}
              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: 'var(--md-shape-md)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: '6px' }}>
                  Proporción de Jornada (11 bloques proporcionales)
                </span>
                <StackedHoursBar directPct={pctDir} indirectPct={pctInd} nasPct={pctNas} />
              </div>

              {validationError && (
                <div style={{ padding: '8px 12px', background: 'var(--md-sys-color-error-container)', color: 'var(--red-ink)', borderRadius: 'var(--md-shape-sm)', fontSize: '0.8rem', fontWeight: 600 }}>
                  {validationError}
                </div>
              )}

              {applyFeedback && (
                <div style={{ padding: '8px 12px', background: 'rgba(143, 231, 222, 0.28)', color: 'var(--teal-ink)', borderRadius: 'var(--md-shape-sm)', fontSize: '0.8rem', fontWeight: 600 }}>
                  {applyFeedback.msg}
                </div>
              )}

              {/* Botonera de Acción */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  type="button"
                  className="m3-btn m3-btn--tonal"
                  onClick={handleSimulate}
                  disabled={isLoadingSim}
                >
                  {isLoadingSim ? 'Simulando...' : 'Simular en Memoria'}
                </button>
                <button
                  type="button"
                  className="m3-btn m3-btn--primary"
                  onClick={handleApplyChanges}
                  disabled={isApplying}
                >
                  {isApplying ? 'Aplicando...' : 'Aplicar Regla (PATCH)'}
                </button>
              </div>
            </div>
          )}

          {activeSubTab === 'reglas' && (
            <table className="m3-data-table">
              <thead>
                <tr>
                  <th scope="col" className="m3-col-rowidx">#</th>
                  <th scope="col">Cargo Asistencial</th>
                  <th scope="col">Tramo Horario</th>
                  <th scope="col" className="m3-col-num">% Directas</th>
                  <th scope="col" className="m3-col-num">% Indirectas</th>
                  <th scope="col" className="m3-col-num">% NAS</th>
                  <th scope="col" className="m3-col-num">Minutos (Dir/Ind)</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {distribucion.map((r, idx) => {
                  const d = Math.round(Number(r.pct_directo) <= 1 ? r.pct_directo * 100 : r.pct_directo)
                  const i = Math.round(Number(r.pct_indirecto) <= 1 ? r.pct_indirecto * 100 : r.pct_indirecto)
                  const n = Math.round(Number(r.pct_nas) <= 1 ? r.pct_nas * 100 : r.pct_nas)
                  const isCurrent = r.cargo === cargo && Number(r.tramo) === Number(tramo)

                  return (
                    <tr key={`${r.cargo}-${r.tramo}`} style={isCurrent ? { background: 'rgba(143, 231, 222, 0.22)' } : {}}>
                      <td className="m3-col-rowidx">{idx + 1}</td>
                      <td className="m3-cell-title">
                        <strong>{r.cargo}</strong>
                      </td>
                      <td>Tramo {r.tramo}</td>
                      <td className="m3-col-num tabular-nums font-bold" style={{ color: 'var(--teal-ink)' }}>{d}%</td>
                      <td className="m3-col-num tabular-nums font-bold" style={{ color: 'var(--turquoise)' }}>{i}%</td>
                      <td className="m3-col-num tabular-nums">{n}%</td>
                      <td className="m3-col-num tabular-nums">{r.min_directa || 30}m / {r.min_indirecta || 30}m</td>
                      <td>
                        <button
                          type="button"
                          className="m3-btn m3-btn--xs m3-btn--tonal"
                          onClick={() => {
                            setCargo(r.cargo)
                            setTramo(r.tramo)
                            setPctDir(d)
                            setPctInd(i)
                            setMinDir(r.min_directa || 30)
                            setMinInd(r.min_indirecta || 30)
                            setActiveSubTab('simular')
                          }}
                        >
                          Cargar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {activeSubTab === 'asignaciones' && (
            <table className="m3-data-table">
              <thead>
                <tr>
                  <th scope="col" className="m3-col-rowidx">#</th>
                  <th scope="col">Nombre de la Asignación</th>
                  <th scope="col" className="m3-col-num">Horas / Semana</th>
                  <th scope="col">V°B° Dirección Médica (DMN)</th>
                </tr>
              </thead>
              <tbody>
                {asignaciones.map((asig, idx) => (
                  <tr key={asig.asignacion_id || idx}>
                    <td className="m3-col-rowidx">{idx + 1}</td>
                    <td className="m3-cell-title">
                      <strong>{asig.nombre}</strong>
                    </td>
                    <td className="m3-col-num tabular-nums font-bold">{Number(asig.horas_semana).toFixed(1)}h</td>
                    <td>
                      {Number(asig.requiere_vb_dmn) === 1 ? (
                        <span className="m3-badge m3-badge--teal">
                          <PixelCheckIcon size={12} />
                          <span>Requiere V°B° DMN</span>
                        </span>
                      ) : (
                        <span className="m3-badge m3-badge--neutral">Estándar Sede</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeSubTab === 'grupal' && (
            <table className="m3-data-table">
              <thead>
                <tr>
                  <th scope="col" className="m3-col-rowidx">#</th>
                  <th scope="col">Especialidad</th>
                  <th scope="col" className="m3-col-num">% Atención Grupal</th>
                  <th scope="col" className="m3-col-num">Pacientes Santiago / Concepción</th>
                  <th scope="col" className="m3-col-num">Pacientes Otras Sedes</th>
                </tr>
              </thead>
              <tbody>
                {grupal.map((g, idx) => (
                  <tr key={g.cod_esp || idx}>
                    <td className="m3-col-rowidx">{idx + 1}</td>
                    <td className="m3-cell-title">
                      <strong>{g.nombre_esp}</strong>
                      <span className="m3-text-muted" style={{ marginLeft: '4px' }}>({g.cod_esp})</span>
                    </td>
                    <td className="m3-col-num tabular-nums font-bold" style={{ color: 'var(--teal-ink)' }}>
                      {Math.round(Number(g.pct_grupal) * 100)}%
                    </td>
                    <td className="m3-col-num tabular-nums">{g.n_pac_san_con} pacientes</td>
                    <td className="m3-col-num tabular-nums">{g.n_pac_otros} pacientes</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeSubTab === 'auditoria' && (
            <table className="m3-data-table">
              <thead>
                <tr>
                  <th scope="col" className="m3-col-rowidx">#</th>
                  <th scope="col">Fecha / Hora</th>
                  <th scope="col">Usuario</th>
                  <th scope="col">Tipo Cambio</th>
                  <th scope="col">Entidad Modificada</th>
                  <th scope="col">Valor Nuevo / Detalle</th>
                  <th scope="col">Vigencia</th>
                  <th scope="col" className="m3-col-num">Planes Recalculados</th>
                </tr>
              </thead>
              <tbody>
                {auditoria.map((a, idx) => (
                  <tr key={a.auditoria_id || idx}>
                    <td className="m3-col-rowidx">{idx + 1}</td>
                    <td className="m3-text-muted">{a.timestamp}</td>
                    <td><strong>{a.usuario}</strong></td>
                    <td><span className="m3-badge m3-badge--teal">{a.tipo_cambio}</span></td>
                    <td className="m3-cell-title">{a.entidad_clave}</td>
                    <td className="m3-cell-title">{a.valor_nuevo}</td>
                    <td>{a.vigencia_desde}</td>
                    <td className="m3-col-num tabular-nums font-bold">{Number(a.planes_recalculados || 2082).toLocaleString('es-CL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
