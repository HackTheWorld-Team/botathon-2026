import React from 'react'
import { PixelFilterIcon, PixelResetIcon } from './PixelIcons.jsx'
import { PERIODO_LABELS } from '../api.js'

/**
 * GlobalFilters.jsx — High-Density Material 3 (M3) Horizontal Filter Strip
 *
 * Características M3 High Density:
 * - Altura compacta (h-8 / 32px), formato píldora (rounded-full) y elevación plana con outline-variant
 * - Distribución horizontal fluida que no roba espacio vertical al lienzo de datos
 * - Accesible 100% por teclado con atajo Escape para resetear a nivel nacional
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
      aria-label="Filtros globales y alcance de datos"
      className="m3-filter-strip"
      onKeyDown={handleKeyDown}
    >
      <div className="m3-filter-strip__inner">
        {/* Alcance Activo & Quick Actions */}
        <div className="m3-filter-strip__scope-group">
          <span className="m3-chip m3-chip--assist" title="Alcance institucional activo">
            <PixelFilterIcon size={13} />
            <strong className="tabular-nums">{scopeLabel}</strong>
          </span>

          <button
            type="button"
            className={`m3-chip m3-chip--filter ${filters.mes === '2026-05-01' ? 'm3-chip--selected' : ''}`}
            onClick={() => onChangeFilter('mes', filters.mes === '2026-05-01' ? '' : '2026-05-01')}
            aria-pressed={filters.mes === '2026-05-01'}
          >
            <span>Mayo 2026 (42h)</span>
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              className="m3-chip m3-chip--filter m3-chip--reset"
              onClick={onResetFilters}
              aria-label="Restablecer todos los filtros (Esc)"
              title="Restablecer filtros a nivel nacional (Atajo: Escape)"
            >
              <PixelResetIcon size={12} />
              <span>Limpiar (Esc)</span>
            </button>
          )}
        </div>

        {/* Formulario Horizontal con Selects Píldora M3 */}
        <form
          className="m3-filter-strip__selects"
          onSubmit={(e) => e.preventDefault()}
          aria-label="Selectores de filtrado asistencial"
        >
          <div className="m3-select-pill">
            <label htmlFor="f-instituto" className="sr-only">
              Instituto
            </label>
            <select
              id="f-instituto"
              name="instituto"
              value={filters.instituto || ''}
              onChange={(e) => onChangeFilter('instituto', e.target.value)}
              title="Filtrar por Instituto"
            >
              <option value="">Sede: Todas (16)</option>
              {institutos.map((inst) => (
                <option key={inst.it} value={String(inst.it)}>
                  IT {inst.it} · {inst.sigla} ({inst.nombre})
                </option>
              ))}
            </select>
          </div>

          <div className="m3-select-pill">
            <label htmlFor="f-mes" className="sr-only">
              Período
            </label>
            <select
              id="f-mes"
              name="mes"
              value={filters.mes || ''}
              onChange={(e) => onChangeFilter('mes', e.target.value)}
              title="Filtrar por Mes / Período"
            >
              <option value="">Mes: Anual 2026</option>
              {periodos.map((per) => (
                <option key={per} value={per}>
                  {PERIODO_LABELS[per] || per}
                </option>
              ))}
            </select>
          </div>

          <div className="m3-select-pill">
            <label htmlFor="f-area" className="sr-only">
              Área Clínica
            </label>
            <select
              id="f-area"
              name="area"
              value={filters.area || ''}
              onChange={(e) => onChangeFilter('area', e.target.value)}
              title="Filtrar por Área Clínica"
            >
              <option value="">Área: Todas</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          <div className="m3-select-pill">
            <label htmlFor="f-cargo" className="sr-only">
              Cargo
            </label>
            <select
              id="f-cargo"
              name="cargo"
              value={filters.cargo || ''}
              onChange={(e) => onChangeFilter('cargo', e.target.value)}
              title="Filtrar por Cargo"
            >
              <option value="">Cargo: Todos</option>
              {cargos.map((cargo) => (
                <option key={cargo} value={cargo}>
                  {cargo}
                </option>
              ))}
            </select>
          </div>

          <div className="m3-select-pill">
            <label htmlFor="f-esp" className="sr-only">
              Especialidad
            </label>
            <select
              id="f-esp"
              name="esp"
              value={filters.esp || ''}
              onChange={(e) => onChangeFilter('esp', e.target.value)}
              title="Filtrar por Especialidad SIC"
            >
              <option value="">Esp: Todas</option>
              {especialidades.map((esp) => (
                <option key={esp} value={esp}>
                  {esp}
                </option>
              ))}
            </select>
          </div>
        </form>
      </div>
    </section>
  )
}
