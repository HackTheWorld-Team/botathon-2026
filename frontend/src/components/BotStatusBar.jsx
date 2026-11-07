import React from 'react'
import {
  PixelBotIcon,
  PixelCheckIcon,
  PixelAlertIcon,
  PixelExcelIcon,
} from './PixelIcons.jsx'
import { downloadRejectedReport } from '../api.js'

/**
 * BotStatusBar.jsx — Barra de estado minimalista y centrada del Bot RPA Blue Prism
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
        <span className="bot-badge">
          <span className="bot-pulse-dot" aria-hidden="true" />
          <PixelBotIcon size={14} />
          <strong>RPA #{lote.lote_id}</strong>
          <span className="bot-statusbar__muted">({lote.duracion_ms} ms)</span>
        </span>

        <span className="status-chip status-chip--ok" title="Registros válidos procesados">
          <PixelCheckIcon size={12} />
          <strong className="tabular-nums">{Number(lote.validos).toLocaleString('es-CL')}</strong>
          <span>OK</span>
        </span>

        {hasRejected && (
          <span className="status-chip status-chip--warn" title="Registros rechazados aislados">
            <PixelAlertIcon size={12} />
            <strong className="tabular-nums">{Number(lote.rechazados).toLocaleString('es-CL')}</strong>
            <span>rechazos</span>
          </span>
        )}

        <button
          type="button"
          className="btn-pixel btn-pixel--secondary btn-pixel--sm"
          onClick={() => downloadRejectedReport()}
          aria-label={`Descargar reporte de ${lote.rechazados} registros rechazados del lote ${lote.lote_id}`}
        >
          <PixelExcelIcon size={13} />
          <span>.xlsx</span>
        </button>

        {onSelectTab && (
          <button
            type="button"
            className="btn-link-teal"
            onClick={() => onSelectTab('lotes')}
          >
            Historial →
          </button>
        )}
      </div>
    </section>
  )
}
