import React from 'react'
import {
  siProbot,
  siPython,
  siFastapi,
  siSqlite,
  siReact,
  siGooglesheets,
  siChartdotjs,
  siAirtable,
  siClockify,
  siCheckmk,
} from 'simple-icons'

/**
 * PixelIcons.jsx — Iconografía unificada en negro (#121313) con integración de Simple Icons
 *
 * Reglas:
 * - Todos los iconos son estrictamente negros (#121313 / var(--onyx))
 * - Simple Icons oficiales para tecnología, hojas de cálculo, gráficos, tablas y bot
 * - Siempre aria-hidden="true" y focusable="false" (acompañado de etiqueta o aria-label)
 */

export function SimpleBrandIcon({ icon, size = 16, className = '' }) {
  if (!icon || !icon.path) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="#121313"
      aria-hidden="true"
      focusable="false"
      className={`pixel-icon simple-icon ${className}`}
    >
      <path d={icon.path} fill="#121313" />
    </svg>
  )
}

export function BrandStackIcons({ size = 14 }) {
  const stack = [
    { icon: siProbot, label: 'RPA Bot' },
    { icon: siPython, label: 'Python' },
    { icon: siFastapi, label: 'FastAPI' },
    { icon: siSqlite, label: 'SQLite' },
    { icon: siReact, label: 'React' },
  ]
  return (
    <span className="brand-stack-icons" aria-label="Stack RPA, Python, FastAPI, SQLite y React">
      {stack.map((item) => (
        <span key={item.label} className="brand-stack-chip" title={item.label}>
          <SimpleBrandIcon icon={item.icon} size={size} />
        </span>
      ))}
    </span>
  )
}

export function TabSimpleIcon({ tabId, size = 15 }) {
  const map = {
    resumen: siChartdotjs,
    'antes-despues': siClockify,
    parametros: siPython,
    'plan-vs-real': siAirtable,
    lotes: siGooglesheets,
  }
  const icon = map[tabId] || siChartdotjs
  return <SimpleBrandIcon icon={icon} size={size} />
}

export function PixelBotIcon({ size = 16, className = '' }) {
  return <SimpleBrandIcon icon={siProbot} size={size} className={className} />
}

export function PixelExcelIcon({ size = 15, className = '' }) {
  return <SimpleBrandIcon icon={siGooglesheets} size={size} className={className} />
}

export function PixelAlertIcon({ size = 15, className = '' }) {
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
      <rect x="7" y="2" width="2" height="2" fill="#121313" />
      <rect x="5" y="4" width="6" height="2" fill="#121313" />
      <rect x="3" y="6" width="10" height="4" fill="#121313" />
      <rect x="1" y="10" width="14" height="4" fill="#121313" />
      <rect x="7" y="5" width="2" height="4" fill="#ffffff" />
      <rect x="7" y="11" width="2" height="2" fill="#ffffff" />
    </svg>
  )
}

export function PixelCheckIcon({ size = 15, className = '' }) {
  return <SimpleBrandIcon icon={siCheckmk} size={size} className={className} />
}

export function PixelTrendUpIcon({ size = 15, className = '' }) {
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
      <rect x="9" y="3" width="5" height="2" fill="#121313" />
      <rect x="12" y="5" width="2" height="4" fill="#121313" />
      <rect x="10" y="5" width="2" height="2" fill="#121313" />
      <rect x="8" y="7" width="2" height="2" fill="#121313" />
      <rect x="6" y="9" width="2" height="2" fill="#121313" />
      <rect x="4" y="7" width="2" height="2" fill="#121313" />
      <rect x="2" y="9" width="2" height="4" fill="#121313" />
    </svg>
  )
}

export function PixelFilterIcon({ size = 15, className = '' }) {
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
      <rect x="1" y="2" width="14" height="2" fill="#121313" />
      <rect x="3" y="4" width="10" height="2" fill="#121313" />
      <rect x="5" y="6" width="6" height="3" fill="#121313" />
      <rect x="7" y="9" width="2" height="5" fill="#121313" />
    </svg>
  )
}

export function PixelResetIcon({ size = 15, className = '' }) {
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
      <rect x="4" y="2" width="8" height="2" fill="#121313" />
      <rect x="2" y="4" width="2" height="4" fill="#121313" />
      <rect x="2" y="2" width="2" height="2" fill="#121313" />
      <rect x="4" y="6" width="2" height="2" fill="#121313" />
      <rect x="12" y="4" width="2" height="8" fill="#121313" />
      <rect x="4" y="12" width="8" height="2" fill="#121313" />
    </svg>
  )
}

export function PixelDownloadIcon({ size = 15, className = '' }) {
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
      <rect x="7" y="2" width="2" height="6" fill="#121313" />
      <rect x="5" y="6" width="6" height="2" fill="#121313" />
      <rect x="7" y="8" width="2" height="2" fill="#121313" />
      <rect x="2" y="12" width="12" height="2" fill="#121313" />
    </svg>
  )
}

export function PixelStatusBadge({ nivel, texto }) {
  if (nivel === 'CRITICO') {
    return (
      <span className="status-badge status-badge--critico">
        <PixelAlertIcon size={14} />
        <span>{texto || 'Déficit'}</span>
      </span>
    )
  }
  if (nivel === 'SUPERAVIT') {
    return (
      <span className="status-badge status-badge--superavit">
        <PixelTrendUpIcon size={14} />
        <span>{texto || 'Superávit'}</span>
      </span>
    )
  }
  return (
    <span className="status-badge status-badge--cumplido">
      <PixelCheckIcon size={14} />
      <span>{texto || 'Cumplido'}</span>
    </span>
  )
}
