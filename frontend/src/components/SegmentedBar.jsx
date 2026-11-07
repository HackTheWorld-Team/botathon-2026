import React from 'react'

/**
 * SegmentedBar.jsx — Barra de progreso pixel-zen de 11 segmentos cuadrados (Issue #24, UI_SPEC.md §4)
 *
 * - 11 segmentos cuadrados (0%, 10%, 20% ... 100% / Superávit >100%)
 * - gap: 4px, border: 2px solid var(--onyx), border-radius: 0
 * - Nunca transmite información solo por color: siempre va acompañada de etiqueta textual explícita.
 */
export default function SegmentedBar({
  valuePct = 0,
  targetPct = 90,
  variant = 'default', // 'default' | 'alert' | 'teal'
  caption = '',
}) {
  const clamped = Math.max(0, Math.min(110, Number(valuePct) || 0))
  // 10 segmentos representan 0..100% (10% c/u); el segmento 11 se enciende en superávit (>100%)
  const filledCount =
    clamped > 100 ? 11 : Math.max(0, Math.min(10, Math.round(clamped / 10)))
  const targetIndex = targetPct ? Math.min(10, Math.round(targetPct / 10)) - 1 : -1

  return (
    <div className="segmented-bar-wrap">
      <div className="segmented-bar" aria-hidden="true">
        {Array.from({ length: 11 }).map((_, idx) => {
          const isFilled = idx < filledCount
          const isSuperavitSlot = idx === 10
          const isTargetSlot = idx === targetIndex

          let segClass = 'segmented-bar__cell'
          if (isFilled) {
            if (isSuperavitSlot) {
              segClass += ' segmented-bar__cell--superavit'
            } else if (variant === 'alert') {
              segClass += ' segmented-bar__cell--alert'
            } else if (variant === 'teal') {
              segClass += ' segmented-bar__cell--teal'
            } else {
              segClass += ' segmented-bar__cell--on'
            }
          } else {
            segClass += ' segmented-bar__cell--off'
          }

          if (isTargetSlot) {
            segClass += ' segmented-bar__cell--target'
          }

          return (
            <span
              key={idx}
              className={segClass}
              title={
                isSuperavitSlot
                  ? 'Tramo >100% (Superávit)'
                  : `Tramo ${(idx + 1) * 10}%`
              }
            />
          )
        })}
      </div>
      {caption && <p className="segmented-bar__caption">{caption}</p>}
    </div>
  )
}

/**
 * StackedHoursBar — Barra de 11 segmentos para desglose proporcional Dir / Ind / NAS
 * Diferencia por luminosidad + patrón + etiqueta directa (UI_SPEC.md §2).
 */
export function StackedHoursBar({ pctDir = 65, pctInd = 15, pctNas = 20 }) {
  const totalSlots = 11
  const dirSlots = Math.max(1, Math.round((pctDir / 100) * totalSlots))
  const indSlots = Math.max(1, Math.round((pctInd / 100) * totalSlots))
  const nasSlots = Math.max(1, totalSlots - dirSlots - indSlots)

  const cells = [
    ...Array(dirSlots).fill('dir'),
    ...Array(indSlots).fill('ind'),
    ...Array(Math.max(0, nasSlots)).fill('nas'),
  ].slice(0, totalSlots)

  return (
    <div className="segmented-bar-wrap">
      <div className="segmented-bar" aria-hidden="true">
        {cells.map((type, idx) => (
          <span
            key={idx}
            className={`segmented-bar__cell segmented-bar__cell--stack-${type}`}
          />
        ))}
      </div>
      <div className="segmented-bar__legend">
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--dir" aria-hidden="true" />
          <span>Directas ({pctDir.toFixed(1)}%)</span>
        </span>
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--ind" aria-hidden="true" />
          <span>Indirectas ({pctInd.toFixed(1)}%)</span>
        </span>
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--nas" aria-hidden="true" />
          <span>NAS ({pctNas.toFixed(1)}%)</span>
        </span>
      </div>
    </div>
  )
}
