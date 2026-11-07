import React from 'react'

/**
 * PixelIcons.jsx — Iconografía pixel-art SVG geométrica (UI_SPEC.md §4)
 *
 * Reglas:
 * - shape-rendering="crispEdges" para geometría nítida sin blur
 * - Siempre aria-hidden="true" y focusable="false" (acompañado de texto visible)
 */

export function PixelBotIcon({ size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={`pixel-icon ${className}`}
    >
      <rect x="7" y="1" width="2" height="2" fill="currentColor" />
      <rect x="3" y="3" width="10" height="10" fill="currentColor" />
      <rect x="5" y="5" width="2" height="2" fill="#ffffff" />
      <rect x="9" y="5" width="2" height="2" fill="#ffffff" />
      <rect x="5" y="9" width="6" height="2" fill="#ffffff" />
      <rect x="1" y="6" width="2" height="4" fill="currentColor" />
      <rect x="13" y="6" width="2" height="4" fill="currentColor" />
    </svg>
  )
}

export function PixelAlertIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={`pixel-icon ${className}`}
    >
      <rect x="7" y="2" width="2" height="2" fill="currentColor" />
      <rect x="5" y="4" width="6" height="2" fill="currentColor" />
      <rect x="3" y="6" width="10" height="4" fill="currentColor" />
      <rect x="1" y="10" width="14" height="4" fill="currentColor" />
      <rect x="7" y="5" width="2" height="4" fill="#ffffff" />
      <rect x="7" y="11" width="2" height="2" fill="#ffffff" />
    </svg>
  )
}

export function PixelCheckIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={`pixel-icon ${className}`}
    >
      <rect x="2" y="2" width="12" height="12" fill="currentColor" />
      <rect x="11" y="5" width="2" height="2" fill="#ffffff" />
      <rect x="9" y="7" width="2" height="2" fill="#ffffff" />
      <rect x="7" y="9" width="2" height="2" fill="#ffffff" />
      <rect x="5" y="7" width="2" height="2" fill="#ffffff" />
      <rect x="3" y="5" width="2" height="2" fill="currentColor" />
    </svg>
  )
}

export function PixelTrendUpIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={`pixel-icon ${className}`}
    >
      <rect x="9" y="3" width="5" height="2" fill="currentColor" />
      <rect x="12" y="5" width="2" height="4" fill="currentColor" />
      <rect x="10" y="5" width="2" height="2" fill="currentColor" />
      <rect x="8" y="7" width="2" height="2" fill="currentColor" />
      <rect x="6" y="9" width="2" height="2" fill="currentColor" />
      <rect x="4" y="7" width="2" height="2" fill="currentColor" />
      <rect x="2" y="9" width="2" height="4" fill="currentColor" />
    </svg>
  )
}

export function PixelFilterIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={`pixel-icon ${className}`}
    >
      <rect x="1" y="2" width="14" height="2" fill="currentColor" />
      <rect x="3" y="4" width="10" height="2" fill="currentColor" />
      <rect x="5" y="6" width="6" height="3" fill="currentColor" />
      <rect x="7" y="9" width="2" height="5" fill="currentColor" />
    </svg>
  )
}

export function PixelResetIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={`pixel-icon ${className}`}
    >
      <rect x="4" y="2" width="8" height="2" fill="currentColor" />
      <rect x="2" y="4" width="2" height="4" fill="currentColor" />
      <rect x="2" y="2" width="2" height="2" fill="currentColor" />
      <rect x="4" y="6" width="2" height="2" fill="currentColor" />
      <rect x="12" y="4" width="2" height="8" fill="currentColor" />
      <rect x="4" y="12" width="8" height="2" fill="currentColor" />
    </svg>
  )
}

export function PixelDownloadIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={`pixel-icon ${className}`}
    >
      <rect x="7" y="2" width="2" height="6" fill="currentColor" />
      <rect x="5" y="6" width="6" height="2" fill="currentColor" />
      <rect x="7" y="8" width="2" height="2" fill="currentColor" />
      <rect x="2" y="12" width="12" height="2" fill="currentColor" />
    </svg>
  )
}

export function PixelStatusBadge({ nivel, texto }) {
  if (nivel === 'CRITICO') {
    return (
      <span className="status-badge status-badge--critico">
        <PixelAlertIcon size={15} />
        <span>{texto || 'Déficit Crítico'}</span>
      </span>
    )
  }
  if (nivel === 'SUPERAVIT') {
    return (
      <span className="status-badge status-badge--superavit">
        <PixelTrendUpIcon size={15} />
        <span>{texto || 'Superávit'}</span>
      </span>
    )
  }
  return (
    <span className="status-badge status-badge--cumplido">
      <PixelCheckIcon size={15} />
      <span>{texto || 'Meta Cumplida'}</span>
    </span>
  )
}
