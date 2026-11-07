import React from 'react'
import { PixelFilterIcon, PixelResetIcon } from './PixelIcons.jsx'
import { PERIODO_LABELS } from '../api.js'

/**
 * GlobalFilters.jsx — Barra de filtros multinivel persistente y teclado-first (Issue #25, UI_SPEC.md §5)
 *
 * Jerarquía: Nacional -> Instituto (IT) -> Área -> Cargo -> Especialidad -> Mes/Período
 * - <label> explícito y visible en cada <select>
 * - Tecla Escape sobre cualquier filtro restablece a vista Nacional
 * - Chips activos con doble codificación (etiqueta + valor + botón quitar)
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
    ? `IT ${selectedInstObj.it} · ${selectedInstObj.sigla} (${selectedInstObj.nombre})`
    : 'Red Nacional Teletón (16 Institutos)'

  return (
    <section
      aria-label="Filtros globales multinivel"
      className="global-filters"
      onKeyDown={handleKeyDown}
    >
      <div className="global-filters__header">
        <div className="global-filters__scope">
          <PixelFilterIcon size={16} />
          <span className="global-filters__scope-title">Alcance activo:</span>
          <strong className="global-filters__scope-value">{scopeLabel}</strong>
          {filters.mes && (
            <span className="scope-pill">
              Período: <strong>{PERIODO_LABELS[filters.mes] || filters.mes}</strong>
            </span>
          )}
          {filters.area && (
            <span className="scope-pill">
              Área: <strong>{filters.area}</strong>
            </span>
          )}
          {filters.cargo && (
            <span className="scope-pill">
              Cargo: <strong>{filters.cargo}</strong>
            </span>
          )}
          {filters.esp && (
            <span className="scope-pill">
              Especialidad: <strong>{filters.esp}</strong>
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
            Hito Mayo 2026 (42h)
          </button>
          <button
            type="button"
            className="btn-pixel btn-pixel--secondary btn-pixel--sm"
            onClick={onResetFilters}
            disabled={!hasActiveFilters}
            aria-label="Restablecer todos los filtros a vista Nacional (Atajo: tecla Escape)"
          >
            <PixelResetIcon size={14} />
            <span>Restablecer a Nacional (Esc)</span>
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
            1. Instituto (IT / Sede)
          </label>
          <div className="select-pixel-wrap">
            <select
              id="f-instituto"
              name="instituto"
              value={filters.instituto || ''}
              onChange={(e) => onChangeFilter('instituto', e.target.value)}
            >
              <option value="">Nacional — Todos los Institutos (16)</option>
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
            2. Mes / Período 2026
          </label>
          <div className="select-pixel-wrap">
            <select
              id="f-mes"
              name="mes"
              value={filters.mes || ''}
              onChange={(e) => onChangeFilter('mes', e.target.value)}
            >
              <option value="">Anual consolidado (Ene–Dic 2026)</option>
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
            3. Área Clínica
          </label>
          <div className="select-pixel-wrap">
            <select
              id="f-area"
              name="area"
              value={filters.area || ''}
              onChange={(e) => onChangeFilter('area', e.target.value)}
            >
              <option value="">Todas las áreas clínicas</option>
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
            4. Cargo Contractual
          </label>
          <div className="select-pixel-wrap">
            <select
              id="f-cargo"
              name="cargo"
              value={filters.cargo || ''}
              onChange={(e) => onChangeFilter('cargo', e.target.value)}
            >
              <option value="">Todos los cargos</option>
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
            5. Especialidad (SIC)
          </label>
          <div className="select-pixel-wrap">
            <select
              id="f-esp"
              name="esp"
              value={filters.esp || ''}
              onChange={(e) => onChangeFilter('esp', e.target.value)}
            >
              <option value="">Todas las especialidades</option>
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
