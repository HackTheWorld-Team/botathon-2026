import React from 'react'
import { PixelCheckIcon, PixelTrendUpIcon, PixelAlertIcon } from '../components/PixelIcons.jsx'

/**
 * AntesDespuesView.jsx — Comparación versionada por delta (Lote Base vs. Lote Mayo 42h)
 * Heading con tabIndex="-1" para gestión de foco WAI-ARIA Tabs (UI_SPEC.md §5).
 */
export default function AntesDespuesView({ onChangeFilter }) {
  const DELTAS = [
    {
      caso: 'Transición Ley 42h (General Nacional)',
      persona_id: 'Red Nacional (298 prof.)',
      sede: '16 Institutos Teletón',
      antes: '43,0 h/sem (Ene–Abr 2026 CONGELADO)',
      despues: '42,0 h/sem (May–Dic 2026 RECALCULADO)',
      impacto_plan: '−2,32% horas desde mayo; Ene–Abr intactos (0 diffs retroactivos)',
      estado: 'CUMPLIDO',
      etiqueta: 'Vigencia Prospectiva OK',
    },
    {
      caso: 'Profesional Multi-Sede (Suma combinada)',
      persona_id: 'ID #125129',
      sede: 'IT 201 Antofagasta + IT 202 Calama',
      antes: '22,0 h (ANT) + 21,0 h (CAL) = 43,0 h',
      despues: '22,0 h (ANT) + 20,0 h (CAL) = 42,0 h',
      impacto_plan: 'Tramo asignado por suma inter-sede (42h), desglose independiente por IT',
      estado: 'SUPERAVIT',
      etiqueta: 'Multi-Sede Validado',
    },
    {
      caso: 'Nueva Contratación Alta Mayo 2026',
      persona_id: 'ID #141845',
      sede: 'IT 1301 Santiago (Kinesiología)',
      antes: '0,0 h (Sin contrato Ene–Abr)',
      despues: '42,0 h/sem desde 2026-05-01',
      impacto_plan: '+112 atenciones directas/mes y +100 MG (90%) desde mayo',
      estado: 'SUPERAVIT',
      etiqueta: 'Alta Incorporada',
    },
  ]

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h2 id="panel-heading-antes-despues" tabIndex="-1" className="view-title">
            Comparación Versionada por Delta (Antes vs. Después)
          </h2>
          <p className="view-subtitle">
            Auditoría del Lote #102 (Base 43h) frente al Lote #104 (Delta Mayo 42h): meses pasados congelados y recálculo prospectivo automático.
          </p>
        </div>
        {onChangeFilter && (
          <button
            type="button"
            className="btn-pixel btn-pixel--primary"
            onClick={() => onChangeFilter('mes', '2026-05-01')}
          >
            Fijar filtro en Mayo 2026 (42h)
          </button>
        )}
      </div>

      <section aria-labelledby="delta-table-heading" className="panel-section">
        <h3 id="delta-table-heading" className="panel-section__title">
          Hitos de Cambio Detectados por el Bot Blue Prism (Mayo 2026)
        </h3>
        <div className="table-responsive" role="region" aria-labelledby="delta-table-heading" tabIndex="0">
          <table className="pixel-table">
            <caption className="sr-only">
              Comparativa Antes y Después de contratos e impacto asistencial en mayo 2026
            </caption>
            <thead>
              <tr>
                <th scope="col">Caso / Regla Auditada</th>
                <th scope="col">Profesional / Alcance</th>
                <th scope="col">Instituto (IT)</th>
                <th scope="col">Antes (Lote #102)</th>
                <th scope="col">Después (Lote #104)</th>
                <th scope="col">Impacto en Planificación</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {DELTAS.map((d) => (
                <tr key={d.caso}>
                  <th scope="row">{d.caso}</th>
                  <td className="tabular-nums"><strong>{d.persona_id}</strong></td>
                  <td>{d.sede}</td>
                  <td className="tabular-nums">{d.antes}</td>
                  <td className="tabular-nums"><strong>{d.despues}</strong></td>
                  <td>{d.impacto_plan}</td>
                  <td>
                    <span className="status-badge status-badge--cumplido">
                      {d.estado === 'SUPERAVIT' ? <PixelTrendUpIcon size={14} /> : <PixelCheckIcon size={14} />}
                      <span>{d.etiqueta}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
