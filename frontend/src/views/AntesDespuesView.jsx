import React, { useState, useEffect, useMemo } from 'react'
import {
  PixelCheckIcon,
  PixelTrendUpIcon,
  PixelAlertIcon,
  PixelBookIcon,
} from '../components/PixelIcons.jsx'
import {
  MOCK_INSTITUTOS,
  PERIODO_LABELS,
  fetchDeltas,
  buildMockDeltas,
} from '../api.js'

const CUTOFF_OPTIONS = [
  { value: '2026-05-01', label: '2026-05-01 · Mayo 2026 (Entrada en vigencia Ley 42h)' },
  { value: '2026-06-01', label: '2026-06-01 · Junio 2026 (Régimen 42h)' },
  { value: '2026-07-01', label: '2026-07-01 · Julio 2026 (Régimen 42h)' },
]

const DELTA_TYPE_OPTIONS = [
  { value: 'TODOS', label: 'TODOS — Todos los tipos de delta' },
  { value: 'CAMBIO_JORNADA', label: 'CAMBIO_JORNADA — Transición 44h → 42h' },
  { value: 'MULTI_SEDE', label: 'MULTI_SEDE — Profesionales en ≥2 Institutos' },
  { value: 'ALTA', label: 'ALTA — Nuevas contrataciones' },
  { value: 'BAJA', label: 'BAJA — Finiquitos / Términos de contrato' },
]

function formatSignedNumber(val, decimals = 0, suffix = '') {
  const num = Number(val) || 0
  const formatted = Math.abs(num).toLocaleString('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  if (num > 0) return `+${formatted}${suffix}`
  if (num < 0) return `−${formatted}${suffix}`
  return `0${suffix}`
}

function renderDeltaBadge(val, decimals = 0, unitLabel = '') {
  const num = Number(val) || 0
  const text = formatSignedNumber(num, decimals, unitLabel ? ` ${unitLabel}` : '')
  if (num > 0) {
    return (
      <span className="status-badge status-badge--superavit">
        <PixelTrendUpIcon size={13} />
        <span className="tabular-nums">{text} (Incremento)</span>
      </span>
    )
  }
  if (num < 0) {
    return (
      <span className="status-badge status-badge--critico">
        <PixelAlertIcon size={13} />
        <span className="tabular-nums">{text} (Reducción 42h)</span>
      </span>
    )
  }
  return (
    <span className="status-badge status-badge--cumplido">
      <PixelCheckIcon size={13} />
      <span className="tabular-nums">0 Δ (Sin Cambio)</span>
    </span>
  )
}

function renderTipoDeltaBadge(tipoDelta, horasAntes, horasDespues) {
  if (tipoDelta === 'ALTA') {
    return (
      <span className="status-badge status-badge--superavit">
        <PixelTrendUpIcon size={13} />
        <span>ALTA (Nueva Contratación)</span>
      </span>
    )
  }
  if (tipoDelta === 'MULTI_SEDE') {
    return (
      <span className="status-badge status-badge--teal">
        <PixelTrendUpIcon size={13} />
        <span>MULTI_SEDE (Suma Inter-Sede)</span>
      </span>
    )
  }
  if (tipoDelta === 'CAMBIO_JORNADA') {
    const label =
      Number(horasAntes) === 44 && Number(horasDespues) === 42
        ? 'CAMBIO_JORNADA 44h→42h'
        : `CAMBIO_JORNADA ${horasAntes}h→${horasDespues}h`
    return (
      <span className="status-badge status-badge--cumplido">
        <PixelCheckIcon size={13} />
        <span>{label}</span>
      </span>
    )
  }
  if (tipoDelta === 'BAJA') {
    return (
      <span className="status-badge status-badge--critico">
        <PixelAlertIcon size={13} />
        <span>BAJA (Finiquito / Término)</span>
      </span>
    )
  }
  return (
    <span className="status-badge">
      <PixelCheckIcon size={13} />
      <span>SIN_CAMBIO</span>
    </span>
  )
}

export default function AntesDespuesView({ filters = {}, onChangeFilter, easyReading = false }) {
  const [periodoCorte, setPeriodoCorte] = useState('2026-05-01')
  const [selectedIt, setSelectedIt] = useState(filters.instituto || '')
  const [selectedDeltaType, setSelectedDeltaType] = useState('TODOS')
  const [selectedPersonaId, setSelectedPersonaId] = useState('')
  const [activePreset, setActivePreset] = useState('TODOS')
  const [activeSubTab, setActiveSubTab] = useState('profesionales') // 'profesionales' | 'institutos' | 'congelados'
  const [comparisonMode, setComparisonMode] = useState('LOTE_102_VS_104')
  const [deltasData, setDeltasData] = useState(() =>
    buildMockDeltas('2026-05-01', filters.instituto || '')
  )
  const [liveStatus, setLiveStatus] = useState('')

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
      setActiveSubTab('profesionales')
      if (onChangeFilter) onChangeFilter('mes', '2026-05-01')
      setLiveStatus('Caso 1 activado: Transición Legal 44h a 42h desde mayo 2026 (140 contratos afectados, meses Enero a Abril congelados).')
    } else if (presetKey === 'CASO_2') {
      setPeriodoCorte('2026-05-01')
      setSelectedIt('')
      setSelectedDeltaType('MULTI_SEDE')
      setSelectedPersonaId('125129')
      setActiveSubTab('profesionales')
      if (onChangeFilter) onChangeFilter('mes', '2026-05-01')
      setLiveStatus('Caso 2 activado: Profesional Multi-Sede #125129 en Antofagasta (35h) y Calama (8h), suma combinada 43h ajustada al tramo de 42h.')
    } else if (presetKey === 'CASO_3') {
      setPeriodoCorte('2026-05-01')
      setSelectedIt('')
      setSelectedDeltaType('ALTA')
      setSelectedPersonaId('141845')
      setActiveSubTab('profesionales')
      if (onChangeFilter) onChangeFilter('mes', '2026-05-01')
      setLiveStatus('Caso 3 activado: Nueva Contratación #141845 (Alta en Mayo 2026 con 42 horas semanales y +112 atenciones directas).')
    } else {
      setSelectedDeltaType('TODOS')
      setSelectedPersonaId('')
      setActiveSubTab('profesionales')
      setLiveStatus('Mostrando todos los deltas detectados entre el Lote Base Ene–Abr (44h) y el Lote Delta Mayo 2026 (42h).')
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
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveStatus}
      </div>

      {/* Tarjeta de Lectura Fácil (Comprensión Cognitiva) */}
      <div className="easy-reading-card" role="region" aria-label="Explicación en lenguaje claro">
        <h3 className="easy-reading-card__title">
          <PixelBookIcon size={14} />
          <span>Lectura Fácil: ¿Qué es la transición Antes / Después?</span>
        </h3>
        <p className="easy-reading-card__text">
          En mayo de 2026 comenzó a regir la ley chilena que reduce la jornada de 44 a 42 horas semanales.
          Esta pantalla demuestra que los meses anteriores (enero a abril) permanecen congelados e inalterados,
          y que a partir de mayo las horas se ajustan automáticamente a 42 horas sin tocar las remuneraciones.
        </p>
      </div>

      {/* 1. Top KPI Strip Horizontal M3 (~84px) */}
      <section aria-label="Métricas de transición por deltas" className="m3-kpi-strip">
        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Transición Ley 42h</span>
            <span className="status-badge status-badge--cumplido">
              <PixelCheckIcon size={12} />
              <span>Art. 22 Inc. 2</span>
            </span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums">
              {resumenCounts.CAMBIO_JORNADA || 140}
            </h3>
            <span className="m3-kpi-card__sub">contratos 44h → 42h</span>
          </div>
          <p className="kpi-card__note" style={{ margin: 0, fontSize: '0.71rem', color: 'var(--ink-2)' }}>
            Reducción semanal sin alteración de remuneraciones.
          </p>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Profesionales Multi-Sede</span>
            <span className="status-badge status-badge--teal">
              <PixelTrendUpIcon size={12} />
              <span>Suma Inter-Sede</span>
            </span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums">
              {resumenCounts.MULTI_SEDE || 2}
            </h3>
            <span className="m3-kpi-card__sub">en ≥ 2 Institutos</span>
          </div>
          <p className="kpi-card__note" style={{ margin: 0, fontSize: '0.71rem', color: 'var(--ink-2)' }}>
            Jornada combinada sumada para clasificar en Tramo 1.
          </p>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Altas y Bajas Mayo</span>
            <span className="status-badge status-badge--superavit">
              <PixelTrendUpIcon size={12} />
              <span>Régimen 42h</span>
            </span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums">
              +{resumenCounts.ALTA || 2} / −{resumenCounts.BAJA || 1}
            </h3>
            <span className="m3-kpi-card__sub">nuevas incorporaciones</span>
          </div>
          <p className="kpi-card__note" style={{ margin: 0, fontSize: '0.71rem', color: 'var(--ink-2)' }}>
            Nuevas contrataciones nacen bajo régimen de 42h.
          </p>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Vigencia Prospectiva</span>
            <span className="status-badge status-badge--cumplido">
              <PixelCheckIcon size={12} />
              <span>No Retroactivo</span>
            </span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums" style={{ color: 'var(--teal-ink)' }}>
              0 Δ
            </h3>
            <span className="m3-kpi-card__sub">Ene–Abr 2026 congelados</span>
          </div>
          <p className="kpi-card__note" style={{ margin: 0, fontSize: '0.71rem', color: 'var(--ink-2)' }}>
            Meses históricos inmutables auditados en la base.
          </p>
        </article>
      </section>

      {/* 2. Banner de Regla de Negocio Verificada (Vigencia No Retroactiva) */}
      <div className="non-retroactive-banner" role="note" aria-label="Explicación de vigencia no retroactiva" style={{ margin: 0, padding: '8px 14px', borderRadius: 'var(--md-shape-md)' }}>
        <div className="non-retroactive-banner__header">
          <span className="status-badge status-badge--cumplido">
            <PixelCheckIcon size={13} />
            <span>REGLA DE NEGOCIO VERIFICADA: VIGENCIA NO RETROACTIVA</span>
          </span>
          <strong>
            Corte activo: <code>{periodoCorte}</code> (Comparado contra <code>{deltasData.periodo_anterior || '2026-04-01'}</code>)
          </strong>
        </div>
        <p className="non-retroactive-banner__text" style={{ fontSize: '0.76rem', margin: 0 }}>
          <strong>Enero a Abril 2026 congelados (0 Δ):</strong> el recálculo aplica <code>WHERE periodo &gt;= &apos;{periodoCorte}&apos;</code>, preservando intactos los meses históricos cerrados.
        </p>
      </div>

      {/* 3. Main Sheet Card M3 (>80% Viewport con scroll interno) */}
      <section aria-labelledby="deltas-main-heading" className="m3-sheet-card">
        {/* Toolbar con Casos Pre-cocinados del Pitch y Filtros */}
        <div className="m3-sheet-card__toolbar">
          <div className="m3-sheet-card__title-box">
            <h2 id="deltas-main-heading" className="m3-sheet-card__title">
              Comparativa por Delta: Lote Base #102 vs. Lote Delta #104
            </h2>
            <span className="m3-badge m3-badge--neutral">
              {resumenCounts.total || 145} deltas detectados
            </span>
          </div>

          <div className="m3-sheet-card__actions">
            {/* Sub-pestañas estructuradas */}
            <div role="group" aria-label="Vistas de deltas" style={{ display: 'inline-flex', gap: '4px' }}>
              <button
                type="button"
                className={`m3-chip ${activeSubTab === 'profesionales' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setActiveSubTab('profesionales')}
              >
                Por Profesional ({filteredProfesionales.length})
              </button>
              <button
                type="button"
                className={`m3-chip ${activeSubTab === 'institutos' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setActiveSubTab('institutos')}
              >
                Por Instituto ({comparativaInstitutos.length})
              </button>
              <button
                type="button"
                className={`m3-chip ${activeSubTab === 'congelados' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setActiveSubTab('congelados')}
              >
                Meses Congelados (Ene–Abr)
              </button>
            </div>
          </div>
        </div>

        {/* Barra de Casos Pre-Cocinados para la Demo (Paso 3 del Pitch) */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', padding: '6px 10px', background: 'var(--md-sys-color-surface-container-low)', borderRadius: 'var(--md-shape-sm)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-2)' }}>
            Casos Demo:
          </span>
          <button
            type="button"
            className={`m3-chip ${activePreset === 'CASO_1' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
            style={{ fontWeight: 700 }}
            onClick={() => handleSelectPreset('CASO_1')}
          >
            Caso 1: Transición Legal 44h → 42h (140 contratos)
          </button>
          <button
            type="button"
            className={`m3-chip ${activePreset === 'CASO_2' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
            style={{ fontWeight: 700 }}
            onClick={() => handleSelectPreset('CASO_2')}
          >
            Caso 2: Profesional Multi-Sede #125129 (Antofagasta 35h + Calama 8h)
          </button>
          <button
            type="button"
            className={`m3-chip ${activePreset === 'CASO_3' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
            style={{ fontWeight: 700 }}
            onClick={() => handleSelectPreset('CASO_3')}
          >
            Caso 3: Nueva Contratación #141845 (Alta Mayo 42h)
          </button>
          <button
            type="button"
            className={`m3-chip ${activePreset === 'TODOS' ? 'm3-chip--selected' : 'm3-chip--reset'}`}
            onClick={() => handleSelectPreset('TODOS')}
          >
            Ver Todos los Deltas ({resumenCounts.total || 145})
          </button>
        </div>

        {/* Viewport de Tabla con Scroll Interno */}
        <div className="m3-table-viewport" tabIndex="0" role="region" aria-label="Tabla de deltas asistenciales">
          {activeSubTab === 'profesionales' && (
            <table className="m3-data-table">
              <thead>
                <tr>
                  <th scope="col" className="m3-col-rowidx">#</th>
                  <th scope="col">Profesional ID</th>
                  <th scope="col">Instituto / Sede</th>
                  <th scope="col">Cargo / Especialidad</th>
                  <th scope="col">Tipo de Delta</th>
                  <th scope="col" className="m3-col-num">Jornada Antes → Después</th>
                  <th scope="col" className="m3-col-num">Plan Directo Antes → Después</th>
                  <th scope="col" className="m3-col-num">Δ Atenciones Directas</th>
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
                  filteredProfesionales.map((p, idx) => (
                    <tr key={`${p.persona_id}-${p.it}-${idx}`}>
                      <td className="m3-col-rowidx">{idx + 1}</td>
                      <td>
                        <strong>#{p.persona_id}</strong>
                        {p.nota_clinica && (
                          <span className="m3-text-muted" style={{ display: 'block', fontSize: '0.72rem' }}>
                            {p.nota_clinica}
                          </span>
                        )}
                      </td>
                      <td>
                        <strong>{p.sigla || 'SCL'}</strong>
                        <span className="m3-text-muted" style={{ marginLeft: '4px', fontSize: '0.72rem' }}>
                          (IT {p.it})
                        </span>
                      </td>
                      <td className="m3-cell-title">
                        <span>{p.cargo}</span>
                        <span className="m3-text-muted" style={{ display: 'block', fontSize: '0.72rem' }}>
                          {p.cod_esp}
                        </span>
                      </td>
                      <td>
                        {renderTipoDeltaBadge(p.tipo_delta, p.horas_antes, p.horas_despues)}
                      </td>
                      <td className="m3-col-num tabular-nums">
                        {p.horas_antes}h → <strong>{p.horas_despues}h</strong>
                      </td>
                      <td className="m3-col-num tabular-nums">
                        {Number(p.plan_antes || 0).toLocaleString('es-CL')} →{' '}
                        <strong>{Number(p.plan_despues || 0).toLocaleString('es-CL')}</strong>
                      </td>
                      <td className="m3-col-num tabular-nums">
                        {renderDeltaBadge(p.delta_atenciones, 0, 'atenciones')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeSubTab === 'institutos' && (
            <table className="m3-data-table">
              <thead>
                <tr>
                  <th scope="col" className="m3-col-rowidx">#</th>
                  <th scope="col">Instituto</th>
                  <th scope="col" className="m3-col-num">Horas Antes</th>
                  <th scope="col" className="m3-col-num">Horas Mayo (42h)</th>
                  <th scope="col" className="m3-col-num">Δ Horas</th>
                  <th scope="col" className="m3-col-num">Plan Directo Antes</th>
                  <th scope="col" className="m3-col-num">Plan Directo Mayo</th>
                  <th scope="col" className="m3-col-num">Δ Plan Directo</th>
                  <th scope="col" className="m3-col-num">Meta Gestión (90%)</th>
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
                        <span className="m3-text-muted" style={{ marginLeft: '6px', fontSize: '0.75rem' }}>
                          IT {inst.it} — {inst.nombre}
                        </span>
                      </td>
                      <td className="m3-col-num tabular-nums">
                        {Number(inst.horas_antes || 0).toLocaleString('es-CL')}
                      </td>
                      <td className="m3-col-num tabular-nums font-bold">
                        {Number(inst.horas_despues || 0).toLocaleString('es-CL')}
                      </td>
                      <td className="m3-col-num tabular-nums font-bold" style={{ color: deltaH < 0 ? 'var(--red-ink)' : 'inherit' }}>
                        {formatSignedNumber(deltaH, 0, 'h')}
                      </td>
                      <td className="m3-col-num tabular-nums">
                        {Number(inst.plan_directo_antes || 0).toLocaleString('es-CL')}
                      </td>
                      <td className="m3-col-num tabular-nums font-bold">
                        {Number(inst.plan_directo_despues || 0).toLocaleString('es-CL')}
                      </td>
                      <td className="m3-col-num tabular-nums font-bold" style={{ color: deltaP < 0 ? 'var(--red-ink)' : 'inherit' }}>
                        {formatSignedNumber(deltaP, 0)}
                      </td>
                      <td className="m3-col-num tabular-nums">
                        {Number(inst.meta_gestion_despues || 0).toLocaleString('es-CL')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {activeSubTab === 'congelados' && (
            <table className="m3-data-table">
              <thead>
                <tr>
                  <th scope="col" className="m3-col-rowidx">#</th>
                  <th scope="col">Período Mensual</th>
                  <th scope="col">Mes Calendario</th>
                  <th scope="col">Estado de Vigencia</th>
                  <th scope="col" className="m3-col-num">Deltas Detectados</th>
                  <th scope="col">Regla de Negocio Verificada</th>
                </tr>
              </thead>
              <tbody>
                {mesesCongelados.map((m, idx) => (
                  <tr key={m.periodo || idx}>
                    <td className="m3-col-rowidx">{idx + 1}</td>
                    <td className="tabular-nums font-bold">{m.periodo}</td>
                    <td className="m3-cell-title">{m.mes_nombre}</td>
                    <td>
                      <span className="status-badge status-badge--cumplido">
                        <PixelCheckIcon size={12} />
                        <span>CONGELADO</span>
                      </span>
                    </td>
                    <td className="m3-col-num tabular-nums font-bold">0 Δ</td>
                    <td className="m3-cell-title m3-text-muted">
                      Vigencia no retroactiva: Mes histórico cerrado antes del corte de mayo 2026.
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
