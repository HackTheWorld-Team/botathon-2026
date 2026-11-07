import React, { useState } from 'react'
import { PixelCheckIcon } from '../components/PixelIcons.jsx'

/**
 * ParametrosView.jsx — Vista de edición de parámetros clínicos sin tocar código (UI_SPEC.md §6)
 * Heading con tabIndex="-1" para gestión de foco WAI-ARIA Tabs.
 */
export default function ParametrosView({ onAnnounce }) {
  const [pctDir, setPctDir] = useState(65)
  const [pctInd, setPctInd] = useState(15)
  const [minAte, setMinAte] = useState(40)
  const [vigencia, setVigencia] = useState('2026-05-01')
  const [voboDmn, setVoboDmn] = useState(true)

  const pctNas = Math.max(0, 100 - Number(pctDir) - Number(pctInd))

  function handleSimulate(e) {
    e.preventDefault()
    if (onAnnounce) {
      onAnnounce(
        `Parámetros clínicos actualizados desde ${vigencia}: ${pctDir}% Directo, ${pctInd}% Indirecto, ${pctNas}% NAS, ${minAte} min por atención.`
      )
    }
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h2 id="panel-heading-parametros" tabIndex="-1" className="view-title">
            Parámetros Clínicos y Simulación sin Código
          </h2>
          <p className="view-subtitle">
            Configuración de distribución porcentual (% Directo / Indirecto / NAS), minutos estándar por atención y asignaciones especiales con V°B° DMN.
          </p>
        </div>
      </div>

      <section aria-labelledby="param-form-heading" className="panel-section">
        <h3 id="param-form-heading" className="panel-section__title">
          Reglas de Distribución Horaria y Rendimiento por Tramo
        </h3>

        <form onSubmit={handleSimulate} className="param-form">
          <div className="global-filters__grid">
            <div className="filter-field">
              <label htmlFor="p-dir" className="filter-label">
                % Horas Directas (Box)
              </label>
              <input
                id="p-dir"
                type="number"
                min="10"
                max="90"
                className="input-pixel tabular-nums"
                value={pctDir}
                onChange={(e) => setPctDir(Number(e.target.value))}
              />
            </div>

            <div className="filter-field">
              <label htmlFor="p-ind" className="filter-label">
                % Horas Indirectas
              </label>
              <input
                id="p-ind"
                type="number"
                min="0"
                max="50"
                className="input-pixel tabular-nums"
                value={pctInd}
                onChange={(e) => setPctInd(Number(e.target.value))}
              />
            </div>

            <div className="filter-field">
              <label htmlFor="p-nas" className="filter-label">
                % No Asistencial (NAS calculado)
              </label>
              <input
                id="p-nas"
                type="number"
                readOnly
                className="input-pixel tabular-nums"
                value={pctNas}
              />
            </div>

            <div className="filter-field">
              <label htmlFor="p-min" className="filter-label">
                Minutos por Atención Estándar
              </label>
              <input
                id="p-min"
                type="number"
                min="15"
                max="120"
                step="5"
                className="input-pixel tabular-nums"
                value={minAte}
                onChange={(e) => setMinAte(Number(e.target.value))}
              />
            </div>

            <div className="filter-field">
              <label htmlFor="p-vig" className="filter-label">
                Vigencia Prospectiva (Desde)
              </label>
              <div className="select-pixel-wrap">
                <select
                  id="p-vig"
                  value={vigencia}
                  onChange={(e) => setVigencia(e.target.value)}
                >
                  <option value="2026-05-01">Mayo 2026 (2026-05-01)</option>
                  <option value="2026-06-01">Junio 2026 (2026-06-01)</option>
                  <option value="2026-07-01">Julio 2026 (2026-07-01)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="param-form__footer">
            <label className="checkbox-pixel">
              <input
                type="checkbox"
                checked={voboDmn}
                onChange={(e) => setVoboDmn(e.target.checked)}
              />
              <span>Aplicar descuento de Asignaciones Especiales solo con flag V°B° DMN activo (Duda 2)</span>
            </label>

            <button type="submit" className="btn-pixel btn-pixel--primary">
              <PixelCheckIcon size={15} />
              <span>Recalcular Proyección desde {vigencia}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
