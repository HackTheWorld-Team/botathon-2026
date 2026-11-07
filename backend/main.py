"""
backend/main.py — API FastAPI del MVP Botathon 2026 (Issue #20).

Expone los endpoints asistenciales esenciales para el Dashboard accesible:
- GET /api/kpis: Indicadores agregados (% FOJA, Meta 90%, Horas Dir/Ind/NAS).
- GET /api/plan: Dotación y proyección asistencial por profesional.
- GET /api/plan-vs-real: Comparativa Plan vs. SIC Real con semáforo y alertas accesibles WCAG.
- GET /api/lotes: Auditoría y trazabilidad de lotes procesados por Blue Prism.
- GET /api/filtros: Catálogos para selectores dinámicos del frontend.
- GET /api/health: Chequeo de salud del servicio.
"""
from __future__ import annotations

import os
import sqlite3
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB_PATH_DEFAULT = os.environ.get("BOTATHON_DB_PATH", "backend/db.sqlite")

app = FastAPI(
    title="Teletón Botathon 2026 — API Asistencial",
    version="1.0.0",
    description="Backend de soporte para el Dashboard de Planificación Asistencial y RPA.",
)

# Configuración CORS permisiva para desarrollo y despliegue local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Abre conexión con SQLite en modo WAL y acceso por nombre de columna."""
    path = db_path or os.environ.get("BOTATHON_DB_PATH", DB_PATH_DEFAULT)
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON;")
    return con


# ------------------------------------------------------------------------------
# Modelos Pydantic para Documentación OpenAPI
# ------------------------------------------------------------------------------
class AlertaWCAG(BaseModel):
    nivel: str  # CRITICO | CUMPLIDO | SUPERAVIT
    icono: str  # ⚠️ | ✅ | 📈
    badge: str
    mensaje: str


class KPIsResponse(BaseModel):
    total_profesionales: int
    total_contratos: int
    horas_contratadas_semanales: float
    horas_directas_semanales: float
    horas_indirectas_semanales: float
    horas_nas_semanales: float
    foja_pct: float
    plan_directo_mensual: int
    plan_indirecto_mensual: int
    plan_total_mensual: int
    meta_gestion_mensual: int


class PlanItem(BaseModel):
    persona_id: int
    it: int
    sigla: Optional[str]
    periodo: str
    cargo: str
    area: Optional[str] = None
    cod_esp: str
    horas_semanales: float
    pct_directo: float
    pct_indirecto: float
    pct_nas: float
    h_sem_disp_ate: float
    ate_dir_sem: int
    ate_ind_sem: int
    sem_efectivas: float
    plan_dir_m: int
    plan_ind_m: int
    mg_dir_m: int


class PlanPaginado(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[Dict[str, Any]]


class PlanVsRealItem(BaseModel):
    periodo: str
    it: int
    sigla: Optional[str]
    cod_esp: str
    plan_directo: int
    real_directo: int
    meta_gestion: int
    cumplimiento_pct: float
    desviacion_pct: float
    alerta: AlertaWCAG
    persona_id: Optional[int] = None


# ------------------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------------------

@app.get("/api/health")
def health_check() -> Dict[str, str]:
    """Chequeo de salud del servicio y de la base de datos."""
    try:
        with get_db() as con:
            con.execute("SELECT 1").fetchone()
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {str(exc)}")


@app.get("/api/filtros")
def get_filtros() -> Dict[str, Any]:
    """
    Retorna los catálogos disponibles para poblar los filtros dinámicos del Dashboard:
    sedes (institutos), meses/períodos, cargos y especialidades.
    """
    with get_db() as con:
        cur = con.cursor()
        institutos = [
            {"it": r["it"], "sigla": r["sigla"], "nombre": r["nombre"]}
            for r in cur.execute("SELECT it, sigla, nombre FROM institutos ORDER BY it").fetchall()
        ]

        periodos = [
            r["periodo"]
            for r in cur.execute(
                "SELECT DISTINCT periodo FROM contratos UNION SELECT DISTINCT periodo FROM planes ORDER BY periodo"
            ).fetchall()
            if r["periodo"]
        ]

        cargos = [
            r["cargo"]
            for r in cur.execute("SELECT DISTINCT cargo FROM contratos WHERE cargo IS NOT NULL ORDER BY cargo").fetchall()
        ]

        areas = [
            r["area"]
            for r in cur.execute("SELECT DISTINCT area FROM contratos WHERE area IS NOT NULL AND area != '' ORDER BY area").fetchall()
        ]

        especialidades = [
            r["cod_esp"]
            for r in cur.execute(
                "SELECT DISTINCT cod_esp FROM contratos WHERE cod_esp IS NOT NULL ORDER BY cod_esp"
            ).fetchall()
        ]

    return {
        "institutos": institutos,
        "periodos": periodos,
        "cargos": cargos,
        "areas": areas,
        "especialidades": especialidades,
    }


@app.get("/api/kpis", response_model=KPIsResponse)
def get_kpis(
    it: Optional[int] = Query(None, description="Filtrar por código de instituto (IT)"),
    periodo: Optional[str] = Query(None, description="Filtrar por período (YYYY-MM-01)"),
    cargo: Optional[str] = Query(None, description="Filtrar por cargo"),
    area: Optional[str] = Query(None, description="Filtrar por área"),
    cod_esp: Optional[str] = Query(None, description="Filtrar por código de especialidad"),
) -> KPIsResponse:
    """
    Retorna los KPIs ejecutivos consolidados:
    - % FOJA = (Horas Directas Semanales / Horas Contratadas Semanales) * 100
    - Meta de Gestión (MG 90% truncado)
    - Desglose semanal: Horas Contratadas, Directas, Indirectas y NAS
    - Planes mensuales directos e indirectos
    """
    where_clauses = ["1=1"]
    params: List[Any] = []

    if it is not None:
        where_clauses.append("c.it = ?")
        params.append(it)
    if periodo:
        where_clauses.append("c.periodo = ?")
        params.append(periodo)
    if cargo:
        where_clauses.append("UPPER(c.cargo) = UPPER(?)")
        params.append(cargo)
    if area:
        where_clauses.append("UPPER(c.area) = UPPER(?)")
        params.append(area)
    if cod_esp:
        where_clauses.append("UPPER(c.cod_esp) = UPPER(?)")
        params.append(cod_esp)

    filtro_sql = " AND ".join(where_clauses)

    query = f"""
        SELECT
            COUNT(DISTINCT c.persona_id) AS total_profesionales,
            COUNT(c.contrato_id) AS total_contratos,
            COALESCE(SUM(c.horas_semanales), 0.0) AS horas_contratadas,
            COALESCE(SUM(c.horas_semanales * COALESCE(p.pct_directo, 0.65)), 0.0) AS horas_directas,
            COALESCE(SUM(c.horas_semanales * COALESCE(p.pct_indirecto, 0.15)), 0.0) AS horas_indirectas,
            COALESCE(SUM(c.horas_semanales * COALESCE(p.pct_nas, 0.20)), 0.0) AS horas_nas,
            COALESCE(SUM(p.plan_dir_m), 0) AS plan_dir_m,
            COALESCE(SUM(p.plan_ind_m), 0) AS plan_ind_m,
            COALESCE(SUM(p.mg_dir_m), 0) AS mg_dir_m
        FROM contratos c
        LEFT JOIN planes p ON (c.persona_id = p.persona_id AND c.it = p.it AND c.periodo = p.periodo)
        WHERE {filtro_sql}
    """

    with get_db() as con:
        r = con.execute(query, params).fetchone()

    if not r or r["total_contratos"] == 0:
        return KPIsResponse(
            total_profesionales=0,
            total_contratos=0,
            horas_contratadas_semanales=0.0,
            horas_directas_semanales=0.0,
            horas_indirectas_semanales=0.0,
            horas_nas_semanales=0.0,
            foja_pct=0.0,
            plan_directo_mensual=0,
            plan_indirecto_mensual=0,
            plan_total_mensual=0,
            meta_gestion_mensual=0,
        )

    h_cont = float(r["horas_contratadas"])
    h_dir = float(r["horas_directas"])
    h_ind = float(r["horas_indirectas"])
    h_nas = float(r["horas_nas"])
    foja = (h_dir / h_cont * 100.0) if h_cont > 0 else 0.0

    plan_dir = int(r["plan_dir_m"])
    plan_ind = int(r["plan_ind_m"])
    mg_dir = int(r["mg_dir_m"])

    return KPIsResponse(
        total_profesionales=int(r["total_profesionales"]),
        total_contratos=int(r["total_contratos"]),
        horas_contratadas_semanales=round(h_cont, 2),
        horas_directas_semanales=round(h_dir, 2),
        horas_indirectas_semanales=round(h_ind, 2),
        horas_nas_semanales=round(h_nas, 2),
        foja_pct=round(foja, 2),
        plan_directo_mensual=plan_dir,
        plan_indirecto_mensual=plan_ind,
        plan_total_mensual=plan_dir + plan_ind,
        meta_gestion_mensual=mg_dir,
    )


@app.get("/api/plan", response_model=PlanPaginado)
def get_plan(
    it: Optional[int] = Query(None, description="Filtrar por código de instituto"),
    periodo: Optional[str] = Query(None, description="Filtrar por período"),
    cargo: Optional[str] = Query(None, description="Filtrar por cargo"),
    area: Optional[str] = Query(None, description="Filtrar por área"),
    cod_esp: Optional[str] = Query(None, description="Filtrar por especialidad"),
    limit: int = Query(50, ge=1, le=500, description="Cantidad de registros por página"),
    offset: int = Query(0, ge=0, description="Offset de paginación"),
) -> PlanPaginado:
    """
    Retorna la lista de contratos con su cálculo asistencial proyectado (tabla planes).
    Soporta filtros combinados y paginación rápida.
    """
    where_clauses = ["1=1"]
    params: List[Any] = []

    if it is not None:
        where_clauses.append("c.it = ?")
        params.append(it)
    if periodo:
        where_clauses.append("c.periodo = ?")
        params.append(periodo)
    if cargo:
        where_clauses.append("UPPER(c.cargo) = UPPER(?)")
        params.append(cargo)
    if area:
        where_clauses.append("UPPER(c.area) = UPPER(?)")
        params.append(area)
    if cod_esp:
        where_clauses.append("UPPER(c.cod_esp) = UPPER(?)")
        params.append(cod_esp)

    filtro_sql = " AND ".join(where_clauses)

    count_query = f"""
        SELECT COUNT(*) AS total
        FROM contratos c
        WHERE {filtro_sql}
    """

    data_query = f"""
        SELECT
            c.persona_id,
            c.it,
            i.sigla,
            c.periodo,
            c.cargo,
            c.area,
            c.cod_esp,
            c.horas_semanales,
            COALESCE(p.pct_directo, 0.65) AS pct_directo,
            COALESCE(p.pct_indirecto, 0.15) AS pct_indirecto,
            COALESCE(p.pct_nas, 0.20) AS pct_nas,
            COALESCE(p.h_sem_disp_ate, c.horas_semanales * 0.80) AS h_sem_disp_ate,
            COALESCE(p.ate_dir_sem, 0) AS ate_dir_sem,
            COALESCE(p.ate_ind_sem, 0) AS ate_ind_sem,
            COALESCE(p.sem_efectivas, 4.2) AS sem_efectivas,
            COALESCE(p.plan_dir_m, 0) AS plan_dir_m,
            COALESCE(p.plan_ind_m, 0) AS plan_ind_m,
            COALESCE(p.mg_dir_m, 0) AS mg_dir_m
        FROM contratos c
        LEFT JOIN institutos i ON c.it = i.it
        LEFT JOIN planes p ON (c.persona_id = p.persona_id AND c.it = p.it AND c.periodo = p.periodo)
        WHERE {filtro_sql}
        ORDER BY c.periodo DESC, c.it ASC, c.persona_id ASC
        LIMIT ? OFFSET ?
    """

    with get_db() as con:
        total = con.execute(count_query, params).fetchone()["total"]
        rows = con.execute(data_query, params + [limit, offset]).fetchall()

    items = [dict(r) for r in rows]
    return PlanPaginado(total=total, limit=limit, offset=offset, items=items)


def clasificar_alerta_wcag(real: int, plan: int, mg: int) -> AlertaWCAG:
    """
    Aplica doble codificación WCAG 2.1 AA (icono visible + etiqueta textual clara)
    según cumplimiento sobre el plan y la Meta de Gestión (90%).
    """
    if plan <= 0:
        return AlertaWCAG(
            nivel="SIN_PLAN",
            icono="ℹ️",
            badge="Sin Plan",
            mensaje="No hay atenciones directas planificadas",
        )

    cumplimiento = (real / plan) * 100.0

    if real < mg:
        return AlertaWCAG(
            nivel="CRITICO",
            icono="⚠️",
            badge="Déficit Crítico",
            mensaje=f"Déficit asistencial ({cumplimiento:.1f}% del plan, bajo la meta del 90%)",
        )
    elif real < plan:
        return AlertaWCAG(
            nivel="CUMPLIDO",
            icono="✅",
            badge="Meta Cumplida",
            mensaje=f"Meta de Gestión alcanzada ({cumplimiento:.1f}% del plan)",
        )
    else:
        return AlertaWCAG(
            nivel="SUPERAVIT",
            icono="📈",
            badge="Superávit",
            mensaje=f"Superávit asistencial ({cumplimiento:.1f}% sobre el plan)",
        )


@app.get("/api/plan-vs-real", response_model=List[PlanVsRealItem])
def get_plan_vs_real(
    it: Optional[int] = Query(None, description="Filtrar por instituto"),
    periodo: Optional[str] = Query(None, description="Filtrar por período"),
    cargo: Optional[str] = Query(None, description="Filtrar por cargo"),
    area: Optional[str] = Query(None, description="Filtrar por área"),
    cod_esp: Optional[str] = Query(None, description="Filtrar por código de especialidad"),
    agrupado: bool = Query(True, description="True: agrupa por Instituto/Especialidad; False: detalle por médico"),
) -> List[PlanVsRealItem]:
    """
    Cruce asistencial entre el Plan Asistencial proyectado y el registro real de SIC.
    Incluye semáforo accesible con doble codificación de estados (WCAG 2.1 AA).
    """
    where_clauses = ["1=1"]
    params: List[Any] = []

    if it is not None:
        where_clauses.append("COALESCE(p.it, s.it) = ?")
        params.append(it)
    if periodo:
        where_clauses.append("COALESCE(p.periodo, s.periodo) = ?")
        params.append(periodo)
    if cargo:
        where_clauses.append("UPPER(c.cargo) = UPPER(?)")
        params.append(cargo)
    if area:
        where_clauses.append("UPPER(c.area) = UPPER(?)")
        params.append(area)
    if cod_esp:
        where_clauses.append("UPPER(COALESCE(c.cod_esp, s.cod_esp)) = UPPER(?)")
        params.append(cod_esp)

    filtro_sql = " AND ".join(where_clauses)

    if agrupado:
        # Agrupación ejecutiva para gráficos y tarjetas por Sede y Especialidad
        query = f"""
            SELECT
                COALESCE(p.periodo, s.periodo) AS periodo,
                COALESCE(p.it, s.it) AS it,
                i.sigla AS sigla,
                COALESCE(c.cod_esp, s.cod_esp) AS cod_esp,
                COALESCE(SUM(p.plan_dir_m), 0) AS plan_directo,
                COALESCE(SUM(s.ate_dir_reales), 0) AS real_directo,
                COALESCE(SUM(p.mg_dir_m), 0) AS meta_gestion
            FROM planes p
            FULL OUTER JOIN sic_real s ON (
                p.persona_id = s.persona_id
                AND p.it = s.it
                AND p.periodo = s.periodo
            )
            LEFT JOIN contratos c ON (
                COALESCE(p.persona_id, s.persona_id) = c.persona_id
                AND COALESCE(p.it, s.it) = c.it
                AND COALESCE(p.periodo, s.periodo) = c.periodo
            )
            LEFT JOIN institutos i ON COALESCE(p.it, s.it) = i.it
            WHERE {filtro_sql}
            GROUP BY COALESCE(p.periodo, s.periodo), COALESCE(p.it, s.it), i.sigla, COALESCE(c.cod_esp, s.cod_esp)
            ORDER BY periodo DESC, it ASC, cod_esp ASC
        """
    else:
        # Detalle individual por profesional
        query = f"""
            SELECT
                COALESCE(p.periodo, s.periodo) AS periodo,
                COALESCE(p.it, s.it) AS it,
                i.sigla AS sigla,
                COALESCE(c.cod_esp, s.cod_esp) AS cod_esp,
                COALESCE(p.persona_id, s.persona_id) AS persona_id,
                COALESCE(p.plan_dir_m, 0) AS plan_directo,
                COALESCE(s.ate_dir_reales, 0) AS real_directo,
                COALESCE(p.mg_dir_m, 0) AS meta_gestion
            FROM planes p
            FULL OUTER JOIN sic_real s ON (
                p.persona_id = s.persona_id
                AND p.it = s.it
                AND p.periodo = s.periodo
            )
            LEFT JOIN contratos c ON (
                COALESCE(p.persona_id, s.persona_id) = c.persona_id
                AND COALESCE(p.it, s.it) = c.it
                AND COALESCE(p.periodo, s.periodo) = c.periodo
            )
            LEFT JOIN institutos i ON COALESCE(p.it, s.it) = i.it
            WHERE {filtro_sql}
            ORDER BY periodo DESC, it ASC, persona_id ASC
        """

    # Nota SQLite: FULL OUTER JOIN está soportado desde SQLite 3.39+ (Python 3.10+)
    with get_db() as con:
        try:
            rows = con.execute(query, params).fetchall()
        except sqlite3.OperationalError:
            # Fallback a LEFT JOIN si la versión del motor SQLite local es previa a 3.39
            fallback_query = query.replace("FULL OUTER JOIN", "LEFT JOIN")
            rows = con.execute(fallback_query, params).fetchall()

    resultados: List[PlanVsRealItem] = []
    for r in rows:
        plan_dir = int(r["plan_directo"])
        real_dir = int(r["real_directo"])
        mg_dir = int(r["meta_gestion"])

        cumplimiento = (real_dir / plan_dir * 100.0) if plan_dir > 0 else 0.0
        desviacion = ((real_dir - plan_dir) / plan_dir * 100.0) if plan_dir > 0 else 0.0

        alerta = clasificar_alerta_wcag(real=real_dir, plan=plan_dir, mg=mg_dir)

        resultados.append(
            PlanVsRealItem(
                periodo=r["periodo"] or "",
                it=r["it"] or 0,
                sigla=r["sigla"],
                cod_esp=r["cod_esp"] or "",
                persona_id=r["persona_id"] if not agrupado and "persona_id" in r.keys() else None,
                plan_directo=plan_dir,
                real_directo=real_dir,
                meta_gestion=mg_dir,
                cumplimiento_pct=round(cumplimiento, 1),
                desviacion_pct=round(desviacion, 1),
                alerta=alerta,
            )
        )

    return resultados


@app.get("/api/lotes")
def get_lotes() -> List[Dict[str, Any]]:
    """
    Retorna el historial de lotes procesados por el bot o ingesta para auditoría:
    archivo de origen, fecha de corrida, tipo (BUK/SIC), válidos, rechazados y duración.
    """
    with get_db() as con:
        rows = con.execute(
            """
            SELECT lote_id, archivo, tipo, fecha_corrida, duracion_ms, validos, rechazados
            FROM lotes
            ORDER BY lote_id DESC
            """
        ).fetchall()

    return [dict(r) for r in rows]
