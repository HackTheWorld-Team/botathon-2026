import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  VALID_TABS,
  TAB_META,
  DEFAULT_FILTERS,
  parseHash,
  pushTabHash,
  replaceFiltersHash,
} from './utils/hashRouter.js'
import {
  fetchFiltros,
  fetchKpis,
  fetchPlanVsReal,
  fetchLotes,
  MOCK_FILTROS,
  MOCK_LOTES,
  buildMockKpis,
  buildMockPlanVsReal,
  PERIODO_LABELS,
} from './api.js'
import { BrandStackIcons, TabSimpleIcon } from './components/PixelIcons.jsx'
import BotStatusBar from './components/BotStatusBar.jsx'
import GlobalFilters from './components/GlobalFilters.jsx'
import ResumenView from './views/ResumenView.jsx'
import AntesDespuesView from './views/AntesDespuesView.jsx'
import ParametrosView from './views/ParametrosView.jsx'
import PlanVsRealView from './views/PlanVsRealView.jsx'
import LotesView from './views/LotesView.jsx'

/**
 * App.jsx — Material You (M3) High-Density Dashboard Shell
 *
 * Características:
 * 1. Top App Bar delgada (44px) con marca a la izquierda y Assist Chips de RPA a la derecha
 * 2. M3 Navigation Rail lateral compacto (68px) con píldora activa rounded-full, liberando >200px para datos
 * 3. Lienzo principal de alta densidad con Filtros Globales horizontales compactos y scroll interno
 */
export default function App() {
  const initialRouteRef = useRef(null)
  if (!initialRouteRef.current) {
    initialRouteRef.current = parseHash(
      typeof window !== 'undefined' ? window.location.hash : ''
    )
  }

  const [activeTab, setActiveTab] = useState(initialRouteRef.current.tab)
  const [filters, setFilters] = useState(initialRouteRef.current.filters)

  const [catalogs, setCatalogs] = useState(MOCK_FILTROS)
  const [kpis, setKpis] = useState(() => buildMockKpis(initialRouteRef.current.filters))
  const [planVsReal, setPlanVsReal] = useState(() =>
    buildMockPlanVsReal(initialRouteRef.current.filters)
  )
  const [lotes, setLotes] = useState(MOCK_LOTES)
  const [liveMessage, setLiveMessage] = useState('')
  const [alertMessage, setAlertMessage] = useState('')

  const tabRefs = useRef({})

  useEffect(() => {
    replaceFiltersHash(activeTab, filters)
    const meta = TAB_META[activeTab] || TAB_META.resumen
    const periodoTxt = filters.mes ? PERIODO_LABELS[filters.mes] || filters.mes : 'Anual 2026'
    setLiveMessage(`Vista ${meta.label} cargada, período ${periodoTxt}.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handlePopState() {
      const parsed = parseHash(window.location.hash)
      setActiveTab(parsed.tab)
      setFilters(parsed.filters)
      const meta = TAB_META[parsed.tab] || TAB_META.resumen
      setLiveMessage(`Navegación de historial: vista ${meta.label}.`)
    }

    window.addEventListener('popstate', handlePopState)
    window.addEventListener('hashchange', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('hashchange', handlePopState)
    }
  }, [])

  useEffect(() => {
    let active = true
    fetchFiltros().then((res) => {
      if (active && res) setCatalogs(res)
    })
    fetchLotes().then((res) => {
      if (active && res?.items) setLotes(res.items)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setKpis(buildMockKpis(filters))
    setPlanVsReal(buildMockPlanVsReal(filters))

    fetchKpis(filters).then((data) => {
      if (active && data) setKpis(data)
    })
    fetchPlanVsReal(filters, true).then((res) => {
      if (active && res?.items) setPlanVsReal(res.items)
    })

    return () => {
      active = false
    }
  }, [filters])

  const focusPanelHeading = useCallback((tabId) => {
    const meta = TAB_META[tabId]
    if (!meta) return
    window.requestAnimationFrame(() => {
      const headingEl = document.getElementById(meta.headingId)
      if (headingEl) {
        headingEl.focus({ preventScroll: false })
      }
    })
  }, [])

  const handleSelectTab = useCallback(
    (newTab, moveFocusToHeading = true) => {
      if (!VALID_TABS.includes(newTab)) return
      setActiveTab(newTab)
      pushTabHash(newTab, filters)
      const meta = TAB_META[newTab]
      setLiveMessage(`Pestaña activa: ${meta.label} — ${meta.title}.`)
      if (moveFocusToHeading) {
        focusPanelHeading(newTab)
      }
    },
    [filters, focusPanelHeading]
  )

  const handleChangeFilter = useCallback(
    (key, value) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: value }
        replaceFiltersHash(activeTab, next)
        return next
      })
      const labelMap = {
        instituto: 'Instituto',
        mes: 'Mes/Período',
        area: 'Área clínica',
        cargo: 'Cargo',
        esp: 'Especialidad',
      }
      const displayVal = value || 'Todos'
      setLiveMessage(
        `Filtro ${labelMap[key] || key} actualizado a ${displayVal}. KPIs recalculados.`
      )
    },
    [activeTab]
  )

  const handleResetFilters = useCallback(() => {
    const clean = { ...DEFAULT_FILTERS }
    setFilters(clean)
    replaceFiltersHash(activeTab, clean)
    setLiveMessage(
      'Filtros restablecidos a vista Nacional Teletón (16 Institutos, todos los períodos).'
    )
  }, [activeTab])

  function handleTabKeyDown(e, index) {
    let targetIndex = null
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      targetIndex = (index + 1) % VALID_TABS.length
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      targetIndex = (index - 1 + VALID_TABS.length) % VALID_TABS.length
    } else if (e.key === 'Home') {
      targetIndex = 0
    } else if (e.key === 'End') {
      targetIndex = VALID_TABS.length - 1
    }

    if (targetIndex !== null) {
      e.preventDefault()
      const nextTab = VALID_TABS[targetIndex]
      setActiveTab(nextTab)
      pushTabHash(nextTab, filters)
      const btn = tabRefs.current[nextTab]
      if (btn) btn.focus()
      const meta = TAB_META[nextTab]
      setLiveMessage(`Pestaña seleccionada: ${meta.label}. Presione Enter para ir al panel.`)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      focusPanelHeading(VALID_TABS[index])
    }
  }

  const latestLote = lotes[0] || MOCK_LOTES[0]

  return (
    <div className="m3-app-shell">
      <a className="skip-link" href="#contenido-principal">
        Saltar al contenido principal
      </a>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {alertMessage}
      </div>

      {/* 1. Top App Bar Delgada M3 (44px) */}
      <header className="m3-top-app-bar" role="banner">
        <h1 className="sr-only">
          Teletón · Planificación Asistencial 2026
        </h1>

        <div className="m3-top-app-bar__start">
          <span className="m3-brand-badge">BOTATHON 2026</span>
          <BrandStackIcons size={13} />
          <span className="m3-badge m3-badge--neutral">WCAG 2.1 AA</span>
        </div>

        <div className="m3-top-app-bar__end">
          <BotStatusBar
            latestLote={latestLote}
            onSelectTab={(t) => handleSelectTab(t, true)}
          />
        </div>
      </header>

      {/* 2. Layout Principal: Navigation Rail (68px) + Main Canvas */}
      <div className="m3-workspace-layout">
        {/* Navigation Rail M3 Lateral */}
        <nav
          className="m3-nav-rail"
          aria-label="Navegación principal del dashboard"
        >
          <div role="tablist" aria-label="Secciones del dashboard asistencial" className="m3-nav-rail__list">
            {VALID_TABS.map((tabId, index) => {
              const meta = TAB_META[tabId]
              const isSelected = activeTab === tabId
              return (
                <button
                  key={tabId}
                  ref={(el) => {
                    tabRefs.current[tabId] = el
                  }}
                  id={`tab-${tabId}`}
                  role="tab"
                  type="button"
                  aria-selected={isSelected}
                  aria-controls={`panel-${tabId}`}
                  aria-current={isSelected ? 'page' : undefined}
                  tabIndex={isSelected ? 0 : -1}
                  className={`m3-nav-rail__item ${isSelected ? 'm3-nav-rail__item--active' : ''}`}
                  onClick={() => handleSelectTab(tabId, true)}
                  onKeyDown={(e) => handleTabKeyDown(e, index)}
                  title={meta.title}
                >
                  <span className="m3-nav-rail__indicator">
                    <TabSimpleIcon tabId={tabId} size={18} />
                  </span>
                  <span className="m3-nav-rail__label">{meta.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* Lienzo Principal de Alta Densidad */}
        <div className="m3-main-container">
          {/* Franja de Filtros Globales Horizontales */}
          <GlobalFilters
            filters={filters}
            catalogs={catalogs}
            onChangeFilter={handleChangeFilter}
            onResetFilters={handleResetFilters}
          />

          {/* Área de Visualización Activa con Scroll Interno */}
          <main id="contenido-principal" role="main" className="m3-main-canvas">
            <div
              key={activeTab}
              id={`panel-${activeTab}`}
              role="tabpanel"
              aria-labelledby={`tab-${activeTab}`}
              className="m3-tabpanel-container view-animate-in"
            >
              {activeTab === 'resumen' && (
                <ResumenView
                  kpis={kpis}
                  planVsReal={planVsReal}
                  filters={filters}
                  onChangeFilter={handleChangeFilter}
                  onSelectTab={(t) => handleSelectTab(t, true)}
                />
              )}

              {activeTab === 'antes-despues' && (
                <AntesDespuesView
                  filters={filters}
                  onChangeFilter={handleChangeFilter}
                />
              )}

              {activeTab === 'parametros' && (
                <ParametrosView
                  onAnnounce={(msg) => {
                    setLiveMessage(msg)
                    setAlertMessage('')
                  }}
                />
              )}

              {activeTab === 'plan-vs-real' && (
                <PlanVsRealView
                  planVsReal={planVsReal}
                  filters={filters}
                  onChangeFilter={handleChangeFilter}
                />
              )}

              {activeTab === 'lotes' && <LotesView lotes={lotes} />}
            </div>
          </main>
        </div>
      </div>

      {/* 3. Footer Minimalista */}
      <footer className="m3-footer" role="contentinfo">
        <span>Teletón · Botathon 2026 · Material You High-Density</span>
      </footer>
    </div>
  )
}
