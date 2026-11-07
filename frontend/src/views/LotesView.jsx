import React, { useState, useEffect, useMemo } from 'react'
import {
  PixelCheckIcon,
  PixelAlertIcon,
  PixelDownloadIcon,
} from '../components/PixelIcons.jsx'
import {
  MOCK_LOTES,
  VALIDATION_RULES_CATALOG,
  fetchLoteRechazados,
  buildMockLoteRechazados,
  parseRejectedPayload,
  downloadRejectedReport,
} from '../api.js'

/**
 * LotesView.jsx — Trazabilidad S4 de lotes procesados por Blue Prism y registros rechazados (Issue #48, UI_SPEC.md §6)
 *
 * Cumple 100% criterios de aceptación #48:
 * - Tabla de lotes ordenada por timestamp descendente con <caption>, <th scope="col">, <th scope="row">
 *   y columna de rechazados con doble codificación WCAG (icono + texto + borde/color).
 * - Detalle expandible por lote con botón aria-expanded y aria-controls en cada fila, 100% navegable por teclado.
 * - Llamada a fetchLoteRechazados(lote_id) (GET /api/lotes/{id}/rechazados con fallback determinista).
 * - Desglose por Regla de Validación (resumen_reglas) para los 8 códigos oficiales:
 *   NEGATIVE_HS, TEXT_HS, BAD_IT, DUP_PK, HS_OVER, BAD_ESP, NEGATIVE_ATE, TEXT_ATE.
 * - Tabla detallada de registros rechazados con fila_origen, motivo, detalle y campos parseados de payload
 *   (PersonaId, IT, Periodo, Horas Semanales, Cod_Esp).
 * - Descarga directa de Rejected_Records_Report.xlsx para el lote seleccionado (GET /api/lotes/{id}/reporte-rechazos).
 * - Live region polite que anuncia la expansión/selección de lote y descarga de reportes.
 */
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
  const [expandedLoteId, setExpandedLoteId] = useState(defaultLoteId)
  const [loteDetail, setLoteDetail] = useState(() =>
    buildMockLoteRechazados(defaultLoteId)
  )
  const [selectedRuleFilter, setSelectedRuleFilter] = useState(' TODAS ')
  const [liveStatus, setLiveStatus] = useState('')
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  useEffect(() => {
    if (!expandedLoteId) return
    let active = true
    setIsLoadingDetail(true)
    // Respuesta inmediata determinista + actualización desde API real si está disponible
    setLoteDetail(buildMockLoteRechazados(expandedLoteId))
    fetchLoteRechazados(expandedLoteId)
      .then((data) => {
        if (active && data) {
          setLoteDetail(data)
        }
      })
      .finally(() => {
        if (active) setIsLoadingDetail(false)
      })
    return () => {
      active = false
    }
  }, [expandedLoteId])

  function handleToggleLote(lote) {
    const targetId = lote.lote_id
    setSelectedRuleFilter('TODAS')
    if (expandedLoteId === targetId) {
      setExpandedLoteId(null)
      setLiveStatus(`Detalle del lote #${targetId} (${lote.archivo}) contraído.`)
    } else {
      setExpandedLoteId(targetId)
      setLiveStatus(
        `Lote #${targetId} (${lote.archivo}) expandido: ${lote.validos} filas válidas y ${lote.rechazados} filas rechazadas aisladas.`
      )
    }
  }

  async function handleDownloadReport(loteId) {
    const idToDownload = loteId || expandedLoteId || defaultLoteId
    setLiveStatus(
      `Iniciando descarga de Rejected_Records_Report para el Lote #${idToDownload}...`
    )
    const result = await downloadRejectedReport(idToDownload)
    if (result?.filename) {
      setLiveStatus(`Archivo ${result.filename} descargado correctamente.`)
    }
  }

  // Construir matriz completa de las 8 reglas de validación combinando resumen_reglas del lote activo
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

    // Si resumen_reglas vino vacío pero hay rechazados, contabilizar desde rechazados
    if (apiResumen.length === 0 && Array.isArray(loteDetail?.rechazados)) {
      for (const r of loteDetail.rechazados) {
        const code = r.motivo || 'OTHER'
        countsByRule[code] = (countsByRule[code] || 0) + 1
      }
    }

    const catalogWithCounts = VALIDATION_RULES_CATALOG.map((rule) => ({
      ...rule,
      cantidad: countsByRule[rule.codigo] || 0,
    }))

    // Incluir cualquier código adicional (ej. OTHER) si vino del backend
    for (const [motivo, cantidad] of Object.entries(countsByRule)) {
      if (!VALIDATION_RULES_CATALOG.some((c) => c.codigo === motivo)) {
        catalogWithCounts.push({
          codigo: motivo,
          origen: 'BUK / SIC',
          nombre: 'Error de estructura o formato general',
          explicacion: 'PersonaId, período u otro campo obligatorio con formato inválido.',
          cantidad,
        })
      }
    }

    return catalogWithCounts
  }, [loteDetail])

  const filteredRejectedRows = useMemo(() => {
    const list = Array.isArray(loteDetail?.rechazados) ? loteDetail.rechazados : []
    const cleanFilter = selectedRuleFilter.trim()
    if (!cleanFilter || cleanFilter === 'TODAS') return list
    return list.filter((r) => (r.motivo || 'OTHER') === cleanFilter)
  }, [loteDetail, selectedRuleFilter])

  const activeLoteObj =
    sortedLotes.find((l) => Number(l.lote_id) === Number(expandedLoteId)) ||
    sortedLotes[0]

  return (
    <div className="view-container">
      {/* Live region polite para anunciar expansión de lote y filtros a lectores de pantalla */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveStatus}
      </div>

      <div className="view-header">
        <div>
          <h2 id="panel-heading-lotes" tabIndex="-1" className="view-title">
            Trazabilidad de Lotes RPA Blue Prism y Desglose de Rechazos
          </h2>
          <p className="view-subtitle">
            Historial auditable de ejecuciones del worker RPA: cada fila corrupta se aísla en{' '}
            <code>Rejected_Records_Report.xlsx</code> sin detener la ingesta de registros válidos.
          </p>
        </div>

        <div className="view-header__badges">
          <button
            type="button"
            className="btn-pixel btn-pixel--primary"
            onClick={() => handleDownloadReport(activeLoteObj?.lote_id)}
            aria-label={`Descargar Rejected_Records_Report.xlsx del Lote #${activeLoteObj?.lote_id || 104}`}
          >
            <PixelDownloadIcon size={16} />
            <span>
              Descargar Rejected_Records_Report.xlsx (Lote #{activeLoteObj?.lote_id || 104})
            </span>
          </button>
        </div>
      </div>

      {/* 1. Tabla de Lotes de Ingesta ordenados por timestamp descendente */}
      <section aria-labelledby="lotes-hist-heading" className="panel-section">
        <div className="panel-section__header">
          <div>
            <h3 id="lotes-hist-heading" className="panel-section__title">
              1. Historial de Lotes de Ingesta (Ordenado por Fecha/Hora Descendente)
            </h3>
            <p className="panel-section__desc">
              Seleccione cualquier lote con <kbd>Enter</kbd>, <kbd>Espacio</kbd> o clic para inspeccionar su desglose por regla de validación y filas aisladas.
            </p>
          </div>
        </div>

        <div
          className="table-responsive"
          role="region"
          aria-labelledby="lotes-hist-heading"
          tabIndex="0"
        >
          <table className="pixel-table">
            <caption className="sr-only">
              Historial de lotes ejecutados por el bot Blue Prism ordenados por fecha y hora descendente, con filas válidas, filas rechazadas con doble codificación WCAG y botón expandible de detalle
            </caption>
            <thead>
              <tr>
                <th scope="col">ID Lote</th>
                <th scope="col">Archivo Fuente</th>
                <th scope="col">Tipo</th>
                <th scope="col">Timestamp Corrida</th>
                <th scope="col" className="num-col">Duración</th>
                <th scope="col" className="num-col">Filas Válidas</th>
                <th scope="col" className="num-col">Filas Rechazadas (WCAG)</th>
                <th scope="col">Estado del Lote</th>
                <th scope="col">Detalle y Reporte</th>
              </tr>
            </thead>
            <tbody>
              {sortedLotes.map((l) => {
                const rejCount = Number(l.rechazados) || 0
                const hasRej = rejCount > 0
                const isExpanded = Number(expandedLoteId) === Number(l.lote_id)
                return (
                  <tr
                    key={l.lote_id}
                    className={`${hasRej ? 'row-critico' : ''} ${
                      isExpanded ? 'row-selected-lote' : ''
                    }`}
                  >
                    <th scope="row" className="tabular-nums">
                      #{l.lote_id}
                    </th>
                    <td>
                      <code>{l.archivo}</code>
                    </td>
                    <td>
                      <span className="status-badge">
                        <strong>{l.tipo || 'BUK'}</strong>
                      </span>
                    </td>
                    <td className="tabular-nums">
                      <time dateTime={l.fecha_corrida}>{l.fecha_corrida}</time>
                    </td>
                    <td className="num-col tabular-nums">
                      {Number(l.duracion_ms || 0).toLocaleString('es-CL')} ms
                    </td>
                    <td className="num-col tabular-nums">
                      <span className="status-badge status-badge--cumplido">
                        <PixelCheckIcon size={14} />
                        <span>{Number(l.validos || 0).toLocaleString('es-CL')} OK</span>
                      </span>
                    </td>
                    <td className="num-col tabular-nums">
                      {hasRej ? (
                        <span className="status-badge status-badge--critico">
                          <PixelAlertIcon size={14} />
                          <span>
                            {rejCount.toLocaleString('es-CL')} Rechazadas
                          </span>
                        </span>
                      ) : (
                        <span className="status-badge status-badge--cumplido">
                          <PixelCheckIcon size={14} />
                          <span>0 Rechazadas</span>
                        </span>
                      )}
                    </td>
                    <td>
                      {hasRej ? (
                        <span className="status-badge status-badge--critico">
                          <PixelAlertIcon size={14} />
                          <span>Con Rechazos Aislados ({rejCount})</span>
                        </span>
                      ) : (
                        <span className="status-badge status-badge--cumplido">
                          <PixelCheckIcon size={14} />
                          <span>100% Válido</span>
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="lote-row-actions">
                        <button
                          type="button"
                          className={`btn-pixel btn-pixel--sm ${
                            isExpanded ? 'btn-pixel--primary' : 'btn-pixel--secondary'
                          }`}
                          aria-expanded={isExpanded}
                          aria-controls="lote-expanded-detail-panel"
                          onClick={() => handleToggleLote(l)}
                        >
                          <span>
                            {isExpanded
                              ? `Ocultar detalle #${l.lote_id} ▲`
                              : `Inspeccionar #${l.lote_id} ▼`}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="btn-pixel btn-pixel--ghost btn-pixel--sm"
                          onClick={() => handleDownloadReport(l.lote_id)}
                          aria-label={`Descargar Rejected_Records_Report.xlsx para lote ${l.lote_id}`}
                          title={`Descargar reporte Excel del Lote #${l.lote_id}`}
                        >
                          <PixelDownloadIcon size={14} />
                          <span>.xlsx</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Panel Expandible del Lote Seleccionado */}
      {expandedLoteId !== null && (
        <div
          id="lote-expanded-detail-panel"
          className="lote-detail-wrapper"
          role="region"
          aria-label={`Detalle de validación y rechazos del Lote #${loteDetail.lote_id}`}
        >
          {/* 2. Desglose por Regla de Validación (resumen_reglas) */}
          <section aria-labelledby="rules-breakdown-heading" className="panel-section">
            <div className="panel-section__header">
              <div>
                <h3 id="rules-breakdown-heading" className="panel-section__title">
                  2. Desglose por Regla de Validación — Lote #{loteDetail.lote_id} (
                  <code>{loteDetail.archivo}</code>)
                </h3>
                <p className="panel-section__desc">
                  Conteo de filas rechazadas por cada código de regla de negocio en{' '}
                  <code>bot/worker.py</code>. Puede filtrar la tabla inferior seleccionando una regla.
                </p>
              </div>

              <div className="view-header__badges">
                {selectedRuleFilter.trim() !== 'TODAS' && (
                  <button
                    type="button"
                    className="btn-pixel btn-pixel--secondary btn-pixel--sm"
                    onClick={() => {
                      setSelectedRuleFilter('TODAS')
                      setLiveStatus('Mostrando todas las reglas de validación del lote.')
                    }}
                  >
                    Mostrar todas las reglas ({loteDetail.total_rechazados || 0})
                  </button>
                )}
              </div>
            </div>

            {/* Tarjetas / Botones de Reglas de Validación */}
            <div
              className="rules-grid"
              role="group"
              aria-label="Tarjetas de reglas de validación con conteo de rechazos"
            >
              {rulesBreakdown.map((rule) => {
                const hasHits = rule.cantidad > 0
                const isSelectedRule = selectedRuleFilter.trim() === rule.codigo
                return (
                  <div
                    key={rule.codigo}
                    className={`rule-card ${hasHits ? 'rule-card--has-errors' : 'rule-card--clean'} ${
                      isSelectedRule ? 'rule-card--active' : ''
                    }`}
                  >
                    <div className="rule-card__header">
                      <code className="rule-card__code">{rule.codigo}</code>
                      {hasHits ? (
                        <span className="status-badge status-badge--critico">
                          <PixelAlertIcon size={13} />
                          <span className="tabular-nums">
                            {rule.cantidad} {rule.cantidad === 1 ? 'fila' : 'filas'}
                          </span>
                        </span>
                      ) : (
                        <span className="status-badge status-badge--cumplido">
                          <PixelCheckIcon size={13} />
                          <span className="tabular-nums">0 filas</span>
                        </span>
                      )}
                    </div>
                    <p className="rule-card__title">
                      <strong>{rule.nombre}</strong>{' '}
                      <span className="rule-card__origin">({rule.origen})</span>
                    </p>
                    <p className="rule-card__desc">{rule.explicacion}</p>
                    <div className="rule-card__footer">
                      <button
                        type="button"
                        className={`btn-pixel btn-pixel--sm ${
                          isSelectedRule ? 'btn-pixel--primary' : 'btn-pixel--secondary'
                        }`}
                        aria-pressed={isSelectedRule}
                        onClick={() => {
                          const next = isSelectedRule ? 'TODAS' : rule.codigo
                          setSelectedRuleFilter(next)
                          setLiveStatus(
                            next === 'TODAS'
                              ? `Filtro de regla desactivado. Mostrando ${loteDetail.total_rechazados} filas rechazadas.`
                              : `Filtrando por regla ${rule.codigo} (${rule.nombre}): ${rule.cantidad} filas.`
                          )
                        }}
                      >
                        <span>
                          {isSelectedRule
                            ? `Filtro activo: ${rule.codigo}`
                            : `Filtrar por ${rule.codigo} (${rule.cantidad})`}
                        </span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* 3. Tabla Detallada de Registros Rechazados con Payload Parseado */}
          <section aria-labelledby="rejected-detail-heading" className="panel-section">
            <div className="panel-section__header">
              <div>
                <h3 id="rejected-detail-heading" className="panel-section__title">
                  3. Detalle de Registros Aislados en Rejected_Records_Report — Lote #
                  {loteDetail.lote_id}
                  {selectedRuleFilter.trim() !== 'TODAS'
                    ? ` (Regla: ${selectedRuleFilter.trim()})`
                    : ''}
                </h3>
                <p className="panel-section__desc">
                  Trazabilidad fila por fila con <code>fila_origen</code>, código <code>motivo</code>,{' '}
                  <code>detalle</code> del error y campos extraídos de <code>payload</code> (
                  <code>PersonaId</code>, <code>IT</code>, <code>Periodo</code>,{' '}
                  <code>Horas Semanales</code>, <code>Cod_Esp</code>).
                  {isLoadingDetail ? ' Actualizando desde API...' : ''}
                </p>
              </div>

              <button
                type="button"
                className="btn-pixel btn-pixel--secondary btn-pixel--sm"
                onClick={() => handleDownloadReport(loteDetail.lote_id)}
              >
                <PixelDownloadIcon size={15} />
                <span>
                  Descargar Reporte Lote #{loteDetail.lote_id} (.xlsx)
                </span>
              </button>
            </div>

            {filteredRejectedRows.length === 0 ? (
              <div className="empty-state-box" role="status">
                <span className="status-badge status-badge--cumplido">
                  <PixelCheckIcon size={16} />
                  <span>0 registros rechazados para la selección actual</span>
                </span>
                <p className="empty-state-box__text">
                  {Number(loteDetail.total_rechazados) === 0
                    ? `El Lote #${loteDetail.lote_id} (${loteDetail.archivo}) fue procesado con 100% de registros válidos y 0 filas rechazadas.`
                    : `No existen filas rechazadas bajo la regla ${selectedRuleFilter.trim()} en el Lote #${loteDetail.lote_id}.`}
                </p>
              </div>
            ) : (
              <div
                className="table-responsive"
                role="region"
                aria-labelledby="rejected-detail-heading"
                tabIndex="0"
              >
                <table className="pixel-table">
                  <caption className="sr-only">
                    Detalle de las {filteredRejectedRows.length} filas rechazadas en el Lote #
                    {loteDetail.lote_id} con fila origen, motivo, detalle y campos de payload
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Fila Origen</th>
                      <th scope="col">Motivo (Regla)</th>
                      <th scope="col">Detalle de Validación</th>
                      <th scope="col">PersonaId (Payload)</th>
                      <th scope="col">IT (Payload)</th>
                      <th scope="col">Periodo (Payload)</th>
                      <th scope="col" className="num-col">Horas Semanales (Payload)</th>
                      <th scope="col">Cod_Esp (Payload)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRejectedRows.map((r, idx) => {
                      const filaNum = r.fila_origen ?? r.fila_excel ?? idx + 1
                      const motivoCode = r.motivo || 'OTHER'
                      const detalleText = r.detalle || r.regla_violada || 'Error de validación'
                      const payloadFields = parseRejectedPayload(r)

                      return (
                        <tr key={`${loteDetail.lote_id}-${filaNum}-${motivoCode}`}>
                          <th scope="row" className="tabular-nums">
                            Fila #{filaNum}
                          </th>
                          <td>
                            <span className="status-badge status-badge--critico">
                              <PixelAlertIcon size={13} />
                              <code>{motivoCode}</code>
                            </span>
                          </td>
                          <td>{detalleText}</td>
                          <td className="tabular-nums">
                            <strong>{payloadFields.PersonaId}</strong>
                          </td>
                          <td className="tabular-nums">{payloadFields.IT}</td>
                          <td className="tabular-nums">{payloadFields.Periodo}</td>
                          <td className="num-col tabular-nums">
                            <code>{payloadFields.HorasSemanales}</code>
                          </td>
                          <td>
                            <code>{payloadFields.Cod_Esp}</code>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
