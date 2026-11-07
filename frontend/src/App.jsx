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
 * App.jsx — Layout One-Page de Dos Columnas (Sidebar Izquierdo: Filtros/Categorías + Centro/Derecha: Datos Estilo Excel Redondeado)
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
    if (e.key === 'ArrowRight') {
      targetIndex = (index + 1) % VALID_TABS.length
    } else if (e.key === 'ArrowLeft') {
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
      setLiveMessage(`Pestaña seleccionada: ${meta.label}. Presione Enter o Tab para ir al panel.`)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      focusPanelHeading(VALID_TABS[index])
    }
  }

  const latestLote = lotes[0] || MOCK_LOTES[0]

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenido-principal">
        Saltar al contenido principal
      </a>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {alertMessage}
      </div>

      {/* Header Simplificado en Una Sola Fila (Izquierda: Marca/Stack · Derecha: Pestañas) */}
      <header className="app-header" role="banner">
        <h1 className="sr-only">
          Teletón · Planificación Asistencial 2026
        </h1>
        <div className="app-header__top">
          <div className="brand-row">
            <span className="brand-tag">BOTATHON 2026</span>
            <BrandStackIcons size={14} />
            <span className="header-meta__badge">WCAG 2.1 AA</span>
          </div>

          <nav aria-label="Vistas principales del sistema" className="tabs-nav">
            <div role="tablist" aria-label="Secciones del dashboard asistencial" className="tablist">
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
                    className={`tab-btn ${isSelected ? 'tab-btn--active' : ''}`}
                    onClick={() => handleSelectTab(tabId, true)}
                    onKeyDown={(e) => handleTabKeyDown(e, index)}
                  >
                    <TabSimpleIcon tabId={tabId} size={14} />
                    <span className="tab-btn__label">{meta.label}</span>
                  </button>
                )
              })}
            </div>
          </nav>
        </div>
      </header>

      {/* Cuerpo Principal en Dos Columnas: Izquierda (Categorías, Global Filter Headers, Filtros y RPA) · Centro/Derecha (Lista y Datos Foco Principal) */}
      <div className="app-workspace">
        <aside className="app-sidebar" aria-label="Categorías, filtros globales y estado RPA">
          <GlobalFilters
            filters={filters}
            catalogs={catalogs}
            onChangeFilter={handleChangeFilter}
            onResetFilters={handleResetFilters}
          />
          <BotStatusBar
            latestLote={latestLote}
            onSelectTab={(t) => handleSelectTab(t, true)}
          />
        </aside>

        <main id="contenido-principal" role="main" className="app-main">
          <div
            key={activeTab}
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            className="tabpanel-box view-animate-in"
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

      <footer className="app-footer" role="contentinfo">
        <span>Teletón · Botathon 2026</span>
      </footer>
    </div>
  )
}
