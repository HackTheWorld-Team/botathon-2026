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
 * ResumenView.jsx — Vista General centrada en la Lista de Datos Estilo Excel Clásico Redondeado
 * e Indicadores Clave Compactos
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
    <div className="view-container">
      <h2 id="panel-heading-resumen" tabIndex="-1" className="sr-only">
        Resumen Ejecutivo Asistencial
      </h2>

      {/* 1. Foco Principal: Planilla / Lista Central Estilo Excel Clásico Redondeado */}
      <section
        aria-labelledby="resumen-esp-heading"
        className="panel-section panel-section--excel-focus"
      >
        <div className="excel-toolbar">
          <div className="excel-toolbar__title-group">
            <PixelExcelIcon size={16} />
            <h3 id="resumen-esp-heading" className="panel-section__title">
              Planilla de Cumplimiento por Especialidad (Plan Directo vs. Real SIC)
            </h3>
          </div>

          <div className="excel-toolbar__meta">
            <span className="status-badge status-badge--cumplido">
              <PixelCheckIcon size={12} />
              <span>
                <strong className="tabular-nums">{totalProf.toLocaleString('es-CL')}</strong> prof. ({totalContratos.toLocaleString('es-CL')} ctos.)
              </span>
            </span>
            {criticosCount > 0 && (
              <span className="status-badge status-badge--critico">
                <PixelAlertIcon size={12} />
                <span>
                  {criticosCount} bajo MG 90%
                </span>
              </span>
            )}
            {onSelectTab && (
              <button
                type="button"
                className="btn-pixel btn-pixel--primary btn-pixel--sm"
                onClick={() => onSelectTab('plan-vs-real')}
              >
                Matriz completa →
              </button>
            )}
          </div>
        </div>

        <div className="table-responsive table-responsive--main-focus" role="region" aria-labelledby="resumen-esp-heading" tabIndex="0">
          <table className="pixel-table excel-sheet-table">
            <caption className="sr-only">
              Tabla de cumplimiento asistencial por especialidad clínica comparando Plan Directo, Meta de Gestión 90% y Atenciones Reales SIC
            </caption>
            <thead>
              <tr>
                <th scope="col" className="excel-rownum-col">#</th>
                <th scope="col">Especialidad</th>
                <th scope="col" className="num-col">Plan Directo</th>
                <th scope="col" className="num-col">Meta (90%)</th>
                <th scope="col" className="num-col">Real (SIC)</th>
                <th scope="col" className="num-col">% Cumpl.</th>
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
                    className={row.alerta?.nivel === 'CRITICO' ? 'row-critico' : ''}
                  >
                    <td className="excel-rownum-col tabular-nums" aria-hidden="true">
                      {idx + 1}
                    </td>
                    <th scope="row" className="esp-cell">
                      <span className="esp-name">{row.cod_esp}</span>
                      {row.sigla && row.sigla !== 'NAC' && (
                        <span className="esp-sub"> · {row.sigla}</span>
                      )}
                    </th>
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
                          className="btn-pixel btn-pixel--ghost btn-pixel--sm"
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

      {/* 2. Cinta Compacta de 4 Indicadores Clave debajo de la Lista */}
      <section aria-label="Indicadores clave de planificación asistencial" className="kpi-grid">
        {/* Card 1: % FOJA */}
        <article className="kpi-card" aria-labelledby="kpi-title-foja">
          <div className="kpi-card__top">
            <span className="micro-label">KPI 01 · % FOJA</span>
            <span className="status-badge status-badge--teal">
              <PixelCheckIcon size={11} />
              <span>≥65%</span>
            </span>
          </div>

          <h3 id="kpi-title-foja" className="kpi-card__title">
            Ocupación Directa
          </h3>

          <div className="kpi-card__value-row">
            <p className="kpi-card__value tabular-nums">
              {fojaPct.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
            </p>
            <span className="kpi-card__formula tabular-nums">
              {hDir.toLocaleString('es-CL')}h / {hCont.toLocaleString('es-CL')}h
            </span>
          </div>

          <SegmentedBar
            valuePct={fojaPct}
            targetPct={70}
            variant="teal"
          />
        </article>

        {/* Card 2: Meta de Gestión 90% */}
        <article className="kpi-card" aria-labelledby="kpi-title-mg">
          <div className="kpi-card__top">
            <span className="micro-label">KPI 02 · MG 90%</span>
            <span className="status-badge status-badge--cumplido">
              <PixelTrendUpIcon size={11} />
              <span>Real: {globalCumplimientoPct.toLocaleString('es-CL')}%</span>
            </span>
          </div>

          <h3 id="kpi-title-mg" className="kpi-card__title">
            Meta de Gestión
          </h3>

          <div className="kpi-card__value-row">
            <p className="kpi-card__value tabular-nums">
              {metaGestion.toLocaleString('es-CL')}
            </p>
            <span className="kpi-card__unit">
              <code>⌊{planDirecto.toLocaleString('es-CL')} × 0,90⌋</code>
            </span>
          </div>

          <SegmentedBar
            valuePct={globalCumplimientoPct}
            targetPct={90}
            variant={globalCumplimientoPct < 90 ? 'alert' : 'default'}
          />
        </article>

        {/* Card 3: Plan Asistencial Mensual */}
        <article className="kpi-card" aria-labelledby="kpi-title-plan">
          <div className="kpi-card__top">
            <span className="micro-label">KPI 03 · PLAN TOTAL</span>
            <span className="status-badge status-badge--cumplido">
              <PixelCheckIcon size={11} />
              <span>Trazable</span>
            </span>
          </div>

          <h3 id="kpi-title-plan" className="kpi-card__title">
            Capacidad Proyectada
          </h3>

          <div className="kpi-card__value-row">
            <p className="kpi-card__value tabular-nums">
              {planTotal.toLocaleString('es-CL')}
            </p>
            <span className="kpi-card__unit">atenciones (Dir + Ind)</span>
          </div>

          <dl className="kpi-breakdown kpi-breakdown--3col tabular-nums">
            <div className="kpi-breakdown__item">
              <dt>Dir</dt>
              <dd>{planDirecto.toLocaleString('es-CL')}</dd>
            </div>
            <div className="kpi-breakdown__item">
              <dt>Ind</dt>
              <dd>{planIndirecto.toLocaleString('es-CL')}</dd>
            </div>
            <div className="kpi-breakdown__item">
              <dt>Prof.</dt>
              <dd>{totalProf.toLocaleString('es-CL')}</dd>
            </div>
          </dl>
        </article>

        {/* Card 4: Horas Semanales Dir / Ind / NAS */}
        <article className="kpi-card" aria-labelledby="kpi-title-horas">
          <div className="kpi-card__top">
            <span className="micro-label">KPI 04 · JORNADA</span>
            <span className="status-badge status-badge--teal">
              <PixelCheckIcon size={11} />
              <span>100%</span>
            </span>
          </div>

          <h3 id="kpi-title-horas" className="kpi-card__title">
            Horas Semanales
          </h3>

          <div className="kpi-card__value-row">
            <p className="kpi-card__value tabular-nums">
              {hCont.toLocaleString('es-CL', { maximumFractionDigits: 1 })} h
            </p>
            <span className="kpi-card__unit">
              Dir {hDir.toLocaleString('es-CL', { maximumFractionDigits: 0 })}h · Ind {hInd.toLocaleString('es-CL', { maximumFractionDigits: 0 })}h · NAS {hNas.toLocaleString('es-CL', { maximumFractionDigits: 0 })}h
            </span>
          </div>

          <StackedHoursBar pctDir={pctDir} pctInd={pctInd} pctNas={pctNas} />
        </article>
      </section>
    </div>
  )
}
