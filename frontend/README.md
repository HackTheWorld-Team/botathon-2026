# Frontend — Dashboard Teletón (Vite + React)

Scaffold base accesible (issue #23). Solo consume la API — sin lógica de negocio.

## Arranque

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxy /api → http://localhost:8000)
npm run build      # genera dist/ — FastAPI la sirve en producción
```

## Accesibilidad (WCAG 2.1 AA — obligatorio)

- HTML semántico: `<header>`, `<nav>`, `<main>`, `<footer>`, `<fieldset>/<legend>`
- Skip-link al contenido, `:focus-visible` global, navegación 100% teclado
- Contraste AA, tipografía ≥16px, sin texto justificado
- KPIs con `aria-label`; estados nunca solo-color (ícono + texto)

## Próximas vistas (issues #24–#27)

Tablas por equipo, filtros conectados a `/api/kpis`, vista parametrización
(admin, PATCH `/api/parametros`), Plan vs. Real con alertas y Antes/Después de mayo.
