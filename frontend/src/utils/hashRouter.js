/**
 * hashRouter.js — Deep-link hash router nativo sin librerías (Issue #46, UI_SPEC.md §5)
 *
 * Formato determinista: #/<tab>?instituto=&mes=&cargo=&esp=&area=
 * - Cambio de pestaña -> history.pushState (botón Atrás recorre pestañas)
 * - Cambio de filtro  -> history.replaceState (actualiza URL sin spamear historial)
 * - Hash inválido o vacío -> default silencioso a 'resumen'
 */

export const VALID_TABS = [
  'resumen',
  'antes-despues',
  'parametros',
  'plan-vs-real',
  'lotes',
]

export const TAB_META = {
  resumen: {
    id: 'resumen',
    label: 'Resumen',
    headingId: 'panel-heading-resumen',
    title: 'Resumen Ejecutivo Asistencial',
  },
  'antes-despues': {
    id: 'antes-despues',
    label: 'Antes/Después',
    headingId: 'panel-heading-antes-despues',
    title: 'Comparación Versionada por Delta (Antes vs. Después)',
  },
  parametros: {
    id: 'parametros',
    label: 'Parámetros',
    headingId: 'panel-heading-parametros',
    title: 'Parámetros Clínicos y Simulación sin Código',
  },
  'plan-vs-real': {
    id: 'plan-vs-real',
    label: 'Plan vs Real',
    headingId: 'panel-heading-plan-vs-real',
    title: 'Cumplimiento Asistencial: Planificado vs. Real (SIC)',
  },
  lotes: {
    id: 'lotes',
    label: 'Lotes',
    headingId: 'panel-heading-lotes',
    title: 'Trazabilidad de Lotes RPA Blue Prism y Rechazos',
  },
}

export const DEFAULT_FILTERS = {
  instituto: '',
  mes: '',
  area: '',
  cargo: '',
  esp: '',
}

export function parseHash(hashString = typeof window !== 'undefined' ? window.location.hash : '') {
  const raw = (hashString || '').replace(/^#\/?/, '').trim()
  if (!raw) {
    return {
      tab: 'resumen',
      filters: { ...DEFAULT_FILTERS },
      isValid: false,
    }
  }

  const [pathPart, queryPart = ''] = raw.split('?')
  const cleanTab = (pathPart || '').replace(/\/+$/, '').toLowerCase()
  const isValid = VALID_TABS.includes(cleanTab)
  const tab = isValid ? cleanTab : 'resumen'

  const params = new URLSearchParams(queryPart)
  const filters = {
    instituto: params.get('instituto') || '',
    mes: params.get('mes') || '',
    area: params.get('area') || '',
    cargo: params.get('cargo') || '',
    esp: params.get('esp') || '',
  }

  return { tab, filters, isValid }
}

export function buildHash(tab, filters = DEFAULT_FILTERS) {
  const safeTab = VALID_TABS.includes(tab) ? tab : 'resumen'
  const params = new URLSearchParams()

  if (filters.instituto) params.set('instituto', String(filters.instituto))
  if (filters.mes) params.set('mes', String(filters.mes))
  if (filters.area) params.set('area', String(filters.area))
  if (filters.cargo) params.set('cargo', String(filters.cargo))
  if (filters.esp) params.set('esp', String(filters.esp))

  const qs = params.toString()
  return qs ? `#/${safeTab}?${qs}` : `#/${safeTab}`
}

export function pushTabHash(tab, filters) {
  if (typeof window === 'undefined') return
  const newHash = buildHash(tab, filters)
  if (window.location.hash !== newHash) {
    window.history.pushState(null, '', newHash)
  }
}

export function replaceFiltersHash(tab, filters) {
  if (typeof window === 'undefined') return
  const newHash = buildHash(tab, filters)
  if (window.location.hash !== newHash) {
    window.history.replaceState(null, '', newHash)
  }
}
