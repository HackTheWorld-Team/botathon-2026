import React, { useState, useEffect, useMemo } from 'react'
import {
  PixelCheckIcon,
  PixelTrendUpIcon,
  PixelAlertIcon,
} from '../components/PixelIcons.jsx'
import {
  MOCK_INSTITUTOS,
  PERIODO_LABELS,
  fetchDeltas,
  buildMockDeltas,
} from '../api.js'

const CUTOFF_OPTIONS = [
  { value: '2026-05-01', label: 'Mayo 2026 (Ley 42h)' },
  { value: '2026-06-01', label: 'Junio 2026' },
  { value: '2026-07-01', label: 'Julio 2026' },
]

const DELTA_TYPE_OPTIONS = [
  { value: 'TODOS', label: 'Todos los tipos' },
  { value: 'CAMBIO_JORNADA', label: '44h → 42h' },
  { value: 'MULTI_SEDE', label: 'Multi-Sede' },
  { value: 'ALTA', label: 'Altas' },
  { value: 'BAJA', label: 'Bajas' },
]

function formatSignedNumber(val, suffix = '') {
  const num = Number(val) || 0
  const formatted = Math.abs(num).toLocaleString('es-CL')
  if (num > 0) return `+${formatted}${suffix}`
  if (num < 0) return `−${formatted}${suffix}`
  return `0${suffix}`
}

export default function AntesDespuesView({ filters = {}, onChangeFilter }) {
  const [periodoCorte, setPeriodoCorte] = useState('2026-05-01')
  const [selectedIt, setSelectedIt] = useState(filters.instituto || '')
  const [selectedDeltaType, setSelectedDeltaType] = useState('TODOS')
  const [selectedPersonaId, setSelectedPersonaId] = useState('')
  const [activePreset, setActivePreset] = useState('TODOS')
  const [activeSubView, setActiveSubView] = useState('profesionales') // 'profesionales' | 'institutos' | 'congelados'
  const [deltasData, setDeltasData] = useState(() =>
    buildMockDeltas('2026-05-01', filters.instituto || '')
  )

  useEffect(() => {
    if (filters.instituto !== undefined) {
      setSelectedIt(filters.instituto || '')
    }
  }, [filters.instituto])

  useEffect(() => {
    let active = true
    setDeltasData(buildMockDeltas(periodoCorte, selectedIt))
    fetchDeltas(periodoCorte, selectedIt).then((res) => {
      if (active && res) {
        setDeltasData(res)
      }
    })
    return () => {
      active = false
    }
  }, [periodoCorte, selectedIt])

  function handleSelectPreset(presetKey) {
    setActivePreset(presetKey)
    if (presetKey === 'CASO_1') {
      setPeriodoCorte('2026-05-01')
      setSelectedIt('')
      setSelectedDeltaType('CAMBIO_JORNADA')
      setSelectedPersonaId('')
      setActiveSubView('profesionales')
      if (onChangeFilter) onChangeFilter('mes', '2026-05-01')
    } else if (presetKey === 'CASO_2') {
      setPeriodoCorte('2026-05-01')
      setSelectedIt('')
      setSelectedDeltaType('MULTI_SEDE')
      setSelectedPersonaId('125129')
      setActiveSubView('profesionales')
      if (onChangeFilter) onChangeFilter('mes', '2026-05-01')
    } else if (presetKey === 'CASO_3') {
      setPeriodoCorte('2026-05-01')
      setSelectedIt('')
      setSelectedDeltaType('ALTA')
      setSelectedPersonaId('141845')
      setActiveSubView('profesionales')
      if (onChangeFilter) onChangeFilter('mes', '2026-05-01')
    } else {
      setSelectedDeltaType('TODOS')
      setSelectedPersonaId('')
      setActiveSubView('profesionales')
    }
  }

  const resumenCounts = deltasData?.resumen || {
    CAMBIO_JORNADA: 140,
    MULTI_SEDE: 2,
    ALTA: 2,
    BAJA: 1,
    total: 145,
  }

  const filteredProfesionales = useMemo(() => {
    const raw = Array.isArray(deltasData?.comparativa_profesionales)
      ? deltasData.comparativa_profesionales
      : []
    return raw.filter((p) => {
      if (selectedDeltaType && selectedDeltaType !== 'TODOS' && p.tipo_delta !== selectedDeltaType) {
        return false
      }
      if (selectedPersonaId && String(p.persona_id) !== String(selectedPersonaId)) {
        return false
      }
      return true
    })
  }, [deltasData, selectedDeltaType, selectedPersonaId])

  const comparativaInstitutos = useMemo(() => {
    return Array.isArray(deltasData?.comparativa_institutos)
      ? deltasData.comparativa_institutos
      : []
  }, [deltasData])

  const mesesCongelados = useMemo(() => {
    return Array.isArray(deltasData?.meses_congelados)
      ? deltasData.meses_congelados
      : []
  }, [deltasData])

  return (
    <div className="m3-view-stack">
      {/* 1. Top KPI Strip Horizontal M3 (~84px) */}
      <section aria-label="Resumen de Deltas Asistenciales" className="m3-kpi-strip">
        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Transición Ley 42h</span>
            <span className="m3-badge m3-badge--teal">Art. 22 Inc. 2</span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums">
              {resumenCounts.CAMBIO_JORNADA}
            </h3>
            <span className="m3-kpi-card__sub">44h → 42h (Mayo)</span>
          </div>
          <div className="m3-kpi-card__chip-row">
            <span className="m3-metric-chip">Remuneración intacta</span>
          </div>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Multi-Sede</span>
            <span className="m3-badge m3-badge--secondary">Inter-Sede</span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums">
              {resumenCounts.MULTI_SEDE}
            </h3>
            <span className="m3-kpi-card__sub">Jornadas combinadas</span>
          </div>
          <div className="m3-kpi-card__chip-row">
            <span className="m3-metric-chip">Antofagasta / Calama</span>
          </div>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Nuevas Altas / Bajas</span>
            <span className="m3-badge m3-badge--neutral">Flujo Mayo</span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums">
              +{resumenCounts.ALTA} / −{resumenCounts.BAJA}
            </h3>
            <span className="m3-kpi-card__sub">Régimen 42h activo</span>
          </div>
          <div className="m3-kpi-card__chip-row">
            <span className="m3-metric-chip">Contrataciones 2026</span>
          </div>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Histórico Congelado</span>
            <span className="m3-badge m3-badge--teal">Auditable</span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums" style={{ color: 'var(--teal-ink)' }}>
              0 Δ
            </h3>
            <span className="m3-kpi-card__sub">Enero – Abril intactos</span>
          </div>
          <div className="m3-kpi-card__chip-row">
            <span className="m3-metric-chip">No retroactivo</span>
          </div>
        </article>
      </section>

      {/* 2. Main Sheet Card M3 (>80% Viewport con scroll interno) */}
      <section aria-labelledby="deltas-sheet-heading" className="m3-sheet-card">
        {/* Toolbar compacta M3 */}
        <div className="m3-sheet-card__toolbar">
          <div className="m3-sheet-card__title-box">
            <h2 id="deltas-sheet-heading" className="m3-sheet-card__title">
              Comparativa por Delta: Lote Base vs. Lote Mayo
            </h2>
            <span className="m3-badge m3-badge--neutral">
              Corte: {periodoCorte}
            </span>
          </div>

          <div className="m3-sheet-card__actions">
            {/* Casos rápidos pre-cocinados en chips */}
            <div role="group" aria-label="Casos de demostración" style={{ display: 'inline-flex', gap: '4px' }}>
              <button
                type="button"
                className={`m3-chip ${activePreset === 'TODOS' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => handleSelectPreset('TODOS')}
              >
                Todos ({resumenCounts.total})
              </button>
              <button
                type="button"
                className={`m3-chip ${activePreset === 'CASO_1' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => handleSelectPreset('CASO_1')}
              >
                Caso 1: 44h→42h (140)
              </button>
              <button
                type="button"
                className={`m3-chip ${activePreset === 'CASO_2' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => handleSelectPreset('CASO_2')}
              >
                Caso 2: Multi-Sede #125129
              </button>
              <button
                type="button"
                className={`m3-chip ${activePreset === 'CASO_3' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => handleSelectPreset('CASO_3')}
              >
                Caso 3: Alta Mayo #141845
              </button>
            </div>

            {/* Sub-vistas en chips */}
            <div role="group" aria-label="Nivel de agrupación" style={{ display: 'inline-flex', gap: '4px' }}>
              <button
                type="button"
                className={`m3-chip ${activeSubView === 'profesionales' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setActiveSubView('profesionales')}
              >
                Profesionales ({filteredProfesionales.length})
              </button>
              <button
                type="button"
                className={`m3-chip ${activeSubView === 'institutos' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setActiveSubView('institutos')}
              >
                Institutos ({comparativaInstitutos.length})
              </button>
              <button
                type="button"
                className={`m3-chip ${activeSubView === 'congelados' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setActiveSubView('congelados')}
              >
                Meses Congelados
              </button>
            </div>
          </div>
        </div>

        {/* Viewport de Tabla con Scroll Interno */}
        <div className="m3-table-viewport" tabIndex="0" role="region" aria-label="Tabla de deltas comparados">
          {activeSubView === 'profesionales' && (
            <table className="m3-data-table">
              <thead>
                <tr>
                  <th scope="col" className="m3-col-rowidx">#</th>
                  <th scope="col">Profesional</th>
                  <th scope="col">Instituto</th>
                  <th scope="col">Cargo / Especialidad</th>
                  <th scope="col">Tipo Delta</th>
                  <th scope="col" className="m3-col-num">Jornada Semanal</th>
                  <th scope="col" className="m3-col-num">Plan Directo</th>
                  <th scope="col" className="m3-col-num">Δ Atenciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfesionales.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '24px', color: 'var(--ink-2)' }}>
                      No se encontraron deltas para el filtro activo.
                    </td>
                  </tr>
                ) : (
                  filteredProfesionales.map((p, idx) => {
                    const deltaAte = Number(p.delta_atenciones || 0)
                    const deltaSign = deltaAte > 0 ? '+' : deltaAte < 0 ? '−' : ''
                    const deltaAbs = Math.abs(deltaAte).toLocaleString('es-CL')

                    return (
                      <tr key={`${p.persona_id}-${p.it}-${idx}`}>
                        <td className="m3-col-rowidx">{idx + 1}</td>
                        <td>
                          <strong>#{p.persona_id}</strong>
                          {p.nota_clinica && <span className="m3-text-muted" style={{ display: 'block', fontSize: '0.72rem' }}>{p.nota_clinica}</span>}
                        </td>
                        <td>
                          <strong>{p.sigla || 'SCL'}</strong>
                          <span className="m3-text-muted" style={{ marginLeft: '4px', fontSize: '0.72rem' }}>({p.it})</span>
                        </td>
                        <td className="m3-cell-title">
                          <span>{p.cargo}</span>
                          <span className="m3-text-muted" style={{ display: 'block', fontSize: '0.72rem' }}>{p.cod_esp}</span>
                        </td>
                        <td>
                          <span className="m3-badge m3-badge--teal">{p.tipo_delta}</span>
                        </td>
                        <td className="m3-col-num tabular-nums">
                          {p.horas_antes}h → <strong>{p.horas_despues}h</strong>
                        </td>
                        <td className="m3-col-num tabular-nums">
                          {Number(p.plan_antes || 0).toLocaleString('es-CL')} → <strong>{Number(p.plan_despues || 0).toLocaleString('es-CL')}</strong>
                        </td>
                        <td className="m3-col-num tabular-nums font-bold" style={{ color: deltaAte < 0 ? 'var(--red-ink)' : deltaAte > 0 ? 'var(--teal-ink)' : 'inherit' }}>
                          {deltaSign}{deltaAbs}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          )}

          {activeSubView === 'institutos' && (
            <table className="m3-data-table">
              <thead>
                <tr>
                  <th scope="col" className="m3-col-rowidx">#</th>
                  <th scope="col">Instituto</th>
                  <th scope="col" className="m3-col-num">Horas Antes</th>
                  <th scope="col" className="m3-col-num">Horas Mayo (42h)</th>
                  <th scope="col" className="m3-col-num">Δ Horas</th>
                  <th scope="col" className="m3-col-num">Plan Antes</th>
                  <th scope="col" className="m3-col-num">Plan Mayo</th>
                  <th scope="col" className="m3-col-num">Δ Plan</th>
                  <th scope="col" className="m3-col-num">Meta 90%</th>
                </tr>
              </thead>
              <tbody>
                {comparativaInstitutos.map((inst, idx) => {
                  const deltaH = Number(inst.delta_horas || 0)
                  const deltaP = Number(inst.delta_plan || 0)
                  return (
                    <tr key={inst.it || idx}>
                      <td className="m3-col-rowidx">{idx + 1}</td>
                      <td className="m3-cell-title">
                        <strong>{inst.sigla}</strong>
                        <span className="m3-text-muted" style={{ marginLeft: '6px', fontSize: '0.75rem' }}>IT {inst.it} — {inst.nombre}</span>
                      </td>
                      <td className="m3-col-num tabular-nums">{Number(inst.horas_antes || 0).toLocaleString('es-CL')}</td>
                      <td className="m3-col-num tabular-nums font-bold">{Number(inst.horas_despues || 0).toLocaleString('es-CL')}</td>
                      <td className="m3-col-num tabular-nums font-bold" style={{ color: deltaH < 0 ? 'var(--red-ink)' : 'inherit' }}>
                        {formatSignedNumber(deltaH, 'h')}
                      </td>
                      <td className="m3-col-num tabular-nums">{Number(inst.plan_directo_antes || 0).toLocaleString('es-CL')}</td>
                      <td className="m3-col-num tabular-nums font-bold">{Number(inst.plan_directo_despues || 0).toLocaleString('es-CL')}</td>
                      <td className="m3-col-num tabular-nums font-bold" style={{ color: deltaP < 0 ? 'var(--red-ink)' : 'inherit' }}>
                        {formatSignedNumber(deltaP)}
                      </td>
                      <td className="m3-col-num tabular-nums">{Number(inst.meta_gestion_despues || 0).toLocaleString('es-CL')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {activeSubView === 'congelados' && (
            <table className="m3-data-table">
              <thead>
                <tr>
                  <th scope="col" className="m3-col-rowidx">#</th>
                  <th scope="col">Período Mensual</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="m3-col-num">Deltas Detectados</th>
                  <th scope="col">Regla de Negocio</th>
                </tr>
              </thead>
              <tbody>
                {mesesCongelados.map((m, idx) => (
                  <tr key={m.periodo || idx}>
                    <td className="m3-col-rowidx">{idx + 1}</td>
                    <td className="m3-cell-title">
                      <strong>{m.periodo}</strong>
                      <span className="m3-text-muted" style={{ marginLeft: '6px' }}>({m.mes_nombre})</span>
                    </td>
                    <td>
                      <span className="m3-badge m3-badge--teal">CONGELADO</span>
                    </td>
                    <td className="m3-col-num tabular-nums font-bold">0 Δ</td>
                    <td className="m3-cell-title m3-text-muted">
                      Vigencia prospectiva: no se recalcula hacia atrás (Art. 22 Inc. 2)
                    </td>
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
