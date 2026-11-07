import React, { useState, useEffect, useMemo } from 'react'
import {
  PixelAlertIcon,
  PixelCheckIcon,
  PixelTrendUpIcon,
  PixelStatusBadge,
} from '../components/PixelIcons.jsx'
import SegmentedBar from '../components/SegmentedBar.jsx'
import { classifyWcagAlert, MOCK_INSTITUTOS } from '../api.js'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const MOCK_PROFESIONALES_BASE = [
  {
    persona_id: 137732,
    it: 1301,
    sigla: 'SCL',
    cod_esp: 'FISIATRIA',
    area: 'ADMISION Y SOPORTE MEDICO',
    cargo: 'MEDICO FISIATRA',
    nota_clinica: 'Caso Dorado Duda 1 (Asig. Líder 4h con V°B° DMN)',
    plan_directo: 184,
    meta_gestion: 165,
    real_directo: 131,
  },
  {
    persona_id: 125129,
    it: 201,
    sigla: 'ANT',
    cod_esp: 'KINESIOLOGIA',
    area: 'UNIDAD MOTORA Y MARCHA',
    cargo: 'KINESIOLOGO/A',
    nota_clinica: 'Multi-sede Norte (Antofagasta 22h)',
    plan_directo: 118,
    meta_gestion: 106,
    real_directo: 112,
  },
  {
    persona_id: 125129,
    it: 202,
    sigla: 'CAL',
    cod_esp: 'KINESIOLOGIA',
    area: 'UNIDAD MOTORA Y MARCHA',
    cargo: 'KINESIOLOGO/A',
    nota_clinica: 'Multi-sede Norte (Calama 20h)',
    plan_directo: 108,
    meta_gestion: 97,
    real_directo: 110,
  },
  {
    persona_id: 141845,
    it: 1301,
    sigla: 'SCL',
    cod_esp: 'TERAPIA OCUPACIONAL',
    area: 'REHABILITACION INFANTIL',
    cargo: 'TERAPEUTA OCUPACIONAL',
    nota_clinica: 'Nueva Contratación Mayo 2026 (42h)',
    plan_directo: 216,
    meta_gestion: 194,
    real_directo: 204,
  },
  {
    persona_id: 130412,
    it: 801,
    sigla: 'CCP',
    cod_esp: 'FONOAUDIOLOGIA',
    area: 'UNIDAD COGNITIVA Y SENSORIAL',
    cargo: 'FONOAUDIOLOGO/A',
    nota_clinica: 'Jornada 42h Concepción',
    plan_directo: 210,
    meta_gestion: 189,
    real_directo: 221,
  },
  {
    persona_id: 134890,
    it: 501,
    sigla: 'VAL',
    cod_esp: 'EDUCACION DIFERENCIAL',
    area: 'TERAPIAS INTEGRALES',
    cargo: 'EDUCADOR/A DIFERENCIAL',
    nota_clinica: 'Factor Grupal ED (25% grupal)',
    plan_directo: 245,
    meta_gestion: 220,
    real_directo: 191,
  },
  {
    persona_id: 128904,
    it: 1301,
    sigla: 'SCL',
    cod_esp: 'PSICOLOGIA',
    area: 'UNIDAD COGNITIVA Y SENSORIAL',
    cargo: 'PSICOLOGO/A CLINICO',
    nota_clinica: 'Atención integral familiar (45 min)',
    plan_directo: 142,
    meta_gestion: 127,
    real_directo: 134,
  },
  {
    persona_id: 139102,
    it: 901,
    sigla: 'TEM',
    cod_esp: 'ENFERMERIA',
    area: 'ADMISION Y SOPORTE MEDICO',
    cargo: 'ENFERMERO/A REHABILITACION',
    nota_clinica: 'Cuidados continuos rehabilitación',
    plan_directo: 204,
    meta_gestion: 183,
    real_directo: 212,
  },
  {
    persona_id: 132775,
    it: 1001,
    sigla: 'PMC',
    cod_esp: 'TRABAJO SOCIAL',
    area: 'REHABILITACION INFANTIL',
    cargo: 'ASISTENTE SOCIAL',
    nota_clinica: 'Factor Grupal AS (15% grupal)',
    plan_directo: 196,
    meta_gestion: 176,
    real_directo: 182,
  },
  {
    persona_id: 136501,
    it: 401,
    sigla: 'COQ',
    cod_esp: 'FISIATRIA',
    area: 'ADMISION Y SOPORTE MEDICO',
    cargo: 'MEDICO FISIATRA',
    nota_clinica: 'Evaluación médica de ingreso',
    plan_directo: 172,
    meta_gestion: 154,
    real_directo: 124,
  },
]

function buildMockIndividualPlanVsReal(filters = {}) {
  const periodo = filters.mes || '2026-05-01'
  const selectedInst = MOCK_INSTITUTOS.find((i) => String(i.it) === String(filters.instituto))

  const filtered = MOCK_PROFESIONALES_BASE.filter((row) => {
    if (filters.instituto && String(row.it) !== String(filters.instituto)) return false
    if (filters.esp && row.cod_esp !== filters.esp) return false
    if (filters.area && row.area !== filters.area) return false
    if (filters.cargo && row.cargo !== filters.cargo) return false
    return true
  })

  const baseList = filtered.length > 0 ? filtered : MOCK_PROFESIONALES_BASE
  return baseList.map((item) => {
    const itCode = selectedInst ? selectedInst.it : item.it
    const sigla = selectedInst ? selectedInst.sigla : item.sigla
    const planDir = Number(item.plan_directo)
    const mgDir = Number(item.meta_gestion)
    const realDir = Number(item.real_directo)
    const cumplimiento = planDir > 0 ? Number(((realDir / planDir) * 100).toFixed(1)) : 0
    const desviacion = planDir > 0 ? Number((((realDir - planDir) / planDir) * 100).toFixed(1)) : 0

    return {
      periodo,
      it: itCode,
      sigla,
      cod_esp: item.cod_esp,
      persona_id: item.persona_id,
      cargo: item.cargo,
      nota_clinica: item.nota_clinica,
      plan_directo: planDir,
      real_directo: realDir,
      meta_gestion: mgDir,
      cumplimiento_pct: cumplimiento,
      desviacion_pct: desviacion,
      alerta: classifyWcagAlert(realDir, planDir, mgDir),
    }
  })
}

export default function PlanVsRealView({ planVsReal = [], filters = {}, onChangeFilter }) {
  const [agrupado, setAgrupado] = useState(true)
  const [statusFilter, setStatusFilter] = useState('TODOS')
  const [individualRows, setIndividualRows] = useState(() =>
    buildMockIndividualPlanVsReal(filters)
  )
  const [isLoadingIndividual, setIsLoadingIndividual] = useState(false)

  useEffect(() => {
    let active = true
    if (agrupado) return undefined

    setIsLoadingIndividual(true)
    setIndividualRows(buildMockIndividualPlanVsReal(filters))

    async function loadIndividual() {
      try {
        const params = new URLSearchParams()
        if (filters.instituto) params.set('it', filters.instituto)
        if (filters.mes) params.set('periodo', filters.mes)
        if (filters.area) params.set('area', filters.area)
        if (filters.cargo) params.set('cargo', filters.cargo)
        if (filters.esp) params.set('cod_esp', filters.esp)
        params.set('agrupado', 'false')

        const res = await fetch(`${API_BASE}/api/plan-vs-real?${params.toString()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (active && Array.isArray(data) && data.length > 0) {
          setIndividualRows(data)
        }
      } catch {
        // fallback
      } finally {
        if (active) setIsLoadingIndividual(false)
      }
    }

    loadIndividual()
    return () => {
      active = false
    }
  }, [agrupado, filters])

  const activeDataset = agrupado ? planVsReal : individualRows

  const summary = useMemo(() => {
    let critico = 0
    let cumplido = 0
    let superavit = 0
    let totalPlan = 0
    let totalReal = 0
    let totalMg = 0

    for (const row of activeDataset) {
      const nivel = row.alerta?.nivel
      if (nivel === 'CRITICO') critico += 1
      else if (nivel === 'SUPERAVIT') superavit += 1
      else cumplido += 1

      totalPlan += Number(row.plan_directo || 0)
      totalReal += Number(row.real_directo || 0)
      totalMg += Number(row.meta_gestion || 0)
    }

    const brecha = totalReal - totalPlan
    const cumplimientoPct = totalPlan > 0 ? ((totalReal / totalPlan) * 100).toFixed(1) : '0'

    return {
      critico,
      cumplido,
      superavit,
      total: activeDataset.length,
      totalPlan,
      totalReal,
      totalMg,
      brecha,
      cumplimientoPct,
    }
  }, [activeDataset])

  const filteredRows = useMemo(() => {
    if (statusFilter === 'TODOS') return activeDataset
    return activeDataset.filter((row) => row.alerta?.nivel === statusFilter)
  }, [activeDataset, statusFilter])

  return (
    <div className="m3-view-stack">
      {/* 1. Top KPI Strip Horizontal M3 (Compacto ~84px) */}
      <section aria-label="Métricas Plan vs Real" className="m3-kpi-strip">
        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Plan Directo (100%)</span>
            <span className="m3-badge m3-badge--teal">Meta 90%: {summary.totalMg.toLocaleString('es-CL')}</span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums">
              {summary.totalPlan.toLocaleString('es-CL')}
            </h3>
            <span className="m3-kpi-card__sub">Atenciones Planificadas</span>
          </div>
          <div className="m3-kpi-card__chip-row">
            <span className="m3-metric-chip">{summary.total} {agrupado ? 'sedes/esp.' : 'profesionales'}</span>
          </div>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Real SIC</span>
            <span className="m3-badge m3-badge--secondary">{summary.cumplimientoPct}% del Plan</span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums">
              {summary.totalReal.toLocaleString('es-CL')}
            </h3>
            <span className="m3-kpi-card__sub" style={{ color: summary.brecha >= 0 ? 'var(--teal-ink)' : 'var(--red-ink)' }}>
              {summary.brecha >= 0 ? `+${summary.brecha.toLocaleString('es-CL')}` : summary.brecha.toLocaleString('es-CL')}
            </span>
          </div>
          <div className="m3-kpi-card__chip-row">
            <span className="m3-metric-chip">Ejecución registrada</span>
          </div>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Alertas Críticas (&lt;90%)</span>
            <span className="m3-badge" style={{ background: 'var(--md-sys-color-error-container)', color: 'var(--red-ink)' }}>
              Prioritario
            </span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums" style={{ color: 'var(--red-ink)' }}>
              {summary.critico}
            </h3>
            <span className="m3-kpi-card__sub" style={{ color: 'var(--ink-2)' }}>
              de {summary.total} registros
            </span>
          </div>
          <div className="m3-kpi-card__chip-row">
            <span className="m3-metric-chip">Bajo umbral exigible</span>
          </div>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">En Meta / Superávit</span>
            <span className="m3-badge m3-badge--teal">MG ≥ 90%</span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums" style={{ color: 'var(--teal-ink)' }}>
              {summary.cumplido + summary.superavit}
            </h3>
            <span className="m3-kpi-card__sub">
              {summary.cumplido} meta · {summary.superavit} superávit
            </span>
          </div>
          <div className="m3-kpi-card__chip-row">
            <span className="m3-metric-chip">Operación normal</span>
          </div>
        </article>
      </section>

      {/* 2. Main Sheet Card M3 (>80% Viewport con scroll interno) */}
      <section aria-labelledby="pvr-sheet-heading" className="m3-sheet-card">
        {/* Toolbar compacta M3 */}
        <div className="m3-sheet-card__toolbar">
          <div className="m3-sheet-card__title-box">
            <h2 id="pvr-sheet-heading" className="m3-sheet-card__title">
              Matriz Planificado vs. Real SIC
            </h2>
            <span className="m3-badge m3-badge--neutral">
              {filteredRows.length} {filteredRows.length === 1 ? 'fila' : 'filas'}
            </span>
          </div>

          <div className="m3-sheet-card__actions">
            {/* Toggle Agrupado / Individual */}
            <div role="group" aria-label="Nivel de vista" style={{ display: 'inline-flex', gap: '4px' }}>
              <button
                type="button"
                className={`m3-chip ${agrupado ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setAgrupado(true)}
              >
                Agrupado Sede/Esp.
              </button>
              <button
                type="button"
                className={`m3-chip ${!agrupado ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setAgrupado(false)}
              >
                Por Profesional
              </button>
            </div>

            {/* Chips de filtro por estado WCAG */}
            <div role="group" aria-label="Filtro de estado" style={{ display: 'inline-flex', gap: '4px' }}>
              <button
                type="button"
                className={`m3-chip ${statusFilter === 'TODOS' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setStatusFilter('TODOS')}
              >
                Todos ({summary.total})
              </button>
              <button
                type="button"
                className={`m3-chip ${statusFilter === 'CRITICO' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                style={statusFilter === 'CRITICO' ? { background: 'var(--md-sys-color-error-container)', color: 'var(--red-ink)', borderColor: 'var(--red-ink)' } : {}}
                onClick={() => setStatusFilter('CRITICO')}
              >
                <PixelAlertIcon size={12} />
                <span>Críticos ({summary.critico})</span>
              </button>
              <button
                type="button"
                className={`m3-chip ${statusFilter === 'CUMPLIDO' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setStatusFilter('CUMPLIDO')}
              >
                <PixelCheckIcon size={12} />
                <span>En Meta ({summary.cumplido})</span>
              </button>
              <button
                type="button"
                className={`m3-chip ${statusFilter === 'SUPERAVIT' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setStatusFilter('SUPERAVIT')}
              >
                <PixelTrendUpIcon size={12} />
                <span>Superávit ({summary.superavit})</span>
              </button>
            </div>

            {filters.esp && (
              <button
                type="button"
                className="m3-chip m3-chip--reset"
                onClick={() => onChangeFilter && onChangeFilter('esp', '')}
                title="Quitar filtro de especialidad"
              >
                × {filters.esp}
              </button>
            )}
          </div>
        </div>

        {/* Viewport de Tabla con Scroll Interno */}
        <div className="m3-table-viewport" tabIndex="0" role="region" aria-label="Tabla de ejecución Plan vs Real">
          <table className="m3-data-table">
            <thead>
              <tr>
                <th scope="col" className="m3-col-rowidx">#</th>
                <th scope="col">Especialidad</th>
                <th scope="col">Sede</th>
                {!agrupado && <th scope="col">Profesional</th>}
                <th scope="col" className="m3-col-num">Plan (100%)</th>
                <th scope="col" className="m3-col-num">Meta (90%)</th>
                <th scope="col" className="m3-col-num">Real (SIC)</th>
                <th scope="col" className="m3-col-num">Brecha</th>
                <th scope="col" className="m3-col-num">% Ejec.</th>
                <th scope="col" style={{ width: '130px' }}>Avance</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={agrupado ? 10 : 11} style={{ padding: '24px', color: 'var(--ink-2)' }}>
                    No hay registros con el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const planDir = Number(row.plan_directo || 0)
                  const mgDir = Number(row.meta_gestion || 0)
                  const realDir = Number(row.real_directo || 0)
                  const brecha = realDir - planDir
                  const brechaSign = brecha > 0 ? '+' : brecha < 0 ? '−' : ''
                  const brechaAbs = Math.abs(brecha).toLocaleString('es-CL')
                  const cumpl = Number(
                    row.cumplimiento_pct ?? (planDir > 0 ? (realDir / planDir) * 100 : 0)
                  )
                  const isCritico = row.alerta?.nivel === 'CRITICO'

                  return (
                    <tr key={`${row.cod_esp}-${row.it || 'nac'}-${row.persona_id || idx}`} className={isCritico ? 'm3-row--error' : ''}>
                      <td className="m3-col-rowidx">{idx + 1}</td>
                      <td className="m3-cell-title">
                        <button
                          type="button"
                          className="m3-chip m3-chip--link"
                          style={{ padding: 0, fontWeight: 700, fontSize: '0.82rem' }}
                          onClick={() => onChangeFilter && onChangeFilter('esp', filters.esp === row.cod_esp ? '' : row.cod_esp)}
                        >
                          {row.cod_esp}
                        </button>
                      </td>
                      <td>
                        <strong>{row.sigla || 'NAC'}</strong>
                        {row.it ? <span className="m3-text-muted" style={{ marginLeft: '4px', fontSize: '0.72rem' }}>({row.it})</span> : null}
                      </td>
                      {!agrupado && (
                        <td>
                          <span className="tabular-nums font-bold">#{row.persona_id}</span>
                          {row.nota_clinica && <span className="m3-text-muted" style={{ display: 'block', fontSize: '0.7rem' }}>{row.nota_clinica}</span>}
                        </td>
                      )}
                      <td className="m3-col-num tabular-nums">{planDir.toLocaleString('es-CL')}</td>
                      <td className="m3-col-num tabular-nums">{mgDir.toLocaleString('es-CL')}</td>
                      <td className="m3-col-num tabular-nums font-bold">{realDir.toLocaleString('es-CL')}</td>
                      <td className="m3-col-num tabular-nums font-bold" style={{ color: brecha < 0 ? 'var(--red-ink)' : brecha > 0 ? 'var(--teal-ink)' : 'inherit' }}>
                        {brechaSign}{brechaAbs}
                      </td>
                      <td className="m3-col-num tabular-nums font-bold">{cumpl.toFixed(1)}%</td>
                      <td>
                        <SegmentedBar valuePct={cumpl} targetPct={90} variant={isCritico ? 'alert' : 'default'} />
                      </td>
                      <td>
                        <PixelStatusBadge nivel={row.alerta?.nivel} texto={row.alerta?.badge} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
