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
    nota_clinica: 'Caso Dorado Duda 1 (Asig. Líder Equipo 4h con V°B° DMN)',
    plan_directo: 184,
    meta_gestion: 165,
    real_directo: 131, // Déficit crítico (-28.8%)
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
    real_directo: 112, // Meta cumplida (94.9%)
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
    real_directo: 110, // Superávit (+1.9%)
  },
  {
    persona_id: 141845,
    it: 1301,
    sigla: 'SCL',
    cod_esp: 'TERAPIA OCUPACIONAL',
    area: 'REHABILITACION INFANTIL',
    cargo: 'TERAPEUTA OCUPACIONAL',
    nota_clinica: 'Nueva Contratación Mayo 2026 (Jornada 42h)',
    plan_directo: 216,
    meta_gestion: 194,
    real_directo: 204, // Meta cumplida (94.4%)
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
    real_directo: 221, // Superávit (+5.2%)
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
    real_directo: 191, // Déficit crítico (-22.0%)
  },
  {
    persona_id: 128904,
    it: 1301,
    sigla: 'SCL',
    cod_esp: 'PSICOLOGIA',
    area: 'UNIDAD COGNITIVA Y SENSORIAL',
    cargo: 'PSICOLOGO/A CLINICO',
    nota_clinica: 'Atención integral familiar (45 min/sesión)',
    plan_directo: 142,
    meta_gestion: 127,
    real_directo: 134, // Meta cumplida (94.4%)
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
    real_directo: 212, // Superávit (+3.9%)
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
    real_directo: 182, // Meta cumplida (92.9%)
  },
  {
    persona_id: 136501,
    it: 401,
    sigla: 'COQ',
    cod_esp: 'FISIATRIA',
    area: 'ADMISION Y SOPORTE MEDICO',
    cargo: 'MEDICO FISIATRA',
    nota_clinica: 'Evaluación médica ingreso y seguimiento',
    plan_directo: 172,
    meta_gestion: 154,
    real_directo: 124, // Déficit crítico (-27.9%)
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

/**
 * PlanVsRealView.jsx — Cruce Plan Asistencial vs. SIC Real con alertas WCAG 2.1 AA (Issue #27, UI_SPEC.md §6)
 *
 * Incluye:
 * 1. Resumen Ejecutivo de Brechas (Top Cards): Déficit Crítico (<90% MG), Meta Cumplida (90–99,9%), Superávit (≥100%).
 * 2. Controles de Vista (Agrupada por Especialidad/Sede vs Detalle Individual por Profesional) y Filtro Rápido por Estado con aria-pressed.
 * 3. Matriz Semántica Plan vs. Real SIC con Brecha explícita (+/−), Barra Segmentada Pixel de 11 bloques y Estado WCAG de doble codificación.
 */
export default function PlanVsRealView({ planVsReal = [], filters = {}, onChangeFilter }) {
  const [agrupado, setAgrupado] = useState(true)
  const [statusFilter, setStatusFilter] = useState('TODOS') // 'TODOS' | 'CRITICO' | 'CUMPLIDO' | 'SUPERAVIT'
  const [individualRows, setIndividualRows] = useState(() =>
    buildMockIndividualPlanVsReal(filters)
  )
  const [isLoadingIndividual, setIsLoadingIndividual] = useState(false)

  // Consultar GET /api/plan-vs-real?agrupado=false cuando se activa vista desagrupada
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
        // Fallback determinista ya asignado
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

  // Conteos para las 3 tarjetas superiores de Resumen Ejecutivo de Brechas
  const summaryCounts = useMemo(() => {
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

    return {
      critico,
      cumplido,
      superavit,
      total: activeDataset.length,
      totalPlan,
      totalReal,
      totalMg,
      brechaGlobal: totalReal - totalPlan,
    }
  }, [activeDataset])

  const filteredRows = useMemo(() => {
    if (statusFilter === 'TODOS') return activeDataset
    return activeDataset.filter((row) => row.alerta?.nivel === statusFilter)
  }, [activeDataset, statusFilter])

  const unidadLabel = agrupado ? 'especialidades/sedes' : 'profesionales'

  return (
    <div className="view-container">
      {/* Encabezado de Vista */}
      <div className="view-header">
        <div>
          <h2 id="panel-heading-plan-vs-real" tabIndex="-1" className="view-title">
            Planificado vs. Real (SIC)
          </h2>
          <p className="view-subtitle">
            Brechas frente al Plan Directo (100%) y Meta de Gestión (90%)
          </p>
        </div>

        <div className="view-header__badges">
          <span className="status-badge">
            Plan: {summaryCounts.totalPlan.toLocaleString('es-CL')} · Real:{' '}
            {summaryCounts.totalReal.toLocaleString('es-CL')}
          </span>
        </div>
      </div>

      {/* 1. Resumen Ejecutivo de Brechas (Top Cards) */}
      <section aria-label="Resumen ejecutivo de brechas asistenciales" className="kpi-grid">
        {/* Card 1: Déficit Crítico (< 90% MG) */}
        <article className="kpi-card">
          <div className="kpi-card__top">
            <span className="micro-label">BAJO UMBRAL EXIGIBLE</span>
            <span
              className="status-badge status-badge--critico"
              style={{ color: 'var(--red-ink)' }}
            >
              <PixelAlertIcon size={15} />
              <span>Alerta Prioritaria</span>
            </span>
          </div>
          <h3 className="kpi-card__title">Déficit Crítico (&lt; 90% MG)</h3>
          <div className="kpi-card__value-row">
            <p className="kpi-card__value tabular-nums" style={{ color: 'var(--red-ink)' }}>
              {summaryCounts.critico}
            </p>
            <span className="kpi-card__unit">
              de {summaryCounts.total} {unidadLabel}
            </span>
          </div>
          <p className="kpi-card__note">
            Atenciones reales SIC por debajo de la <strong>Meta de Gestión del 90%</strong>. Requiere revisión de capacidad o ausentismo.
          </p>
        </article>

        {/* Card 2: Meta de Gestión Cumplida (90% – 99,9%) */}
        <article className="kpi-card">
          <div className="kpi-card__top">
            <span className="micro-label">DENTRO DE RANGO OPERATIVO</span>
            <span
              className="status-badge status-badge--cumplido"
              style={{ color: 'var(--onyx)', borderColor: 'var(--amber-ink)' }}
            >
              <PixelCheckIcon size={15} />
              <span>Meta 90% Alcanzada</span>
            </span>
          </div>
          <h3 className="kpi-card__title">Meta de Gestión Cumplida (90% – 99,9%)</h3>
          <div className="kpi-card__value-row">
            <p className="kpi-card__value tabular-nums">{summaryCounts.cumplido}</p>
            <span className="kpi-card__unit" style={{ color: 'var(--amber-ink)' }}>
              en rango 90%–99,9%
            </span>
          </div>
          <p className="kpi-card__note">
            Supera el piso exigible (<strong>MG ≥ 90%</strong>) acercándose al 100% del Plan Directo proyectado.
          </p>
        </article>

        {/* Card 3: Superávit Asistencial (≥ 100% Plan) */}
        <article className="kpi-card">
          <div className="kpi-card__top">
            <span className="micro-label">SOBRE CUMPLIMIENTO</span>
            <span
              className="status-badge status-badge--superavit"
              style={{ color: 'var(--teal-ink)' }}
            >
              <PixelTrendUpIcon size={15} />
              <span>≥ 100% del Plan</span>
            </span>
          </div>
          <h3 className="kpi-card__title">Superávit Asistencial (≥ 100% Plan)</h3>
          <div className="kpi-card__value-row">
            <p className="kpi-card__value tabular-nums" style={{ color: 'var(--teal-ink)' }}>
              {summaryCounts.superavit}
            </p>
            <span className="kpi-card__unit">
              de {summaryCounts.total} {unidadLabel}
            </span>
          </div>
          <p className="kpi-card__note">
            Ejecución asistencial SIC igual o superior al <strong>100% del Plan Directo</strong> mensual.
          </p>
        </article>
      </section>

      {/* 2. Controles de Vista y Filtro Rápido por Estado + 3. Matriz Semántica Plan vs. Real SIC */}
      <section aria-labelledby="pvr-matrix-heading" className="panel-section">
        <div className="panel-section__header">
          <div>
            <h3 id="pvr-matrix-heading" className="panel-section__title">
              Matriz Semántica Plan vs. Real SIC y Semáforo de Doble Codificación WCAG
            </h3>
            <p className="panel-section__desc">
              Alterne entre el consolidado por especialidad/sede y el desglose individual por profesional. Haga clic en una especialidad para filtrar globalmente el dashboard.
            </p>
          </div>

          {/* Toggle de Nivel de Agrupación */}
          <div
            role="group"
            aria-label="Nivel de agregación de la matriz Plan vs Real"
            style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
          >
            <button
              type="button"
              aria-pressed={agrupado}
              className={`btn-pixel btn-pixel--sm ${
                agrupado ? 'btn-pixel--primary' : 'btn-pixel--secondary'
              }`}
              onClick={() => setAgrupado(true)}
            >
              Vista Agrupada por Especialidad / Sede
            </button>
            <button
              type="button"
              aria-pressed={!agrupado}
              className={`btn-pixel btn-pixel--sm ${
                !agrupado ? 'btn-pixel--primary' : 'btn-pixel--secondary'
              }`}
              onClick={() => setAgrupado(false)}
            >
              Detalle Individual por Profesional
            </button>
          </div>
        </div>

        {/* Filtro Rápido por Estado WCAG */}
        <div
          role="group"
          aria-label="Filtrar filas por estado de cumplimiento WCAG"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              aria-pressed={statusFilter === 'TODOS'}
              className={`btn-pixel btn-pixel--sm ${
                statusFilter === 'TODOS' ? 'btn-pixel--primary' : 'btn-pixel--secondary'
              }`}
              onClick={() => setStatusFilter('TODOS')}
            >
              Todos ({summaryCounts.total})
            </button>

            <button
              type="button"
              aria-pressed={statusFilter === 'CRITICO'}
              className={`btn-pixel btn-pixel--sm ${
                statusFilter === 'CRITICO' ? 'btn-pixel--primary' : 'btn-pixel--secondary'
              }`}
              onClick={() => setStatusFilter('CRITICO')}
            >
              <PixelAlertIcon size={14} />
              <span>Solo Déficit Crítico &lt;90% ({summaryCounts.critico})</span>
            </button>

            <button
              type="button"
              aria-pressed={statusFilter === 'CUMPLIDO'}
              className={`btn-pixel btn-pixel--sm ${
                statusFilter === 'CUMPLIDO' ? 'btn-pixel--primary' : 'btn-pixel--secondary'
              }`}
              onClick={() => setStatusFilter('CUMPLIDO')}
            >
              <PixelCheckIcon size={14} />
              <span>Meta Cumplida 90–99% ({summaryCounts.cumplido})</span>
            </button>

            <button
              type="button"
              aria-pressed={statusFilter === 'SUPERAVIT'}
              className={`btn-pixel btn-pixel--sm ${
                statusFilter === 'SUPERAVIT' ? 'btn-pixel--primary' : 'btn-pixel--secondary'
              }`}
              onClick={() => setStatusFilter('SUPERAVIT')}
            >
              <PixelTrendUpIcon size={14} />
              <span>Superávit ≥100% ({summaryCounts.superavit})</span>
            </button>
          </div>

          {filters.esp && (
            <button
              type="button"
              className="btn-link-teal"
              onClick={() => onChangeFilter && onChangeFilter('esp', '')}
            >
              Quitar filtro de especialidad ({filters.esp})
            </button>
          )}
        </div>

        {isLoadingIndividual && !agrupado && (
          <p role="status" className="panel-section__desc" style={{ marginBottom: '12px' }}>
            Cargando desglose individual por profesional...
          </p>
        )}

        <div className="table-responsive" role="region" aria-labelledby="pvr-matrix-heading" tabIndex="0">
          <table className="pixel-table">
            <caption className="sr-only">
              Matriz de atenciones planificadas versus reales SIC con brecha absoluta, porcentaje de cumplimiento, barra segmentada de 11 bloques y estado WCAG
            </caption>
            <thead>
              <tr>
                <th scope="col">Especialidad (Cod_Esp)</th>
                <th scope="col">Instituto / Sede</th>
                {!agrupado && <th scope="col">Profesional ID</th>}
                <th scope="col" className="num-col">Plan Directo (100%)</th>
                <th scope="col" className="num-col">Meta de Gestión (90%)</th>
                <th scope="col" className="num-col">Atenciones Reales (SIC)</th>
                <th scope="col" className="num-col">Brecha (Real − Plan)</th>
                <th scope="col" className="num-col">% Cumplimiento</th>
                <th scope="col">Barra Segmentada Pixel (Marca 90%)</th>
                <th scope="col">Estado WCAG (Icono + Badge)</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={agrupado ? 9 : 10} style={{ textAlign: 'center', padding: '20px' }}>
                    No se encontraron registros para el filtro de estado seleccionado.
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
                  const desv = Number(
                    row.desviacion_pct ?? (planDir > 0 ? ((realDir - planDir) / planDir) * 100 : 0)
                  )
                  const desvSign = desv > 0 ? '+' : ''

                  const rowKey = `${row.cod_esp}-${row.it || 'nac'}-${row.persona_id || idx}`

                  return (
                    <tr
                      key={rowKey}
                      className={row.alerta?.nivel === 'CRITICO' ? 'row-critico' : ''}
                    >
                      <th scope="row">
                        <button
                          type="button"
                          className="btn-link-teal"
                          title={`Filtrar globalmente por especialidad ${row.cod_esp}`}
                          onClick={() =>
                            onChangeFilter &&
                            onChangeFilter(
                              'esp',
                              filters.esp === row.cod_esp ? '' : row.cod_esp
                            )
                          }
                        >
                          {row.cod_esp}
                        </button>
                      </th>
                      <td>
                        <strong>{row.sigla || 'NAC'}</strong>
                        {row.it ? (
                          <span className="esp-sub" style={{ marginLeft: '6px', fontSize: '0.8125rem' }}>
                            (IT {row.it})
                          </span>
                        ) : null}
                      </td>
                      {!agrupado && (
                        <td className="tabular-nums">
                          <strong>#{row.persona_id || 'S/I'}</strong>
                          {row.nota_clinica && (
                            <span
                              className="esp-sub"
                              style={{ display: 'block', fontSize: '0.8125rem' }}
                            >
                              {row.nota_clinica}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="num-col tabular-nums">
                        {planDir.toLocaleString('es-CL')}
                      </td>
                      <td className="num-col tabular-nums">
                        {mgDir.toLocaleString('es-CL')}
                      </td>
                      <td className="num-col tabular-nums font-bold">
                        {realDir.toLocaleString('es-CL')}
                      </td>
                      <td
                        className="num-col tabular-nums font-bold"
                        style={{
                          color:
                            brecha < 0
                              ? 'var(--red-ink)'
                              : brecha > 0
                              ? 'var(--teal-ink)'
                              : 'var(--onyx)',
                        }}
                      >
                        {brechaSign}
                        {brechaAbs}{' '}
                        <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                          ({desvSign}
                          {desv.toFixed(1)}%)
                        </span>
                      </td>
                      <td className="num-col tabular-nums font-bold">
                        {cumpl.toFixed(1)}%
                      </td>
                      <td style={{ minWidth: '185px' }}>
                        <SegmentedBar
                          valuePct={cumpl}
                          targetPct={90}
                          variant={row.alerta?.nivel === 'CRITICO' ? 'alert' : 'default'}
                        />
                      </td>
                      <td>
                        <PixelStatusBadge
                          nivel={row.alerta?.nivel}
                          texto={row.alerta?.badge}
                        />
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
