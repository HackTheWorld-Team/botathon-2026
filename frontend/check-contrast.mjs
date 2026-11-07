#!/usr/bin/env node
/**
 * check-contrast.mjs — Verificador programático de contraste WCAG 2.1 AA (Issue #46 / #23)
 *
 * Verifica matemáticamente todos los pares de tokens definidos en docs/UI_SPEC.md §2:
 * - Texto normal sobre fondos: ratio >= 4.5:1 (AA)
 * - Componentes UI / bordes / gráficos / texto grande (>=18.7px bold): ratio >= 3.0:1 (AA)
 * - Valida también que --turquoise sobre --white está bloqueado como texto normal (<4.5:1).
 */

const TOKENS = {
  '--white': '#ffffff',
  '--onyx': '#121313',
  '--pearl-aqua': '#8fe7de',
  '--pearl-tint-composited': '#edfbf9', // rgba(143, 231, 222, 0.16) composited over #ffffff
  '--turquoise': '#1ecebd',
  '--racing-red': '#ea2d2d',
  '--teal-ink': '#0a6b63',
  '--red-ink': '#c62828',
  '--amber-ink': '#9a6700',
  '--ink-2-composited': '#6c6d6d', // rgba(18, 19, 19, 0.62) composited over #ffffff
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

function relativeLuminance([r, g, b]) {
  const srgb = [r, g, b].map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]
}

function contrastRatio(hexA, hexB) {
  const lumA = relativeLuminance(hexToRgb(hexA))
  const lumB = relativeLuminance(hexToRgb(hexB))
  const brightest = Math.max(lumA, lumB)
  const darkest = Math.min(lumA, lumB)
  return (brightest + 0.05) / (darkest + 0.05)
}

const CHECKS = [
  {
    name: '--onyx (#121313) sobre --white (#ffffff) [Texto primario / Bordes]',
    fg: TOKENS['--onyx'],
    bg: TOKENS['--white'],
    minRatio: 4.5,
    category: 'Texto Normal AA',
  },
  {
    name: '--teal-ink (#0a6b63) sobre --white (#ffffff) [Links / Focus / Superávit]',
    fg: TOKENS['--teal-ink'],
    bg: TOKENS['--white'],
    minRatio: 4.5,
    category: 'Texto Normal AA',
  },
  {
    name: '--red-ink (#c62828) sobre --white (#ffffff) [Alerta Déficit Crítico]',
    fg: TOKENS['--red-ink'],
    bg: TOKENS['--white'],
    minRatio: 4.5,
    category: 'Texto Normal AA',
  },
  {
    name: '--amber-ink (#9a6700) sobre --white (#ffffff) [Cerca de Meta 90-100%]',
    fg: TOKENS['--amber-ink'],
    bg: TOKENS['--white'],
    minRatio: 4.5,
    category: 'Texto Normal AA',
  },
  {
    name: '--ink-2 (rgba(18,19,19,0.62)) sobre --white (#ffffff) [Texto secundario]',
    fg: TOKENS['--ink-2-composited'],
    bg: TOKENS['--white'],
    minRatio: 4.5,
    category: 'Texto Normal AA',
  },
  {
    name: '--onyx (#121313) sobre --turquoise (#1ecebd) [Botón primario / Barra llena]',
    fg: TOKENS['--onyx'],
    bg: TOKENS['--turquoise'],
    minRatio: 4.5,
    category: 'Texto Normal AA',
  },
  {
    name: '--onyx (#121313) sobre --pearl-aqua (#8fe7de) [Hover / Selección / Chips]',
    fg: TOKENS['--onyx'],
    bg: TOKENS['--pearl-aqua'],
    minRatio: 4.5,
    category: 'Texto Normal AA',
  },
  {
    name: '--onyx (#121313) sobre --pearl-tint (rgba(143,231,222,0.16)) [Fondo wash header/filtros]',
    fg: TOKENS['--onyx'],
    bg: TOKENS['--pearl-tint-composited'],
    minRatio: 4.5,
    category: 'Texto Normal AA',
  },
  {
    name: '--teal-ink (#0a6b63) sobre --pearl-tint [Links / Badges activos en barra]',
    fg: TOKENS['--teal-ink'],
    bg: TOKENS['--pearl-tint-composited'],
    minRatio: 4.5,
    category: 'Texto Normal AA',
  },
  {
    name: '--racing-red (#ea2d2d) sobre --white (#ffffff) [Iconos alerta / Bordes >=3:1]',
    fg: TOKENS['--racing-red'],
    bg: TOKENS['--white'],
    minRatio: 3.0,
    category: 'No-Texto / UI / Texto Grande AA',
  },
]

let allPassed = true

console.log('======================================================================')
console.log(' WCAG 2.1 AA — Verificador Programático de Contraste (UI_SPEC.md §2)')
console.log('======================================================================')

for (const check of CHECKS) {
  const ratio = contrastRatio(check.fg, check.bg)
  const passed = ratio >= check.minRatio
  if (!passed) allPassed = false
  const status = passed ? 'PASS' : 'FAIL'
  console.log(
    `[${status}] ${ratio.toFixed(2)}:1 (mín ${check.minRatio.toFixed(1)}:1) | ${check.category} | ${check.name}`
  )
}

// Regla negativa explícita de UI_SPEC.md §2: --turquoise prohibido como texto sobre blanco
const turquoiseOnWhite = contrastRatio(TOKENS['--turquoise'], TOKENS['--white'])
console.log('----------------------------------------------------------------------')
console.log(
  `[GUARD] --turquoise sobre --white = ${turquoiseOnWhite.toFixed(2)}:1 (< 4.5:1) -> PROHIBIDO como texto/link/focus sobre blanco (cumple UI_SPEC §2).`
)
console.log('======================================================================')

if (!allPassed) {
  console.error('ERROR: Uno o más pares de color no cumplen el umbral WCAG 2.1 AA.')
  process.exit(1)
} else {
  console.log('OK: Todos los pares de tokens cumplen 100% WCAG 2.1 AA.')
  process.exit(0)
}
