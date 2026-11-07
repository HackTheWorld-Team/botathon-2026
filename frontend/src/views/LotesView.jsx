import React, { useState, useEffect, useMemo } from 'react'
import {
  PixelCheckIcon,
  PixelAlertIcon,
  PixelExcelIcon,
  PixelBookIcon,
} from '../components/PixelIcons.jsx'
import {
  MOCK_LOTES,
  VALIDATION_RULES_CATALOG,
  fetchLoteRechazados,
  buildMockLoteRechazados,
  downloadRejectedReport,
} from '../api.js'

export default function LotesView({ lotes = [], easyReading = false }) {
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
  const [activeSubTab, setActiveSubTab] = useState('lotes') // 'lotes' | 'reglas' | 'rechazados'
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

  const rulesBreakdown = useMemo(() => {
    const countsByRule = {}
    const apiResumen = Array.isArray(loteDetail?.resumen_reglas)
      ? loteDetail.resumen_reglas
      : []

    for (const item of apiResumen) {
      if (item && item.motivo) {
        countsByRule[item.motivo] = Number(item.cantidad) || 0
      }
    }

    if (apiResumen.length === 0 && Array.isArray(loteDetail?.rechazados)) {
      for (const r of loteDetail.rechazados) {
        const code = r.motivo || 'OTHER'
        countsByRule[code] = (countsByRule[code] || 0) + 1
      }
    }

    return VALIDATION_RULES_CATALOG.map((rule) => ({
      ...rule,
      cantidad: countsByRule[rule.codigo] || 0,
    }))
  }, [loteDetail])

  const filteredRechazados = useMemo(() => {
    const list = Array.isArray(loteDetail?.rechazados) ? loteDetail.rechazados : []
    if (selectedRuleFilter === 'TODAS') return list
    return list.filter((r) => (r.motivo || 'OTHER') === selectedRuleFilter)
  }, [loteDetail, selectedRuleFilter])

  return (
    <div className="m3-view-stack">
      {/* Tarjeta de Lectura Fácil (Comprensión Cognitiva) */}
      <div className="easy-reading-card" role="region" aria-label="Explicación en lenguaje claro">
        <h3 className="easy-reading-card__title">
          <PixelBookIcon size={14} />
          <span>Lectura Fácil: ¿Qué hace el robot RPA y qué son los Lotes?</span>
        </h3>
        <p className="easy-reading-card__text">
          El robot Blue Prism procesa automáticamente los archivos de dotación y atenciones sin copiar y pegar a mano.
          Si un archivo contiene errores (horas negativas, códigos de instituto inválidos o contratos repetidos),
          el robot separa las filas malas en un reporte Excel para que puedan corregirse, procesando solo los datos válidos.
        </p>
      </div>

      {/* 1. Top KPI Strip Horizontal M3 (~84px) */}
      <section aria-label="Trazabilidad de ejecuciones RPA" className="m3-kpi-strip">
        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Lotes Procesados</span>
            <span className="status-badge status-badge--teal">
              <PixelCheckIcon size={12} />
              <span>Blue Prism</span>
            </span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums">
              {stats.totalLotes}
            </h3>
            <span className="m3-kpi-card__sub">ejecuciones auditables</span>
          </div>
          <p className="kpi-card__note" style={{ margin: 0, fontSize: '0.71rem', color: 'var(--ink-2)' }}>
            Archivos BUK Dotación y SIC Atenciones Reales.
          </p>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Filas Válidas Aprobadas</span>
            <span className="status-badge status-badge--cumplido">
              <PixelCheckIcon size={12} />
              <span>{stats.tasa}% Aprobación</span>
            </span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums" style={{ color: 'var(--teal-ink)' }}>
              {stats.totalValidos.toLocaleString('es-CL')}
            </h3>
            <span className="m3-kpi-card__sub">incorporadas a la base</span>
          </div>
          <p className="kpi-card__note" style={{ margin: 0, fontSize: '0.71rem', color: 'var(--ink-2)' }}>
            Contratos y atenciones validadas sin duplicados.
          </p>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Rechazos en Cuarentena</span>
            <span className="status-badge status-badge--critico" style={{ color: 'var(--red-ink)' }}>
              <PixelAlertIcon size={12} />
              <span>Aislados</span>
            </span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums" style={{ color: 'var(--red-ink)' }}>
              {stats.totalRechazados}
            </h3>
            <span className="m3-kpi-card__sub">sin detener el proceso</span>
          </div>
          <p className="kpi-card__note" style={{ margin: 0, fontSize: '0.71rem', color: 'var(--ink-2)' }}>
            Persistidos en tabla <code>rechazados</code> con motivo.
          </p>
        </article>

        <article className="m3-kpi-card">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label">Lote Activo #{activeLote?.lote_id}</span>
            <span className="m3-badge m3-badge--secondary">{activeLote?.archivo}</span>
          </div>
          <div className="m3-kpi-card__body">
            <h3 className="m3-kpi-card__metric tabular-nums">
              {Number(activeLote?.validos || 0).toLocaleString('es-CL')}
            </h3>
            <span className="m3-kpi-card__sub" style={{ color: Number(activeLote?.rechazados) > 0 ? 'var(--red-ink)' : 'var(--teal-ink)' }}>
              {Number(activeLote?.rechazados) > 0 ? `${activeLote?.rechazados} filas rechazadas` : '100% válido'}
            </span>
          </div>
          <p className="kpi-card__note" style={{ margin: 0, fontSize: '0.71rem', color: 'var(--ink-2)' }}>
            {activeLote?.fecha_corrida || 'Fecha no disponible'}
          </p>
        </article>
      </section>

      {/* 2. Main Sheet Card M3 (>80% Viewport con scroll interno) */}
      <section aria-labelledby="lotes-main-heading" className="m3-sheet-card">
        {/* Toolbar M3 */}
        <div className="m3-sheet-card__toolbar">
          <div className="m3-sheet-card__title-box">
            <h2 id="lotes-main-heading" className="m3-sheet-card__title">
              Trazabilidad de Lotes Blue Prism y Desglose de Infracciones
            </h2>
            <span className="m3-badge m3-badge--neutral">
              Lote Activo #{activeLote?.lote_id}
            </span>
          </div>

          <div className="m3-sheet-card__actions">
            {/* Sub-pestañas */}
            <div role="group" aria-label="Secciones de lotes" style={{ display: 'inline-flex', gap: '4px' }}>
              <button
                type="button"
                className={`m3-chip ${activeSubTab === 'lotes' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setActiveSubTab('lotes')}
              >
                Historial de Lotes ({sortedLotes.length})
              </button>
              <button
                type="button"
                className={`m3-chip ${activeSubTab === 'reglas' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                onClick={() => setActiveSubTab('reglas')}
              >
                Catálogo de Reglas (8 Oficiales)
              </button>
              <button
                type="button"
                className={`m3-chip ${activeSubTab === 'rechazados' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                style={Number(activeLote?.rechazados) > 0 ? { borderColor: 'var(--red-ink)' } : {}}
                onClick={() => setActiveSubTab('rechazados')}
              >
                <PixelAlertIcon size={12} />
                <span>Filas Rechazadas Lote #{activeLote?.lote_id} ({loteDetail?.total_rechazados || 0})</span>
              </button>
            </div>

            {/* Descargar Rejected_Records_Report.xlsx */}
            <button
              type="button"
              className="m3-chip m3-chip--action"
              style={{ fontWeight: 700 }}
              onClick={() => downloadRejectedReport(activeLote?.lote_id)}
              title={`Descargar Rejected_Records_Report.xlsx para el Lote #${activeLote?.lote_id}`}
            >
              <PixelExcelIcon size={14} />
              <span>Reporte Rechazos (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Viewport de Tabla con Scroll Interno */}
        <div className="m3-table-viewport" tabIndex="0" role="region" aria-label="Tabla de trazabilidad de lotes">
          {activeSubTab === 'lotes' && (
            <table className="m3-data-table">
              <thead>
                <tr>
                  <th scope="col" className="m3-col-rowidx">#</th>
                  <th scope="col">Lote ID</th>
                  <th scope="col">Fecha / Hora de Ejecución</th>
                  <th scope="col">Archivo Fuente Ingestado</th>
                  <th scope="col">Tipo de Datos</th>
                  <th scope="col" className="m3-col-num">Filas Válidas</th>
                  <th scope="col" className="m3-col-num">Filas Rechazadas</th>
                  <th scope="col">Estado de Ingesta</th>
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
                          <span className="status-badge status-badge--critico" style={{ color: 'var(--red-ink)' }}>
                            <PixelAlertIcon size={12} />
                            <span>{lote.rechazados} Aislados</span>
                          </span>
                        ) : (
                          <span className="status-badge status-badge--cumplido">
                            <PixelCheckIcon size={12} />
                            <span>100% Válido</span>
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`m3-btn m3-btn--xs ${isSelected ? 'm3-btn--primary' : 'm3-btn--tonal'}`}
                          onClick={() => {
                            setActiveLoteId(lote.lote_id)
                            if (hasRechazos) setActiveSubTab('rechazados')
                          }}
                        >
                          {isSelected ? 'Seleccionado' : 'Inspeccionar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {activeSubTab === 'reglas' && (
            <table className="m3-data-table">
              <thead>
                <tr>
                  <th scope="col" className="m3-col-rowidx">#</th>
                  <th scope="col">Código de Regla</th>
                  <th scope="col">Origen</th>
                  <th scope="col">Nombre de la Regla de Validación</th>
                  <th scope="col">Explicación Técnica del Criterio de Rechazo</th>
                  <th scope="col" className="m3-col-num">Rechazos en Lote #{activeLote?.lote_id}</th>
                  <th scope="col">Filtrar</th>
                </tr>
              </thead>
              <tbody>
                {rulesBreakdown.map((r, idx) => {
                  const hasErrors = r.cantidad > 0
                  return (
                    <tr key={r.codigo} style={hasErrors ? { background: 'rgba(198, 40, 40, 0.04)' } : {}}>
                      <td className="m3-col-rowidx">{idx + 1}</td>
                      <td>
                        <code style={{ fontWeight: 700, color: hasErrors ? 'var(--red-ink)' : 'var(--onyx)' }}>
                          {r.codigo}
                        </code>
                      </td>
                      <td>
                        <span className="m3-badge m3-badge--neutral">{r.origen}</span>
                      </td>
                      <td className="m3-cell-title">
                        <strong>{r.nombre}</strong>
                      </td>
                      <td className="m3-cell-title m3-text-muted">
                        {r.explicacion}
                      </td>
                      <td
                        className="m3-col-num tabular-nums font-bold"
                        style={{ color: hasErrors ? 'var(--red-ink)' : 'inherit' }}
                      >
                        {r.cantidad}
                      </td>
                      <td>
                        {hasErrors ? (
                          <button
                            type="button"
                            className="m3-btn m3-btn--xs m3-btn--primary"
                            onClick={() => {
                              setSelectedRuleFilter(r.codigo)
                              setActiveSubTab('rechazados')
                            }}
                          >
                            Ver {r.cantidad}
                          </button>
                        ) : (
                          <span className="m3-text-muted" style={{ fontSize: '0.72rem' }}>0 errores</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {activeSubTab === 'rechazados' && (
            <div>
              {/* Barra de Filtro de Reglas para Rechazados */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', padding: '8px 12px', background: 'var(--md-sys-color-surface-container-low)', borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-2)' }}>
                  Filtrar por Regla:
                </span>
                <button
                  type="button"
                  className={`m3-chip ${selectedRuleFilter === 'TODAS' ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                  onClick={() => setSelectedRuleFilter('TODAS')}
                >
                  Todas ({loteDetail?.total_rechazados || 0})
                </button>
                {rulesBreakdown.filter((r) => r.cantidad > 0).map((r) => (
                  <button
                    key={r.codigo}
                    type="button"
                    className={`m3-chip ${selectedRuleFilter === r.codigo ? 'm3-chip--selected' : 'm3-chip--filter'}`}
                    style={selectedRuleFilter === r.codigo ? { background: 'var(--md-sys-color-error-container)', color: 'var(--red-ink)', borderColor: 'var(--red-ink)' } : {}}
                    onClick={() => setSelectedRuleFilter(r.codigo)}
                  >
                    <PixelAlertIcon size={12} />
                    <span>{r.codigo} ({r.cantidad})</span>
                  </button>
                ))}
              </div>

              <table className="m3-data-table">
                <thead>
                  <tr>
                    <th scope="col" className="m3-col-rowidx">#</th>
                    <th scope="col">Fila Origen Excel</th>
                    <th scope="col">Regla Infraccionada</th>
                    <th scope="col">PersonaId</th>
                    <th scope="col">IT / Sede</th>
                    <th scope="col">Período</th>
                    <th scope="col" className="m3-col-num">Horas Semanales</th>
                    <th scope="col">Especialidad</th>
                    <th scope="col">Detalle del Error / Infracción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRechazados.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '24px', color: 'var(--ink-2)' }}>
                        El Lote #{activeLote?.lote_id} no contiene registros rechazados bajo el filtro activo.
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
                          <td className="tabular-nums font-bold">Fila #{r.fila_origen || '—'}</td>
                          <td>
                            <span className="status-badge status-badge--critico" style={{ color: 'var(--red-ink)', fontWeight: 700 }}>
                              <PixelAlertIcon size={12} />
                              <span>{r.motivo || 'ERROR'}</span>
                            </span>
                          </td>
                          <td className="tabular-nums font-bold">#{parsed.PersonaId || parsed.persona_id || '—'}</td>
                          <td><strong>{parsed.IT || parsed.it || '—'}</strong></td>
                          <td className="tabular-nums">{parsed.Periodo || parsed.periodo || '—'}</td>
                          <td className="m3-col-num tabular-nums font-bold">{parsed.HorasSemanales || parsed.horas_semanales || '—'}</td>
                          <td>{parsed.Cod_Esp || parsed.cod_esp || '—'}</td>
                          <td className="m3-cell-title" style={{ color: 'var(--red-ink)' }}>
                            {r.detalle || 'Infracción de regla de integridad referencial o tipo de dato'}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
