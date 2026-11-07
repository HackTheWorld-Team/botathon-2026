import React from 'react'
import { PixelFilterIcon, PixelResetIcon } from './PixelIcons.jsx'
import { PERIODO_LABELS } from '../api.js'

/**
 * GlobalFilters.jsx — Panel lateral izquierdo de categorías, alcance activo (global-filters__header) y filtros multinivel
 */
export default function GlobalFilters({
  filters,
  catalogs,
  onChangeFilter,
  onResetFilters,
}) {
  const {
    institutos = [],
    periodos = [],
    areas = [],
    cargos = [],
    especialidades = [],
  } = catalogs || {}

  const hasActiveFilters = Boolean(
    filters.instituto || filters.mes || filters.area || filters.cargo || filters.esp
  )

  function handleKeyDown(e) {
    if (e.key === 'Escape' && hasActiveFilters) {
      e.preventDefault()
      onResetFilters()
    }
  }

  const selectedInstObj = institutos.find((i) => String(i.it) === String(filters.instituto))
  const scopeLabel = selectedInstObj
    ? `IT ${selectedInstObj.it} · ${selectedInstObj.sigla}`
    : 'Red Nacional (16 Sedes)'

  return (
    <section
      aria-label="Filtros globales multinivel"
      className="global-filters"
      onKeyDown={handleKeyDown}
    >
      <div className="global-filters__header">
        <div className="global-filters__scope">
          <PixelFilterIcon size={14} />
          <span className="global-filters__scope-title">Filtros y Categorías</span>
        </div>

        <div className="global-filters__active-summary">
          <strong className="global-filters__scope-value">{scopeLabel}</strong>
          {filters.mes && (
            <span className="scope-pill">
              <strong>{PERIODO_LABELS[filters.mes] || filters.mes}</strong>
            </span>
          )}
          {filters.area && (
            <span className="scope-pill">
              <strong>{filters.area}</strong>
            </span>
          )}
          {filters.cargo && (
            <span className="scope-pill">
              <strong>{filters.cargo}</strong>
            </span>
          )}
          {filters.esp && (
            <span className="scope-pill">
              <strong>{filters.esp}</strong>
            </span>
          )}
        </div>

        <div className="global-filters__quick">
          <button
            type="button"
            className="btn-pixel btn-pixel--ghost btn-pixel--sm"
            onClick={() => onChangeFilter('mes', '2026-05-01')}
            aria-pressed={filters.mes === '2026-05-01'}
          >
            Mayo 2026 (42h)
          </button>
          <button
            type="button"
            className="btn-pixel btn-pixel--secondary btn-pixel--sm"
            onClick={onResetFilters}
            disabled={!hasActiveFilters}
            aria-label="Restablecer todos los filtros a vista Nacional (Atajo: tecla Escape)"
          >
            <PixelResetIcon size={12} />
            <span>Limpiar (Esc)</span>
          </button>
        </div>
      </div>

      <form
        className="global-filters__grid"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Selectores de filtro asistencial"
      >
        <div className="filter-field">
          <label htmlFor="f-instituto" className="filter-label">
            Instituto (IT)
          </label>
          <div className="select-pixel-wrap">
            <select
              id="f-instituto"
              name="instituto"
              value={filters.instituto || ''}
              onChange={(e) => onChangeFilter('instituto', e.target.value)}
            >
              <option value="">Nacional (16)</option>
              {institutos.map((inst) => (
                <option key={inst.it} value={String(inst.it)}>
                  IT {inst.it} · {inst.sigla} — {inst.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-field">
          <label htmlFor="f-mes" className="filter-label">
            Período
          </label>
          <div className="select-pixel-wrap">
            <select
              id="f-mes"
              name="mes"
              value={filters.mes || ''}
              onChange={(e) => onChangeFilter('mes', e.target.value)}
            >
              <option value="">Anual 2026</option>
              {periodos.map((per) => (
                <option key={per} value={per}>
                  {PERIODO_LABELS[per] || per}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-field">
          <label htmlFor="f-area" className="filter-label">
            Área Clínica
          </label>
          <div className="select-pixel-wrap">
            <select
              id="f-area"
              name="area"
              value={filters.area || ''}
              onChange={(e) => onChangeFilter('area', e.target.value)}
            >
              <option value="">Todas</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-field">
          <label htmlFor="f-cargo" className="filter-label">
            Cargo
          </label>
          <div className="select-pixel-wrap">
            <select
              id="f-cargo"
              name="cargo"
              value={filters.cargo || ''}
              onChange={(e) => onChangeFilter('cargo', e.target.value)}
            >
              <option value="">Todos</option>
              {cargos.map((cargo) => (
                <option key={cargo} value={cargo}>
                  {cargo}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-field">
          <label htmlFor="f-esp" className="filter-label">
            Especialidad
          </label>
          <div className="select-pixel-wrap">
            <select
              id="f-esp"
              name="esp"
              value={filters.esp || ''}
              onChange={(e) => onChangeFilter('esp', e.target.value)}
            >
              <option value="">Todas</option>
              {especialidades.map((esp) => (
                <option key={esp} value={esp}>
                  {esp}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>
    </section>
  )
}
