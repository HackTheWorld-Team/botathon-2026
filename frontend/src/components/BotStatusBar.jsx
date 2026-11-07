import React from 'react'
import {
  PixelBotIcon,
  PixelCheckIcon,
  PixelAlertIcon,
  PixelExcelIcon,
} from './PixelIcons.jsx'
import { downloadRejectedReport } from '../api.js'

/**
 * BotStatusBar.jsx — Material 3 (M3) Compact Assist Chip Bar
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
    <div
      className="m3-bot-assist-group"
      role="group"
      aria-label="Estado operativo del Bot RPA Blue Prism"
    >
      <div className="m3-chip m3-chip--elevated" title={`Lote #${lote.lote_id} (${lote.tipo}) procesado en ${lote.duracion_ms} ms`}>
        <span className="m3-pulse-dot" aria-hidden="true" />
        <PixelBotIcon size={14} />
        <span className="font-bold">RPA #{lote.lote_id}</span>
        <span className="m3-chip__muted">({lote.duracion_ms}ms)</span>
      </div>

      <span className="m3-chip m3-chip--success" title="Registros válidos procesados">
        <PixelCheckIcon size={12} />
        <strong className="tabular-nums">{Number(lote.validos).toLocaleString('es-CL')}</strong>
      </span>

      {hasRejected && (
        <span className="m3-chip m3-chip--error" title="Registros con inconsistencias aislados">
          <PixelAlertIcon size={12} />
          <strong className="tabular-nums">{Number(lote.rechazados).toLocaleString('es-CL')}</strong>
        </span>
      )}

      <button
        type="button"
        className="m3-chip m3-chip--action"
        onClick={() => downloadRejectedReport()}
        aria-label={`Descargar reporte Excel de ${lote.rechazados} registros rechazados del lote ${lote.lote_id}`}
        title="Descargar reporte Excel de rechazos"
      >
        <PixelExcelIcon size={13} />
        <span>.xlsx</span>
      </button>

      {onSelectTab && (
        <button
          type="button"
          className="m3-chip m3-chip--link"
          onClick={() => onSelectTab('lotes')}
          title="Ver trazabilidad completa de corridas RPA"
        >
          <span>Historial →</span>
        </button>
      )}
    </div>
  )
}
