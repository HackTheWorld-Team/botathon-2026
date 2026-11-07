import React, { useState } from 'react'

// Datos mock hasta que FastAPI exponga /api/kpis (issue #20).
const MOCK_KPI = {
  foja: 61.2,
  metaGestion: 499236,
  horas: { total: 16165, directas: 9741, indirectas: 2043, nas: 4381 }
}

export default function App() {
  const [kpi] = useState(MOCK_KPI)

  return (
    <>
      <a className="skip-link" href="#contenido">Saltar al contenido principal</a>
      <header className="app-header" role="banner">
        <h1>Teletón — Planificación Asistencial 2026</h1>
      </header>

      <nav aria-label="Filtros globales" className="filtros">
        <fieldset>
          <legend>Filtros</legend>
          <label htmlFor="f-instituto">Instituto</label>
          <select id="f-instituto" defaultValue="">
            <option value="">Todos</option>
          </select>
          <label htmlFor="f-mes">Mes</label>
          <select id="f-mes" defaultValue="">
            <option value="">Todos</option>
          </select>
          <label htmlFor="f-area">Área / especialidad</label>
          <select id="f-area" defaultValue="">
            <option value="">Todas</option>
          </select>
          <label htmlFor="f-cargo">Cargo</label>
          <select id="f-cargo" defaultValue="">
            <option value="">Todos</option>
          </select>
        </fieldset>
      </nav>

      <main id="contenido" role="main">
        <h2>Indicadores clave</h2>
        <section aria-label="Indicadores clave" className="kpis">
          <article className="kpi-card" aria-label="Porcentaje FOJA">
            <h3>% FOJA</h3>
            <p className="kpi-valor">{kpi.foja}%</p>
            <p className="kpi-nota">Ocupación de jornada asistencial</p>
          </article>
          <article className="kpi-card" aria-label="Meta de gestión asistencial">
            <h3>Meta de Gestión</h3>
            <p className="kpi-valor">{kpi.metaGestion.toLocaleString('es-CL')}</p>
            <p className="kpi-nota">Atenciones al 90% del plan</p>
          </article>
          <article className="kpi-card" aria-label="Horas semanales totales">
            <h3>Horas semanales</h3>
            <dl className="horas">
              <div><dt>Total</dt><dd>{kpi.horas.total.toLocaleString('es-CL')}</dd></div>
              <div><dt>Directas</dt><dd>{kpi.horas.directas.toLocaleString('es-CL')}</dd></div>
              <div><dt>Indirectas</dt><dd>{kpi.horas.indirectas.toLocaleString('es-CL')}</dd></div>
              <div><dt>NAS</dt><dd>{kpi.horas.nas.toLocaleString('es-CL')}</dd></div>
            </dl>
          </article>
        </section>

        <section aria-label="Estado de datos" className="estado">
          <p role="status">
            Datos de ejemplo (mock). Los datos reales llegarán desde la API —
            issues #20 y #19 del backlog.
          </p>
        </section>
      </main>

      <footer role="contentinfo">
        <p>Botathon 2026 · Teletón · Datos ficticios anonimizados</p>
      </footer>
    </>
  )
}
