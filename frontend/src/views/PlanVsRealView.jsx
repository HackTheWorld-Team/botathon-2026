import React from 'react'
import { PixelStatusBadge } from '../components/PixelIcons.jsx'
import SegmentedBar from '../components/SegmentedBar.jsx'

/**
 * PlanVsRealView.jsx — Cruce Plan Asistencial vs. SIC Real con alertas WCAG 2.1 AA (Issue #27, UI_SPEC.md §6)
 * Heading con tabIndex="-1" para gestión de foco WAI-ARIA Tabs.
 */
export default function PlanVsRealView({ planVsReal = [], filters = {}, onChangeFilter }) {
  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h2 id="panel-heading-plan-vs-real" tabIndex="-1" className="view-title">
            Cumplimiento Asistencial: Planificado vs. Real (SIC)
          </h2>
          <p className="view-subtitle">
            Evaluación de brechas asistenciales frente al Plan Directo (100%) y la Meta de Gestión exigible (90%).
          </p>
        </div>
      </div>

      <section aria-labelledby="pvr-matrix-heading" className="panel-section">
        <h3 id="pvr-matrix-heading" className="panel-section__title">
          Matriz de Desviación y Semáforo de Doble Codificación WCAG
        </h3>

        <div className="table-responsive" role="region" aria-labelledby="pvr-matrix-heading" tabIndex="0">
          <table className="pixel-table">
            <caption className="sr-only">
              Matriz detallada de atenciones planificadas versus reales SIC por especialidad
            </caption>
            <thead>
              <tr>
                <th scope="col">Especialidad</th>
                <th scope="col">Sede / Alcance</th>
                <th scope="col" className="num-col">Plan Directo</th>
                <th scope="col" className="num-col">Meta 90% (MG)</th>
                <th scope="col" className="num-col">Real SIC</th>
                <th scope="col" className="num-col">Desviación %</th>
                <th scope="col">Progreso Visual (0–100%+)</th>
                <th scope="col">Alerta WCAG</th>
              </tr>
            </thead>
            <tbody>
              {planVsReal.map((row, idx) => {
                const desv = Number(row.desviacion_pct || 0)
                const sign = desv > 0 ? '+' : ''
                return (
                  <tr
                    key={`${row.cod_esp}-${row.it || idx}`}
                    className={row.alerta?.nivel === 'CRITICO' ? 'row-critico' : ''}
                  >
                    <th scope="row">
                      <button
                        type="button"
                        className="btn-link-teal"
                        onClick={() =>
                          onChangeFilter &&
                          onChangeFilter('esp', filters.esp === row.cod_esp ? '' : row.cod_esp)
                        }
                      >
                        {row.cod_esp}
                      </button>
                    </th>
                    <td>{row.sigla || 'NAC'}</td>
                    <td className="num-col tabular-nums">
                      {Number(row.plan_directo).toLocaleString('es-CL')}
                    </td>
                    <td className="num-col tabular-nums">
                      {Number(row.meta_gestion).toLocaleString('es-CL')}
                    </td>
                    <td className="num-col tabular-nums font-bold">
                      {Number(row.real_directo).toLocaleString('es-CL')}
                    </td>
                    <td className="num-col tabular-nums">
                      <strong>
                        {sign}
                        {desv.toLocaleString('es-CL')}%
                      </strong>
                    </td>
                    <td style={{ minWidth: '180px' }}>
                      <SegmentedBar
                        valuePct={row.cumplimiento_pct}
                        targetPct={90}
                        variant={row.alerta?.nivel === 'CRITICO' ? 'alert' : 'default'}
                      />
                    </td>
                    <td>
                      <PixelStatusBadge
                        nivel={row.alerta?.nivel}
                        texto={row.alerta?.badge}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
