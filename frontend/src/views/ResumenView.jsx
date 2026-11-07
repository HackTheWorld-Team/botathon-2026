import React from 'react'
import SegmentedBar, { StackedHoursBar } from '../components/SegmentedBar.jsx'
import {
  PixelCheckIcon,
  PixelAlertIcon,
  PixelTrendUpIcon,
  PixelStatusBadge,
  PixelExcelIcon,
} from '../components/PixelIcons.jsx'

/**
 * ResumenView.jsx — Vista General Material You (M3) de Alta Densidad
 *
 * Características:
 * - KPI Strip horizontal compacto superior (grid 4 columnas, padding p-3, altura ~80px)
 * - Canvas de datos estilo Excel / Sheet que ocupa >80% del viewport vertical restante
 * - Tarjetas rounded-xl / rounded-2xl y chips rounded-full
 */
export default function ResumenView({
  kpis,
  planVsReal = [],
  filters = {},
  onChangeFilter,
  onSelectTab,
}) {
  const hCont = Number(kpis?.horas_contratadas_semanales || 0)
  const hDir = Number(kpis?.horas_directas_semanales || 0)
  const hInd = Number(kpis?.horas_indirectas_semanales || 0)
  const hNas = Number(kpis?.horas_nas_semanales || 0)
  const fojaPct = Number(kpis?.foja_pct || 0)

  const pctDir = hCont > 0 ? (hDir / hCont) * 100 : 65.2
  const pctInd = hCont > 0 ? (hInd / hCont) * 100 : 14.8
  const pctNas = hCont > 0 ? (hNas / hCont) * 100 : 20.0

  const planDirecto = Number(kpis?.plan_directo_mensual || 0)
  const planIndirecto = Number(kpis?.plan_indirecto_mensual || 0)
  const planTotal = Number(kpis?.plan_total_mensual || planDirecto + planIndirecto)
  const metaGestion = Number(kpis?.meta_gestion_mensual || 0)
  const totalProf = Number(kpis?.total_profesionales || 0)
  const totalContratos = Number(kpis?.total_contratos || 0)

  const sumReal = planVsReal.reduce((acc, r) => acc + Number(r.real_directo || 0), 0)
  const sumPlan = planVsReal.reduce((acc, r) => acc + Number(r.plan_directo || 0), 0)
  const globalCumplimientoPct =
    sumPlan > 0 ? Number(((sumReal / sumPlan) * 100).toFixed(1)) : 91.8

  const criticosCount = planVsReal.filter((r) => r.alerta?.nivel === 'CRITICO').length

  return (
    <div className="m3-view-stack">
      <h2 id="panel-heading-resumen" tabIndex="-1" className="sr-only">
        Resumen Ejecutivo Asistencial
      </h2>

      {/* 1. KPI Strip Horizontal Superior (Material 3 High Density Strip) */}
      <section
        aria-label="Indicadores ejecutivos clave"
        className="m3-kpi-strip"
      >
        {/* KPI 01: % FOJA */}
        <article className="m3-kpi-card" aria-labelledby="kpi-foja-title">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label" id="kpi-foja-title">
              % FOJA (Ocupación)
            </span>
            <span className="m3-badge m3-badge--teal">≥65% Ref</span>
          </div>
          <div className="m3-kpi-card__body">
            <p className="m3-kpi-card__metric tabular-nums">
              {fojaPct.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
            </p>
            <span className="m3-kpi-card__sub tabular-nums">
              {hDir.toLocaleString('es-CL', { maximumFractionDigits: 0 })}h / {hCont.toLocaleString('es-CL', { maximumFractionDigits: 0 })}h
            </span>
          </div>
          <SegmentedBar
            valuePct={fojaPct}
            targetPct={70}
            variant="teal"
          />
        </article>

        {/* KPI 02: Meta de Gestión 90% */}
        <article className="m3-kpi-card" aria-labelledby="kpi-mg-title">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label" id="kpi-mg-title">
              Meta Gestión 90%
            </span>
            <span className="m3-badge m3-badge--secondary">
              Real {globalCumplimientoPct.toLocaleString('es-CL')}%
            </span>
          </div>
          <div className="m3-kpi-card__body">
            <p className="m3-kpi-card__metric tabular-nums">
              {metaGestion.toLocaleString('es-CL')}
            </p>
            <span className="m3-kpi-card__sub">
              <code>⌊{planDirecto.toLocaleString('es-CL')} × 0,90⌋</code>
            </span>
          </div>
          <SegmentedBar
            valuePct={globalCumplimientoPct}
            targetPct={90}
            variant={globalCumplimientoPct < 90 ? 'alert' : 'default'}
          />
        </article>

        {/* KPI 03: Plan Total */}
        <article className="m3-kpi-card" aria-labelledby="kpi-plan-title">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label" id="kpi-plan-title">
              Plan Total Proyectado
            </span>
            <span className="m3-badge m3-badge--neutral">
              {totalProf.toLocaleString('es-CL')} prof.
            </span>
          </div>
          <div className="m3-kpi-card__body">
            <p className="m3-kpi-card__metric tabular-nums">
              {planTotal.toLocaleString('es-CL')}
            </p>
            <span className="m3-kpi-card__sub tabular-nums">
              Dir {planDirecto.toLocaleString('es-CL')} · Ind {planIndirecto.toLocaleString('es-CL')}
            </span>
          </div>
          <div className="m3-kpi-card__chip-row tabular-nums">
            <span className="m3-metric-chip">Directas: {planDirecto.toLocaleString('es-CL')}</span>
            <span className="m3-metric-chip">Indirectas: {planIndirecto.toLocaleString('es-CL')}</span>
          </div>
        </article>

        {/* KPI 04: Jornada Semanal */}
        <article className="m3-kpi-card" aria-labelledby="kpi-jornada-title">
          <div className="m3-kpi-card__header">
            <span className="m3-kpi-card__label" id="kpi-jornada-title">
              Jornada Semanal Red
            </span>
            <span className="m3-badge m3-badge--teal">100%</span>
          </div>
          <div className="m3-kpi-card__body">
            <p className="m3-kpi-card__metric tabular-nums">
              {hCont.toLocaleString('es-CL', { maximumFractionDigits: 1 })} h
            </p>
            <span className="m3-kpi-card__sub tabular-nums">
              Dir {hDir.toLocaleString('es-CL', { maximumFractionDigits: 0 })}h · Ind {hInd.toLocaleString('es-CL', { maximumFractionDigits: 0 })}h
            </span>
          </div>
          <StackedHoursBar pctDir={pctDir} pctInd={pctInd} pctNas={pctNas} />
        </article>
      </section>

      {/* 2. Canvas Principal: Hoja de Datos Asistencial M3 (>80% del Viewport) */}
      <section
        aria-labelledby="resumen-sheet-heading"
        className="m3-sheet-card"
      >
        <div className="m3-sheet-card__toolbar">
          <div className="m3-sheet-card__title-box">
            <PixelExcelIcon size={16} />
            <h3 id="resumen-sheet-heading" className="m3-sheet-card__title">
              Planilla Asistencial: Plan Directo vs. Real SIC
            </h3>
            <span className="m3-badge m3-badge--neutral">
              {planVsReal.length} registros
            </span>
          </div>

          <div className="m3-sheet-card__actions">
            <span className="m3-chip m3-chip--success" title="Dotación activa de profesionales">
              <PixelCheckIcon size={12} />
              <strong className="tabular-nums">{totalProf.toLocaleString('es-CL')}</strong> prof. ({totalContratos.toLocaleString('es-CL')} ctos.)
            </span>

            {criticosCount > 0 && (
              <span className="m3-chip m3-chip--error" title="Especialidades por debajo de la Meta de Gestión 90%">
                <PixelAlertIcon size={12} />
                <strong className="tabular-nums">{criticosCount}</strong> bajo MG 90%
              </span>
            )}

            {onSelectTab && (
              <button
                type="button"
                className="m3-btn m3-btn--primary m3-btn--sm"
                onClick={() => onSelectTab('plan-vs-real')}
              >
                Matriz Completa →
              </button>
            )}
          </div>
        </div>

        {/* Tabla Densificada con Cabecera Sticky y Scroll Interno */}
        <div
          className="m3-table-viewport"
          role="region"
          aria-labelledby="resumen-sheet-heading"
          tabIndex="0"
        >
          <table className="m3-data-table">
            <caption className="sr-only">
              Tabla de cumplimiento asistencial comparando Plan Directo, Meta de Gestión 90% y Atenciones Reales SIC
            </caption>
            <thead>
              <tr>
                <th scope="col" className="m3-col-rowidx">#</th>
                <th scope="col">Especialidad</th>
                <th scope="col" className="m3-col-num">Plan Directo</th>
                <th scope="col" className="m3-col-num">Meta (90%)</th>
                <th scope="col" className="m3-col-num">Real (SIC)</th>
                <th scope="col" className="m3-col-num">% Cumpl.</th>
                <th scope="col">Estado WCAG</th>
                <th scope="col">Acción</th>
              </tr>
            </thead>
            <tbody>
              {planVsReal.map((row, idx) => {
                const isSelectedEsp = filters.esp === row.cod_esp
                return (
                  <tr
                    key={`${row.cod_esp}-${row.it || idx}`}
                    className={row.alerta?.nivel === 'CRITICO' ? 'm3-row--error' : ''}
                  >
                    <td className="m3-col-rowidx tabular-nums" aria-hidden="true">
                      {idx + 1}
                    </td>
                    <th scope="row" className="m3-cell-title">
                      <span className="m3-text-primary">{row.cod_esp}</span>
                      {row.sigla && row.sigla !== 'NAC' && (
                        <span className="m3-text-muted"> · {row.sigla}</span>
                      )}
                    </th>
                    <td className="m3-col-num tabular-nums">
                      {Number(row.plan_directo).toLocaleString('es-CL')}
                    </td>
                    <td className="m3-col-num tabular-nums">
                      {Number(row.meta_gestion).toLocaleString('es-CL')}
                    </td>
                    <td className="m3-col-num tabular-nums font-bold">
                      {Number(row.real_directo).toLocaleString('es-CL')}
                    </td>
                    <td className="m3-col-num tabular-nums">
                      <strong>{Number(row.cumplimiento_pct).toLocaleString('es-CL')}%</strong>
                    </td>
                    <td>
                      <PixelStatusBadge
                        nivel={row.alerta?.nivel}
                        texto={row.alerta?.badge}
                      />
                    </td>
                    <td>
                      {onChangeFilter && (
                        <button
                          type="button"
                          className="m3-btn m3-btn--tonal m3-btn--xs"
                          onClick={() =>
                            onChangeFilter('esp', isSelectedEsp ? '' : row.cod_esp)
                          }
                          aria-pressed={isSelectedEsp}
                        >
                          {isSelectedEsp ? 'Quitar' : `Filtrar ${row.cod_esp}`}
                        </button>
                      )}
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
