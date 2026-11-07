import React from 'react'
import {
  PixelCheckIcon,
  PixelAlertIcon,
  PixelDownloadIcon,
} from '../components/PixelIcons.jsx'
import { MOCK_REJECTED_RECORDS, downloadRejectedReport } from '../api.js'

/**
 * LotesView.jsx — Trazabilidad S4 de lotes procesados por Blue Prism y registros rechazados (UI_SPEC.md §6)
 * Heading con tabIndex="-1" para gestión de foco WAI-ARIA Tabs.
 */
export default function LotesView({ lotes = [] }) {
  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h2 id="panel-heading-lotes" tabIndex="-1" className="view-title">
            Trazabilidad de Lotes RPA Blue Prism y Rechazos
          </h2>
          <p className="view-subtitle">
            Historial auditable de ejecuciones del worker RPA: cada fila corrupta se aísla en{' '}
            <code>Rejected_Records_Report</code> sin abortar la carga de registros válidos.
          </p>
        </div>

        <button
          type="button"
          className="btn-pixel btn-pixel--primary"
          onClick={() => downloadRejectedReport()}
        >
          <PixelDownloadIcon size={16} />
          <span>Descargar Rejected_Records_Report.csv</span>
        </button>
      </div>

      <section aria-labelledby="lotes-hist-heading" className="panel-section">
        <h3 id="lotes-hist-heading" className="panel-section__title">
          Historial de Lotes de Ingesta (BUK / SIC)
        </h3>

        <div className="table-responsive" role="region" aria-labelledby="lotes-hist-heading" tabIndex="0">
          <table className="pixel-table">
            <caption className="sr-only">
              Historial de lotes ejecutados por el bot Blue Prism con duración, filas válidas y rechazadas
            </caption>
            <thead>
              <tr>
                <th scope="col">ID Lote</th>
                <th scope="col">Archivo Fuente</th>
                <th scope="col">Tipo</th>
                <th scope="col">Fecha / Hora Corrida</th>
                <th scope="col" className="num-col">Duración</th>
                <th scope="col" className="num-col">Filas Válidas</th>
                <th scope="col" className="num-col">Filas Rechazadas</th>
                <th scope="col">Estado del Lote</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => {
                const hasRej = Number(l.rechazados) > 0
                return (
                  <tr key={l.lote_id} className={hasRej ? 'row-critico' : ''}>
                    <th scope="row" className="tabular-nums">#{l.lote_id}</th>
                    <td><code>{l.archivo}</code></td>
                    <td><strong>{l.tipo}</strong></td>
                    <td className="tabular-nums">{l.fecha_corrida}</td>
                    <td className="num-col tabular-nums">{l.duracion_ms} ms</td>
                    <td className="num-col tabular-nums">
                      {Number(l.validos).toLocaleString('es-CL')}
                    </td>
                    <td className="num-col tabular-nums font-bold">
                      {Number(l.rechazados).toLocaleString('es-CL')}
                    </td>
                    <td>
                      {hasRej ? (
                        <span className="status-badge status-badge--critico">
                          <PixelAlertIcon size={14} />
                          <span>Con Rechazos Aislados ({l.rechazados})</span>
                        </span>
                      ) : (
                        <span className="status-badge status-badge--cumplido">
                          <PixelCheckIcon size={14} />
                          <span>100% Válido</span>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="rejected-detail-heading" className="panel-section">
        <h3 id="rejected-detail-heading" className="panel-section__title">
          Detalle de Registros Aislados en Rejected_Records_Report (Lote #104)
        </h3>

        <div className="table-responsive" role="region" aria-labelledby="rejected-detail-heading" tabIndex="0">
          <table className="pixel-table">
            <caption className="sr-only">
              Detalle de las 6 filas rechazadas por validación de negocio en el Lote 104
            </caption>
            <thead>
              <tr>
                <th scope="col">Fila Excel</th>
                <th scope="col">ID Persona</th>
                <th scope="col">Instituto</th>
                <th scope="col">Período</th>
                <th scope="col">Campo Inválido</th>
                <th scope="col">Valor Recibido</th>
                <th scope="col">Regla Violada</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_REJECTED_RECORDS.map((r) => (
                <tr key={r.fila_excel}>
                  <th scope="row" className="tabular-nums">Fila {r.fila_excel}</th>
                  <td className="tabular-nums">{r.persona_id}</td>
                  <td>{r.it}</td>
                  <td className="tabular-nums">{r.periodo}</td>
                  <td><code>{r.campo_error}</code></td>
                  <td><code>{r.valor_recibido}</code></td>
                  <td>{r.regla_violada}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
