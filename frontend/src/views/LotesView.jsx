import React, { useState, useEffect, useMemo } from 'react'
import {
  PixelCheckIcon,
  PixelAlertIcon,
  PixelExcelIcon,
} from '../components/PixelIcons.jsx'
import {
  MOCK_LOTES,
  VALIDATION_RULES_CATALOG,
  fetchLoteRechazados,
  buildMockLoteRechazados,
  downloadRejectedReport,
} from '../api.js'

export default function LotesView({ lotes = [] }) {
  const sortedLotes = useMemo(() => {
    const base = Array.isArray(lotes) && lotes.length > 0 ? lotes : MOCK_LOTES
    return [...base].sort(
      (a, b) =>
        String(b.fecha_corrida || '').localeCompare(String(a.fecha_corrida || '')) ||
        Number(b.lote_id) - Number(a.lote_id)
    )
  }, [lotes])

  const defaultLoteId = sortedLotes[0]?.lote_id || 104
  const [activeLoteId, setActiveLoteId] = useState(defaultLoteId)
  const [loteDetail, setLoteDetail] = useState(() =>
    buildMockLoteRechazados(defaultLoteId)
  )
  const [activeTab, setActiveTab] = useState('lotes') // 'lotes' | 'rechazados'
  const [selectedRuleFilter, setSelectedRuleFilter] = useState('TODAS')

  useEffect(() => {
    if (!activeLoteId) return
    let active = true
    setLoteDetail(buildMockLoteRechazados(activeLoteId))
    fetchLoteRechazados(activeLoteId).then((data) => {
      if (active && data) {
        setLoteDetail(data)
      }
    })
    return () => {
      active = false
    }
  }, [activeLoteId])

  const stats = useMemo(() => {
    let totalValidos = 0
    let totalRechazados = 0
    for (const l of sortedLotes) {
      totalValidos += Number(l.validos || 0)
      totalRechazados += Number(l.rechazados || 0)
    }
    const totalFilas = totalValidos + totalRechazados
    const tasa = totalFilas > 0 ? ((totalValidos / totalFilas) * 100).toFixed(1) : '100'
    return {
      totalLotes: sortedLotes.length,
      totalValidos,
      totalRechazados,
      tasa,
    }
  }, [sortedLotes])

  const activeLote = useMemo(() => {
    return sortedLotes.find((l) => Number(l.lote_id) === Number(activeLoteId)) || sortedLotes[0]
  }, [sortedLotes, activeLoteId])

  const filteredRechazados = useMemo(() => {
    const list = Array.isArray(loteDetail?.rechazados) ? loteDetail.rechazados : []
    if (selectedRuleFilter === 'TODAS') return list
    return list.filter((r) => (r.motivo || 'OTHER') === selectedRuleFilter)
  }, [loteDetail, selectedRuleFilter])

  return (
    <div className="m3-view-stack">
      {/* 1. Top KPI Strip Horizontal M3 (~84px) */}
      <section aria-label="Métricas de Ingesta Blue Prism" className="m3-kpi-strip">
        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Lotes Procesados</span>
            <span className="m3-badge m3-badge--teal">Worker RPA</span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums">
              {stats.totalLotes}
            </h3>
            <span className="m3-kpi-card__sub">Ejecuciones registradas</span>
          </div>
          <div className="m3-kpi-card__chip-row">
            <span className="m3-metric-chip">BUK &amp; SIC</span>
          </div>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Filas Válidas</span>
            <span className="m3-badge m3-badge--teal">{stats.tasa}% Aprobadas</span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums" style={{ color: 'var(--teal-ink)' }}>
              {stats.totalValidos.toLocaleString('es-CL')}
            </h3>
            <span className="m3-kpi-card__sub">Impactaron la base asistencial</span>
          </div>
          <div className="m3-kpi-card__chip-row">
            <span className="m3-metric-chip">Contratos &amp; Atenciones</span>
          </div>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Rechazos Aislados</span>
            <span className="m3-badge" style={{ background: 'var(--md-sys-color-error-container)', color: 'var(--red-ink)' }}>
              Cuarentena
            </span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums" style={{ color: 'var(--red-ink)' }}>
              {stats.totalRechazados}
            </h3>
            <span className="m3-kpi-card__sub">En Rejected_Records</span>
          </div>
          <div className="m3-kpi-card__chip-row">
            <span className="m3-metric-chip">Sin detener el proceso</span>
          </div>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Lote Seleccionado</span>
            <span className="m3-badge m3-badge--secondary">#{activeLote?.lote_id}</span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums">
              {activeLote?.validos?.toLocaleString('es-CL') || 0}
            </h3>
            <span className="m3-kpi-card__sub" style={{ color: Number(activeLote?.rechazados) > 0 ? 'var(--red-ink)' : 'var(--teal-ink)' }}>
              {Number(activeLote?.rechazados) > 0 ? `${activeLote?.rechazados} rechazadas` : '100% limpio'}
            </span>
          </div>
          <div className="m3-kpi-card__chip-row">
            <span className="m3-metric-chip">{activeLote?.archivo || 'BUK'}</span>
          </div>
        </article>
      </section>

      {/* 2. Main Sheet Card M3 (>80% Viewport con scroll interno) */}
      <section aria-labelledby="lotes-sheet-heading" className="m3-sheet-card">
        {/* Toolbar compacta M3 */}
        <div className="m3-sheet-card__toolbar">
          <div className="m3-sheet-card__title-box">
            <h2 id="lotes-sheet-heading" className="m3-sheet-card__title">
              Trazabilidad Blue Prism y Registros en Cuarentena
            </h2>
            <span className="m3-badge m3-badge--neutral">
              Lote #{activeLote?.lote_id}
            </span>
          </div>

          <div className="m3-sheet-card__actions">
            {/* Sub-vistas en chips */}
            <div role="group" aria-label="Subvista" style={{ display: 'inline-flex', gap: '4px' }}>
              <button
                type="button"
                className={`m3-chip ${activeTab === 'lotes' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setActiveTab('lotes')}
              >
                Historial de Lotes ({sortedLotes.length})
              </button>
              <button
                type="button"
                className={`m3-chip ${activeTab === 'rechazados' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setActiveTab('rechazados')}
              >
                <PixelAlertIcon size={12} />
                <span>Rechazos Lote #{activeLote?.lote_id} ({loteDetail?.total_rechazados || 0})</span>
              </button>
            </div>

            {/* Descargar reporte Excel */}
            <button
              type="button"
              className="m3-chip m3-chip--action"
              onClick={() => downloadRejectedReport(activeLote?.lote_id)}
              title="Descargar Rejected_Records_Report.xlsx"
            >
              <PixelExcelIcon size={14} />
              <span>Reporte .xlsx</span>
            </button>
          </div>
        </div>

        {/* Viewport de Tabla con Scroll Interno */}
        <div className="m3-table-viewport" tabIndex="0" role="region" aria-label="Tabla de lotes RPA">
          {activeTab === 'lotes' ? (
            <table className="m3-data-table">
              <thead>
                <tr>
                  <th scope="col" className="m3-col-rowidx">#</th>
                  <th scope="col">Lote ID</th>
                  <th scope="col">Fecha / Hora</th>
                  <th scope="col">Archivo Fuente</th>
                  <th scope="col">Tipo Lote</th>
                  <th scope="col" className="m3-col-num">Válidos</th>
                  <th scope="col" className="m3-col-num">Rechazados</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {sortedLotes.map((lote, idx) => {
                  const hasRechazos = Number(lote.rechazados) > 0
                  const isSelected = Number(lote.lote_id) === Number(activeLoteId)

                  return (
                    <tr
                      key={lote.lote_id}
                      style={isSelected ? { background: 'rgba(143, 231, 222, 0.22)' } : {}}
                    >
                      <td className="m3-col-rowidx">{idx + 1}</td>
                      <td className="tabular-nums font-bold">#{lote.lote_id}</td>
                      <td className="m3-text-muted">{lote.fecha_corrida}</td>
                      <td className="m3-cell-title">
                        <strong>{lote.archivo}</strong>
                      </td>
                      <td>
                        <span className="m3-badge m3-badge--teal">{lote.tipo || 'BUK'}</span>
                      </td>
                      <td className="m3-col-num tabular-nums font-bold">
                        {Number(lote.validos || 0).toLocaleString('es-CL')}
                      </td>
                      <td
                        className="m3-col-num tabular-nums font-bold"
                        style={{ color: hasRechazos ? 'var(--red-ink)' : 'inherit' }}
                      >
                        {Number(lote.rechazados || 0)}
                      </td>
                      <td>
                        {hasRechazos ? (
                          <span className="m3-badge" style={{ background: 'var(--md-sys-color-error-container)', color: 'var(--red-ink)' }}>
                            <PixelAlertIcon size={12} />
                            <span>{lote.rechazados} Aislados</span>
                          </span>
                        ) : (
                          <span className="m3-badge m3-badge--teal">
                            <PixelCheckIcon size={12} />
                            <span>Completado</span>
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`m3-btn m3-btn--xs ${isSelected ? 'm3-btn--primary' : 'm3-btn--tonal'}`}
                          onClick={() => {
                            setActiveLoteId(lote.lote_id)
                            if (hasRechazos) setActiveTab('rechazados')
                          }}
                        >
                          {isSelected ? 'Activo' : 'Ver'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <table className="m3-data-table">
              <thead>
                <tr>
                  <th scope="col" className="m3-col-rowidx">#</th>
                  <th scope="col">Fila Origen</th>
                  <th scope="col">Regla / Motivo</th>
                  <th scope="col">PersonaId</th>
                  <th scope="col">IT / Sede</th>
                  <th scope="col">Período</th>
                  <th scope="col">Horas</th>
                  <th scope="col">Detalle del Error</th>
                </tr>
              </thead>
              <tbody>
                {filteredRechazados.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '24px', color: 'var(--ink-2)' }}>
                      Este lote no contiene registros rechazados (100% de filas válidas).
                    </td>
                  </tr>
                ) : (
                  filteredRechazados.map((r, idx) => {
                    let parsed = {}
                    try {
                      parsed = typeof r.payload === 'string' ? JSON.parse(r.payload) : (r.payload || {})
                    } catch {
                      parsed = {}
                    }

                    return (
                      <tr key={r.rechazo_id || idx} className="m3-row--error">
                        <td className="m3-col-rowidx">{idx + 1}</td>
                        <td className="tabular-nums font-bold">Fila {r.fila_origen || '—'}</td>
                        <td>
                          <span className="m3-badge" style={{ background: 'var(--md-sys-color-error-container)', color: 'var(--red-ink)', fontWeight: 700 }}>
                            {r.motivo || 'ERROR'}
                          </span>
                        </td>
                        <td className="tabular-nums font-bold">{parsed.PersonaId || parsed.persona_id || '—'}</td>
                        <td>{parsed.IT || parsed.it || '—'}</td>
                        <td>{parsed.Periodo || parsed.periodo || '—'}</td>
                        <td className="tabular-nums">{parsed.HorasSemanales || parsed.horas_semanales || '—'}</td>
                        <td className="m3-cell-title" style={{ color: 'var(--red-ink)' }}>
                          {r.detalle || 'Infracción de regla de integridad'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
