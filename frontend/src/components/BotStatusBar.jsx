import React from 'react'
import {
  PixelBotIcon,
  PixelCheckIcon,
  PixelAlertIcon,
  PixelDownloadIcon,
} from './PixelIcons.jsx'
import { downloadRejectedReport } from '../api.js'

/**
 * BotStatusBar.jsx — Barra de estado persistente del Bot RPA Blue Prism (Issue #46, UI_SPEC.md §5)
 *
 * Muestra en todo momento:
 * - Estado operativo del worker/proceso Blue Prism (icono pixel + texto explícito)
 * - Último lote procesado (ID + archivo + timestamp + duración en ms)
 * - Filas válidas vs. filas rechazadas (doble codificación WCAG: icono + etiqueta + conteo)
 * - Acción directa para descargar Rejected_Records_Report y saltar a la pestaña Lotes
 */
export default function BotStatusBar({ latestLote, onSelectTab }) {
  const lote = latestLote || {
    lote_id: 104,
    archivo: 'BUK_Dotacion_Mayo2026_Delta42h.xlsx',
    tipo: 'BUK',
    fecha_corrida: '2026-05-02 08:42:15',
    duracion_ms: 1420,
    validos: 3123,
    rechazados: 6,
  }

  const hasRejected = Number(lote.rechazados) > 0

  return (
    <section
      className="bot-statusbar"
      aria-label="Estado operativo del Bot RPA Blue Prism"
    >
      <div className="bot-statusbar__inner">
        <div className="bot-statusbar__item bot-statusbar__item--primary">
          <span className="bot-badge bot-badge--active">
            <PixelBotIcon size={18} />
            <strong>Bot Blue Prism Operativo</strong>
          </span>
          <span className="bot-statusbar__meta">
            Último lote: <strong>#{lote.lote_id}</strong> ({lote.tipo || 'BUK'}) ·{' '}
            <time dateTime={lote.fecha_corrida}>{lote.fecha_corrida}</time> ·{' '}
            <span className="tabular-nums">{lote.duracion_ms} ms</span>
          </span>
        </div>

        <div className="bot-statusbar__metrics" role="group" aria-label="Conteo de registros del último lote">
          <span className="status-chip status-chip--ok">
            <PixelCheckIcon size={15} />
            <span>
              Válidos: <strong className="tabular-nums">{Number(lote.validos).toLocaleString('es-CL')}</strong> filas
            </span>
          </span>

          {hasRejected ? (
            <span className="status-chip status-chip--warn">
              <PixelAlertIcon size={15} />
              <span>
                Rechazos aislados:{' '}
                <strong className="tabular-nums">{Number(lote.rechazados).toLocaleString('es-CL')}</strong> filas
                (lote no detenido)
              </span>
            </span>
          ) : (
            <span className="status-chip status-chip--ok">
              <PixelCheckIcon size={15} />
              <span>0 rechazos</span>
            </span>
          )}
        </div>

        <div className="bot-statusbar__actions">
          <button
            type="button"
            className="btn-pixel btn-pixel--secondary btn-pixel--sm"
            onClick={() => downloadRejectedReport()}
            aria-label={`Descargar reporte de ${lote.rechazados} registros rechazados del lote ${lote.lote_id} (Rejected_Records_Report)`}
          >
            <PixelDownloadIcon size={15} />
            <span>Rejected_Records_Report ({lote.rechazados})</span>
          </button>

          {onSelectTab && (
            <button
              type="button"
              className="btn-link-teal"
              onClick={() => onSelectTab('lotes')}
            >
              Ver trazabilidad de lotes →
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
