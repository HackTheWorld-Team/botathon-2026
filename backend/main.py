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

import io
import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.motor import (
    CatalogosMotor,
    ajustar_tope_42h,
    calcular_contrato_mes,
    tramo_inclusivo,
)

DB_PATH_DEFAULT = os.environ.get("BOTATHON_DB_PATH", "backend/db.sqlite")
_INITIALIZED_DBS: set[Tuple[str, float]] = set()
_AUTO_SEED_CHECKED: set[str] = set()


def _auto_seed_default_db_if_needed(path: str) -> None:
    """
    Inicializa automáticamente la base de datos por defecto (backend/db.sqlite) cuando
    no existe o está vacía, garantizando que levantar `uvicorn backend.main:app` deje
    el entorno de demo 100% operativo sin pasos manuales.
    """
    if path != DB_PATH_DEFAULT or path in _AUTO_SEED_CHECKED:
        return

    necesita_seed = False
    if not os.path.exists(path):
        necesita_seed = True
    else:
        try:
            with sqlite3.connect(path) as con:
                row = con.execute("SELECT COUNT(*) FROM institutos").fetchone()
                if not row or row[0] == 0:
                    necesita_seed = True
        except sqlite3.Error:
            necesita_seed = True

    if necesita_seed:
        try:
            from tools.preparar_entorno_demo import preparar_entorno_demo, seed_parametros_bd

            if os.environ.get("BOTATHON_AUTO_DEMO", "1") == "1":
                preparar_entorno_demo(db_path=path, modo="completo")
            else:
                seed_parametros_bd(db_path=path)
        except Exception:
            pass

    _AUTO_SEED_CHECKED.add(path)

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


def _asegurar_tablas_runtime(con: sqlite3.Connection) -> None:
    """Garantiza que las tablas de auditoría y deltas existan en cualquier BD existente."""
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS auditoria_parametros (
            auditoria_id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            usuario TEXT NOT NULL DEFAULT 'admin',
            tipo_cambio TEXT NOT NULL,
            entidad_clave TEXT NOT NULL,
            valor_anterior TEXT,
            valor_nuevo TEXT,
            vigencia_desde TEXT NOT NULL,
            planes_recalculados INTEGER NOT NULL DEFAULT 0
        );
        """
    )
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS deltas (
            delta_id INTEGER PRIMARY KEY AUTOINCREMENT,
            lote_id INTEGER NOT NULL REFERENCES lotes(lote_id),
            periodo TEXT NOT NULL,
            persona_id INTEGER NOT NULL,
            it INTEGER NOT NULL REFERENCES institutos(it),
            tipo_delta TEXT NOT NULL CHECK (tipo_delta IN ('ALTA', 'BAJA', 'CAMBIO_JORNADA', 'MULTI_SEDE')),
            valor_anterior TEXT,
            valor_nuevo TEXT,
            detalle TEXT
        );
        """
    )
    con.commit()


def get_db(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Abre conexión con SQLite en modo WAL y acceso por nombre de columna."""
    path = db_path or os.environ.get("BOTATHON_DB_PATH", DB_PATH_DEFAULT)
    _auto_seed_default_db_if_needed(path)
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON;")
    mtime = os.path.getmtime(path) if os.path.exists(path) else 0.0
    cache_key = (path, mtime)
    if cache_key not in _INITIALIZED_DBS:
        try:
            _asegurar_tablas_runtime(con)
            _INITIALIZED_DBS.add(cache_key)
        except sqlite3.Error:
            pass
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


@app.get("/api/lotes/{lote_id}/rechazados")
def get_lote_rechazados(lote_id: int) -> Dict[str, Any]:
    """
    Retorna el detalle de registros rechazados de un lote específico y el resumen
    agrupado por regla de validación (motivo) para la vista Lotes (#48).
    """
    with get_db() as con:
        cur = con.cursor()
        lote = cur.execute(
            "SELECT lote_id, archivo, tipo, fecha_corrida, validos, rechazados FROM lotes WHERE lote_id = ?",
            (lote_id,),
        ).fetchone()
        if not lote:
            raise HTTPException(status_code=404, detail=f"Lote {lote_id} no encontrado")

        rows = cur.execute(
            """
            SELECT rechazo_id, lote_id, fila_origen, motivo, detalle, payload
            FROM rechazados
            WHERE lote_id = ?
            ORDER BY fila_origen ASC, rechazo_id ASC
            """,
            (lote_id,),
        ).fetchall()

        resumen_rows = cur.execute(
            """
            SELECT motivo, COUNT(*) AS cantidad
            FROM rechazados
            WHERE lote_id = ?
            GROUP BY motivo
            ORDER BY cantidad DESC, motivo ASC
            """,
            (lote_id,),
        ).fetchall()

    items = [dict(r) for r in rows]
    resumen_reglas = [{"motivo": r["motivo"], "cantidad": int(r["cantidad"])} for r in resumen_rows]

    return {
        "lote_id": int(lote["lote_id"]),
        "archivo": lote["archivo"],
        "tipo": lote["tipo"],
        "fecha_corrida": lote["fecha_corrida"],
        "total_rechazados": len(items),
        "resumen_reglas": resumen_reglas,
        "rechazados": items,
    }


@app.get("/api/lotes/{lote_id}/reporte-rechazos")
def descargar_reporte_rechazos(lote_id: int):
    """
    Sirve el archivo Excel de registros rechazados para el lote indicado.
    Genera dinámicamente el archivo .xlsx desde la tabla rechazados del lote, o sirve
    el reporte en bot/reportes/Rejected_Records_Report.xlsx si aplica.
    """
    with get_db() as con:
        cur = con.cursor()
        lote = cur.execute(
            "SELECT lote_id, archivo, tipo FROM lotes WHERE lote_id = ?",
            (lote_id,),
        ).fetchone()
        if not lote:
            raise HTTPException(status_code=404, detail=f"Lote {lote_id} no encontrado")

        rows = cur.execute(
            """
            SELECT fila_origen, motivo, detalle, payload
            FROM rechazados
            WHERE lote_id = ?
            ORDER BY fila_origen ASC, rechazo_id ASC
            """,
            (lote_id,),
        ).fetchall()

    if not rows:
        report_file = (
            Path("bot/reportes/Rejected_Records_SIC_Report.xlsx")
            if lote["tipo"] == "SIC"
            else Path("bot/reportes/Rejected_Records_Report.xlsx")
        )
        if report_file.exists():
            return FileResponse(
                path=str(report_file),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                filename=f"Rejected_Records_Report_Lote_{lote_id}.xlsx",
            )

    filas_export = []
    for r in rows:
        fila_dict: Dict[str, Any] = {
            "Fila Origen": r["fila_origen"],
            "Motivo": r["motivo"],
            "Descripción Error": r["detalle"],
        }
        if r["payload"]:
            try:
                extra = json.loads(r["payload"])
                if isinstance(extra, dict):
                    fila_dict.update(extra)
            except Exception:
                pass
        filas_export.append(fila_dict)

    try:
        import pandas as pd

        df = (
            pd.DataFrame(filas_export)
            if filas_export
            else pd.DataFrame(columns=["Fila Origen", "Motivo", "Descripción Error"])
        )
        buf = io.BytesIO()
        df.to_excel(buf, index=False)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="Rejected_Records_Report_Lote_{lote_id}.xlsx"'
            },
        )
    except Exception:
        csv_lines = ["Fila Origen,Motivo,Descripcion Error"]
        for f in filas_export:
            csv_lines.append(f'{f.get("Fila Origen", "")},{f.get("Motivo", "")},"{f.get("Descripción Error", "")}"')
        csv_bytes = "\n".join(csv_lines).encode("utf-8")
        return StreamingResponse(
            io.BytesIO(csv_bytes),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="Rejected_Records_Report_Lote_{lote_id}.csv"'
            },
        )


# ------------------------------------------------------------------------------
# Modelos y Endpoints de Parámetros, Simulación y Auditoría (Issues #21 y #26)
# ------------------------------------------------------------------------------

class SimularParametrosRequest(BaseModel):
    cargo: str
    tramo: int = 1
    pct_directo: float
    pct_indirecto: float
    pct_nas: float
    min_directa: int = 30
    min_indirecta: int = 30
    vigencia_desde: str = "2026-05-01"
    incluir_vacantes: bool = False
    horas_vacantes_semanales: float = 0.0


class PatchParametrosRequest(BaseModel):
    cargo: Optional[str] = None
    tramo: int = 1
    pct_directo: Optional[float] = None
    pct_indirecto: Optional[float] = None
    pct_nas: Optional[float] = None
    min_directa: int = 30
    min_indirecta: int = 30
    cod_esp: Optional[str] = None
    pct_grupal: Optional[float] = None
    n_pac_san_con: Optional[float] = None
    n_pac_otros: Optional[float] = None
    asignacion_id: Optional[int] = None
    nombre_asignacion: Optional[str] = None
    horas_semana: Optional[float] = None
    requiere_vb_dmn: Optional[int] = None
    vigencia_desde: str = "2026-05-01"
    usuario: str = "admin_clinico"
    motivo: Optional[str] = None


def _normalizar_y_validar_distribucion(
    pct_directo: float,
    pct_indirecto: float,
    pct_nas: float,
    min_directa: int,
    min_indirecta: int,
    tramo: int,
) -> Tuple[float, float, float, int, int]:
    if tramo not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="El tramo debe ser 1, 2 o 3.")
    if pct_directo < 0 or pct_indirecto < 0 or pct_nas < 0:
        raise HTTPException(status_code=400, detail="Los porcentajes de distribución no pueden ser negativos.")
    if min_directa <= 0 or min_indirecta <= 0:
        raise HTTPException(status_code=400, detail="Los minutos por atención deben ser mayores a 0.")

    suma = pct_directo + pct_indirecto + pct_nas
    if suma > 1.5 and abs(suma - 100.0) <= 1.0:
        pct_directo /= 100.0
        pct_indirecto /= 100.0
        pct_nas /= 100.0
        suma = pct_directo + pct_indirecto + pct_nas

    if abs(suma - 1.0) > 0.02:
        raise HTTPException(
            status_code=400,
            detail=f"La suma de pct_directo, pct_indirecto y pct_nas debe ser 1.0 (100%), recibido: {suma:.4f}",
        )

    return (
        round(float(pct_directo), 6),
        round(float(pct_indirecto), 6),
        round(float(pct_nas), 6),
        int(min_directa),
        int(min_indirecta),
    )


@app.get("/api/parametros")
def get_parametros() -> Dict[str, Any]:
    """
    Retorna todos los catálogos de parámetros editables y el historial reciente de auditoría:
    - distribucion (cargo × tramo)
    - grupal (cod_esp)
    - asignaciones
    - semanas_habiles
    - auditoria (últimos 50 cambios)
    """
    with get_db() as con:
        cur = con.cursor()
        distribucion = [
            dict(r)
            for r in cur.execute(
                """
                SELECT cargo, tramo, pct_directo, pct_indirecto, pct_nas, min_directa, min_indirecta
                FROM parametros_distribucion
                ORDER BY cargo ASC, tramo ASC
                """
            ).fetchall()
        ]
        grupal = [
            dict(r)
            for r in cur.execute(
                """
                SELECT cod_esp, pct_grupal, n_pac_san_con, n_pac_otros
                FROM parametros_grupal
                ORDER BY cod_esp ASC
                """
            ).fetchall()
        ]
        asignaciones = [
            dict(r)
            for r in cur.execute(
                """
                SELECT asignacion_id, nombre, horas_semana, requiere_vb_dmn
                FROM asignaciones
                ORDER BY asignacion_id ASC
                """
            ).fetchall()
        ]
        semanas_habiles = [
            dict(r)
            for r in cur.execute(
                """
                SELECT anio, mes, semanas
                FROM semanas_habiles
                ORDER BY anio ASC, mes ASC
                """
            ).fetchall()
        ]
        auditoria = [
            dict(r)
            for r in cur.execute(
                """
                SELECT auditoria_id, timestamp, usuario, tipo_cambio, entidad_clave,
                       valor_anterior, valor_nuevo, vigencia_desde, planes_recalculados
                FROM auditoria_parametros
                ORDER BY auditoria_id DESC
                LIMIT 50
                """
            ).fetchall()
        ]

    return {
        "distribucion": distribucion,
        "grupal": grupal,
        "asignaciones": asignaciones,
        "semanas_habiles": semanas_habiles,
        "auditoria": auditoria,
    }


@app.post("/api/parametros/simular")
def simular_parametros(req: SimularParametrosRequest) -> Dict[str, Any]:
    """
    Simula en memoria el impacto de cambiar una regla (cargo, tramo) a contar de
    vigencia_desde, sin modificar la base de datos.
    """
    cargo_key = req.cargo.strip().upper()
    if not cargo_key:
        raise HTTPException(status_code=400, detail="El campo cargo es obligatorio.")

    pct_dir, pct_ind, pct_nas, min_dir, min_ind = _normalizar_y_validar_distribucion(
        req.pct_directo, req.pct_indirecto, req.pct_nas, req.min_directa, req.min_indirecta, req.tramo
    )
    vigencia_desde = req.vigencia_desde.strip() or "2026-05-01"

    with get_db() as con:
        catalogos = CatalogosMotor.desde_db_con(con)
        rows = con.execute(
            """
            SELECT
                c.persona_id, c.it, c.periodo, c.cargo, c.cod_esp, c.horas_semanales,
                COALESCE(p.plan_dir_m, 0) AS plan_dir_m,
                COALESCE(p.mg_dir_m, 0) AS mg_dir_m,
                COALESCE(p.pct_directo, 0.65) AS pct_directo
            FROM contratos c
            LEFT JOIN planes p ON (c.persona_id = p.persona_id AND c.it = p.it AND c.periodo = p.periodo)
            WHERE c.periodo >= ?
            ORDER BY c.periodo ASC, c.it ASC, c.persona_id ASC
            """,
            (vigencia_desde,),
        ).fetchall()

    # Modificamos el catálogo únicamente en memoria
    catalogos.distribucion[(cargo_key, req.tramo)] = {
        "pct_directo": pct_dir,
        "pct_indirecto": pct_ind,
        "pct_nas": pct_nas,
        "min_directa": min_dir,
        "min_indirecta": min_ind,
    }

    contratos_afectados = 0
    plan_dir_actual = 0
    plan_dir_simulado = 0
    mg_dir_actual = 0
    mg_dir_simulado = 0
    horas_cont_total = 0.0
    horas_dir_actual = 0.0
    horas_dir_simulado = 0.0
    periodos_vistos: set[str] = set()

    for r in rows:
        periodos_vistos.add(r["periodo"])
        hs_raw = float(r["horas_semanales"])
        hs_ef = ajustar_tope_42h(hs_raw, r["periodo"])
        tramo_c = tramo_inclusivo(hs_ef)
        c_cargo = (r["cargo"] or "").strip().upper()

        p_dir_act = int(r["plan_dir_m"])
        mg_act = int(r["mg_dir_m"])
        h_dir_act = hs_raw * float(r["pct_directo"])

        plan_dir_actual += p_dir_act
        mg_dir_actual += mg_act
        horas_cont_total += hs_raw
        horas_dir_actual += h_dir_act

        if c_cargo == cargo_key and tramo_c == req.tramo:
            contratos_afectados += 1
            sim = calcular_contrato_mes(
                persona_id=int(r["persona_id"]),
                it=int(r["it"]),
                periodo=str(r["periodo"]),
                cargo=c_cargo,
                cod_esp=str(r["cod_esp"] or ""),
                horas_semanales=hs_raw,
                catalogos=catalogos,
            )
            plan_dir_simulado += int(sim["plan_dir_m"])
            mg_dir_simulado += int(sim["mg_dir_m"])
            horas_dir_simulado += hs_raw * float(sim["pct_directo"])
        else:
            plan_dir_simulado += p_dir_act
            mg_dir_simulado += mg_act
            horas_dir_simulado += h_dir_act

    horas_cont_simulado = horas_cont_total
    if req.incluir_vacantes and req.horas_vacantes_semanales > 0:
        periodos_vac = sorted(periodos_vistos) if periodos_vistos else [vigencia_desde]
        for per in periodos_vac:
            sim_vac = calcular_contrato_mes(
                persona_id=0,
                it=131,
                periodo=per,
                cargo=cargo_key,
                cod_esp="FI",
                horas_semanales=float(req.horas_vacantes_semanales),
                catalogos=catalogos,
            )
            plan_dir_simulado += int(sim_vac["plan_dir_m"])
            mg_dir_simulado += int(sim_vac["mg_dir_m"])
            horas_cont_simulado += float(req.horas_vacantes_semanales)
            horas_dir_simulado += float(req.horas_vacantes_semanales) * float(sim_vac["pct_directo"])

    foja_actual_pct = (horas_dir_actual / horas_cont_total * 100.0) if horas_cont_total > 0 else 0.0
    foja_simulado_pct = (horas_dir_simulado / horas_cont_simulado * 100.0) if horas_cont_simulado > 0 else 0.0

    return {
        "vigencia_desde": vigencia_desde,
        "cargo": cargo_key,
        "tramo": req.tramo,
        "contratos_afectados": contratos_afectados,
        "plan_dir_actual": plan_dir_actual,
        "plan_dir_simulado": plan_dir_simulado,
        "delta_plan_dir": plan_dir_simulado - plan_dir_actual,
        "mg_dir_actual": mg_dir_actual,
        "mg_dir_simulado": mg_dir_simulado,
        "delta_mg_dir": mg_dir_simulado - mg_dir_actual,
        "foja_actual_pct": round(foja_actual_pct, 2),
        "foja_simulado_pct": round(foja_simulado_pct, 2),
    }


@app.patch("/api/parametros")
def patch_parametros(req: PatchParametrosRequest) -> Dict[str, Any]:
    """
    Actualiza parámetros asistenciales (distribución por cargo×tramo, factor grupal o asignaciones),
    recalcula planes EXCLUSIVAMENTE para periodo >= vigencia_desde (no retroactivo) y registra
    la trazabilidad completa en auditoria_parametros.
    """
    vigencia_desde = (req.vigencia_desde or "").strip()
    if not vigencia_desde:
        raise HTTPException(status_code=400, detail="El campo vigencia_desde es obligatorio.")

    usuario = (req.usuario or "admin_clinico").strip() or "admin_clinico"
    timestamp = datetime.now().isoformat()

    with get_db() as con:
        cur = con.cursor()

        if req.cargo is not None and req.cargo.strip():
            cargo_key = req.cargo.strip().upper()
            if req.pct_directo is None or req.pct_indirecto is None or req.pct_nas is None:
                raise HTTPException(
                    status_code=400,
                    detail="Para actualizar distribución se requieren pct_directo, pct_indirecto y pct_nas.",
                )
            pct_dir, pct_ind, pct_nas, min_dir, min_ind = _normalizar_y_validar_distribucion(
                req.pct_directo, req.pct_indirecto, req.pct_nas, req.min_directa, req.min_indirecta, req.tramo
            )

            prev_row = cur.execute(
                """
                SELECT cargo, tramo, pct_directo, pct_indirecto, pct_nas, min_directa, min_indirecta
                FROM parametros_distribucion
                WHERE UPPER(cargo) = UPPER(?) AND tramo = ?
                """,
                (cargo_key, req.tramo),
            ).fetchone()
            valor_anterior_dict = dict(prev_row) if prev_row else None

            cur.execute(
                """
                INSERT OR REPLACE INTO parametros_distribucion (
                    cargo, tramo, pct_directo, pct_indirecto, pct_nas, min_directa, min_indirecta
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (cargo_key, req.tramo, pct_dir, pct_ind, pct_nas, min_dir, min_ind),
            )

            regla_actualizada = {
                "cargo": cargo_key,
                "tramo": req.tramo,
                "pct_directo": pct_dir,
                "pct_indirecto": pct_ind,
                "pct_nas": pct_nas,
                "min_directa": min_dir,
                "min_indirecta": min_ind,
            }
            tipo_cambio = "DISTRIBUCION"
            entidad_clave = f"{cargo_key}:T{req.tramo}"

        elif req.cod_esp is not None and req.cod_esp.strip():
            esp_key = req.cod_esp.strip().upper()
            if req.pct_grupal is None or req.n_pac_san_con is None or req.n_pac_otros is None:
                raise HTTPException(
                    status_code=400,
                    detail="Para actualizar factor grupal se requieren pct_grupal, n_pac_san_con y n_pac_otros.",
                )
            pct_grup = float(req.pct_grupal)
            if pct_grup > 1.0 and pct_grup <= 100.0:
                pct_grup /= 100.0
            if pct_grup < 0 or pct_grup > 1.0 or req.n_pac_san_con <= 0 or req.n_pac_otros <= 0:
                raise HTTPException(status_code=400, detail="Valores de parámetro grupal fuera de rango.")

            prev_row = cur.execute(
                "SELECT cod_esp, pct_grupal, n_pac_san_con, n_pac_otros FROM parametros_grupal WHERE UPPER(cod_esp) = UPPER(?)",
                (esp_key,),
            ).fetchone()
            valor_anterior_dict = dict(prev_row) if prev_row else None

            cur.execute(
                """
                INSERT OR REPLACE INTO parametros_grupal (cod_esp, pct_grupal, n_pac_san_con, n_pac_otros)
                VALUES (?, ?, ?, ?)
                """,
                (esp_key, pct_grup, float(req.n_pac_san_con), float(req.n_pac_otros)),
            )
            regla_actualizada = {
                "cod_esp": esp_key,
                "pct_grupal": pct_grup,
                "n_pac_san_con": float(req.n_pac_san_con),
                "n_pac_otros": float(req.n_pac_otros),
            }
            tipo_cambio = "GRUPAL"
            entidad_clave = esp_key

        elif req.asignacion_id is not None or (req.nombre_asignacion and req.nombre_asignacion.strip()):
            if req.horas_semana is None or req.horas_semana < 0:
                raise HTTPException(status_code=400, detail="horas_semana debe ser >= 0.")
            vb = int(req.requiere_vb_dmn) if req.requiere_vb_dmn is not None else 0
            if vb not in (0, 1):
                raise HTTPException(status_code=400, detail="requiere_vb_dmn debe ser 0 o 1.")

            if req.asignacion_id is not None:
                prev_row = cur.execute(
                    "SELECT asignacion_id, nombre, horas_semana, requiere_vb_dmn FROM asignaciones WHERE asignacion_id = ?",
                    (req.asignacion_id,),
                ).fetchone()
                if not prev_row:
                    raise HTTPException(status_code=404, detail=f"Asignación {req.asignacion_id} no encontrada.")
                nombre_asig = req.nombre_asignacion.strip() if req.nombre_asignacion else prev_row["nombre"]
                valor_anterior_dict = dict(prev_row)
                cur.execute(
                    "UPDATE asignaciones SET nombre = ?, horas_semana = ?, requiere_vb_dmn = ? WHERE asignacion_id = ?",
                    (nombre_asig, float(req.horas_semana), vb, req.asignacion_id),
                )
                asig_id = int(req.asignacion_id)
            else:
                nombre_asig = req.nombre_asignacion.strip()  # type: ignore[union-attr]
                prev_row = cur.execute(
                    "SELECT asignacion_id, nombre, horas_semana, requiere_vb_dmn FROM asignaciones WHERE UPPER(nombre) = UPPER(?)",
                    (nombre_asig,),
                ).fetchone()
                valor_anterior_dict = dict(prev_row) if prev_row else None
                if prev_row:
                    asig_id = int(prev_row["asignacion_id"])
                    cur.execute(
                        "UPDATE asignaciones SET horas_semana = ?, requiere_vb_dmn = ? WHERE asignacion_id = ?",
                        (float(req.horas_semana), vb, asig_id),
                    )
                else:
                    cur.execute(
                        "INSERT INTO asignaciones (nombre, horas_semana, requiere_vb_dmn) VALUES (?, ?, ?)",
                        (nombre_asig, float(req.horas_semana), vb),
                    )
                    asig_id = int(cur.lastrowid)

            regla_actualizada = {
                "asignacion_id": asig_id,
                "nombre": nombre_asig,
                "horas_semana": float(req.horas_semana),
                "requiere_vb_dmn": vb,
            }
            tipo_cambio = "ASIGNACION"
            entidad_clave = nombre_asig
        else:
            raise HTTPException(
                status_code=400,
                detail="Debe especificar cargo (distribución), cod_esp (grupal) o asignacion_id/nombre_asignacion.",
            )

        # Recálculo NO retroactivo: solo contratos con periodo >= vigencia_desde
        catalogos = CatalogosMotor.desde_db_con(con)
        contratos_vigentes = cur.execute(
            """
            SELECT lote_id, persona_id, it, periodo, cargo, horas_semanales, cod_esp
            FROM contratos
            WHERE periodo >= ?
            ORDER BY periodo ASC, it ASC, persona_id ASC
            """,
            (vigencia_desde,),
        ).fetchall()

        planes_recalculados = 0
        periodos_recalculados_set: set[str] = set()
        for c in contratos_vigentes:
            calc = calcular_contrato_mes(
                persona_id=int(c["persona_id"]),
                it=int(c["it"]),
                periodo=str(c["periodo"]),
                cargo=str(c["cargo"] or ""),
                cod_esp=str(c["cod_esp"] or ""),
                horas_semanales=float(c["horas_semanales"]),
                catalogos=catalogos,
            )
            cur.execute(
                """
                INSERT OR REPLACE INTO planes (
                    persona_id, it, periodo, pct_nas, pct_directo, pct_indirecto,
                    h_sem_disp_ate, ate_dir_sem, ate_ind_sem, sem_efectivas,
                    plan_dir_m, plan_ind_m, mg_dir_m, lote_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    calc["persona_id"],
                    calc["it"],
                    calc["periodo"],
                    calc["pct_nas"],
                    calc["pct_directo"],
                    calc["pct_indirecto"],
                    calc["h_sem_disp_ate"],
                    calc["ate_dir_sem"],
                    calc["ate_ind_sem"],
                    calc["sem_efectivas"],
                    calc["plan_dir_m"],
                    calc["plan_ind_m"],
                    calc["mg_dir_m"],
                    int(c["lote_id"]),
                ),
            )
            planes_recalculados += 1
            periodos_recalculados_set.add(str(c["periodo"]))

        periodos_inmutables = [
            r["periodo"]
            for r in cur.execute(
                "SELECT DISTINCT periodo FROM planes WHERE periodo < ? ORDER BY periodo ASC",
                (vigencia_desde,),
            ).fetchall()
        ]

        valor_nuevo_payload = dict(regla_actualizada)
        if req.motivo:
            valor_nuevo_payload["motivo"] = req.motivo

        valor_anterior_json = json.dumps(valor_anterior_dict, ensure_ascii=False) if valor_anterior_dict else None
        valor_nuevo_json = json.dumps(valor_nuevo_payload, ensure_ascii=False)

        cur.execute(
            """
            INSERT INTO auditoria_parametros (
                timestamp, usuario, tipo_cambio, entidad_clave,
                valor_anterior, valor_nuevo, vigencia_desde, planes_recalculados
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                timestamp,
                usuario,
                tipo_cambio,
                entidad_clave,
                valor_anterior_json,
                valor_nuevo_json,
                vigencia_desde,
                planes_recalculados,
            ),
        )
        auditoria_id = int(cur.lastrowid)
        con.commit()

    auditoria_record = {
        "auditoria_id": auditoria_id,
        "timestamp": timestamp,
        "usuario": usuario,
        "tipo_cambio": tipo_cambio,
        "entidad_clave": entidad_clave,
        "valor_anterior": valor_anterior_json,
        "valor_nuevo": valor_nuevo_json,
        "vigencia_desde": vigencia_desde,
        "planes_recalculados": planes_recalculados,
    }

    return {
        "status": "ok",
        "regla_actualizada": regla_actualizada,
        "vigencia_desde": vigencia_desde,
        "planes_recalculados": planes_recalculados,
        "periodos_recalculados": sorted(periodos_recalculados_set),
        "periodos_inmutables": periodos_inmutables,
        "auditoria": auditoria_record,
    }


def _mes_previo_iso(periodo_corte: str) -> str:
    partes = periodo_corte.split("-")
    if len(partes) >= 2:
        try:
            anio = int(partes[0])
            mes = int(partes[1])
            if mes == 1:
                return f"{anio - 1:04d}-12-01"
            return f"{anio:04d}-{mes - 1:02d}-01"
        except ValueError:
            pass
    return "2026-04-01"


@app.get("/api/deltas")
def get_deltas(
    periodo_corte: str = Query("2026-05-01", description="Período de corte para comparativa Antes/Después"),
    it: Optional[int] = Query(None, description="Filtrar por instituto (IT)"),
    lote_id: Optional[int] = Query(None, description="Filtrar por ID de lote"),
) -> Dict[str, Any]:
    """
    Endpoint para la pestaña Antes/Después (#47):
    Retorna los deltas detectados (ALTA, BAJA, CAMBIO_JORNADA, MULTI_SEDE),
    comparativa por instituto y por profesional entre el mes previo y el período de corte,
    y el resumen de meses congelados (< periodo_corte) que prueba la no-retroactividad.
    """
    periodo_anterior = _mes_previo_iso(periodo_corte)

    with get_db() as con:
        cur = con.cursor()

        # 1. Deltas registrados en tabla deltas
        where_deltas = ["d.periodo = ?"]
        params_deltas: List[Any] = [periodo_corte]
        if it is not None:
            where_deltas.append("d.it = ?")
            params_deltas.append(it)
        if lote_id is not None:
            where_deltas.append("d.lote_id = ?")
            params_deltas.append(lote_id)

        deltas_sql = " AND ".join(where_deltas)
        deltas_rows = cur.execute(
            f"""
            SELECT
                d.delta_id, d.lote_id, d.periodo, d.persona_id, d.it,
                i.sigla,
                d.tipo_delta, d.valor_anterior, d.valor_nuevo, d.detalle,
                c.cargo, c.cod_esp, c.horas_semanales,
                COALESCE(p.plan_dir_m, 0) AS plan_dir_m,
                COALESCE(p.plan_ind_m, 0) AS plan_ind_m,
                COALESCE(p.mg_dir_m, 0) AS mg_dir_m
            FROM deltas d
            LEFT JOIN institutos i ON d.it = i.it
            LEFT JOIN contratos c ON (d.persona_id = c.persona_id AND d.it = c.it AND d.periodo = c.periodo)
            LEFT JOIN planes p ON (d.persona_id = p.persona_id AND d.it = p.it AND d.periodo = p.periodo)
            WHERE {deltas_sql}
            ORDER BY d.it ASC, d.persona_id ASC, d.delta_id ASC
            """,
            params_deltas,
        ).fetchall()

        deltas_list = [dict(r) for r in deltas_rows]

        # 2. Comparativa por instituto (periodo_anterior vs periodo_corte)
        it_filter_sql = "AND c.it = ?" if it is not None else ""
        it_params: List[Any] = [periodo_anterior, periodo_corte] + ([it] if it is not None else [])

        comp_it_rows = cur.execute(
            f"""
            SELECT
                c.it,
                i.sigla,
                SUM(CASE WHEN c.periodo = ? THEN c.horas_semanales ELSE 0.0 END) AS horas_antes,
                SUM(CASE WHEN c.periodo = ? THEN c.horas_semanales ELSE 0.0 END) AS horas_despues,
                SUM(CASE WHEN c.periodo = ? THEN COALESCE(p.plan_dir_m, 0) ELSE 0 END) AS plan_dir_antes,
                SUM(CASE WHEN c.periodo = ? THEN COALESCE(p.plan_dir_m, 0) ELSE 0 END) AS plan_dir_despues,
                SUM(CASE WHEN c.periodo = ? THEN COALESCE(p.mg_dir_m, 0) ELSE 0 END) AS mg_antes,
                SUM(CASE WHEN c.periodo = ? THEN COALESCE(p.mg_dir_m, 0) ELSE 0 END) AS mg_despues
            FROM contratos c
            LEFT JOIN institutos i ON c.it = i.it
            LEFT JOIN planes p ON (c.persona_id = p.persona_id AND c.it = p.it AND c.periodo = p.periodo)
            WHERE c.periodo IN (?, ?) {it_filter_sql}
            GROUP BY c.it, i.sigla
            ORDER BY c.it ASC
            """,
            [
                periodo_anterior,
                periodo_corte,
                periodo_anterior,
                periodo_corte,
                periodo_anterior,
                periodo_corte,
            ]
            + it_params,
        ).fetchall()

        comparativa_institutos = []
        for r in comp_it_rows:
            h_ant = round(float(r["horas_antes"] or 0.0), 2)
            h_desp = round(float(r["horas_despues"] or 0.0), 2)
            p_ant = int(r["plan_dir_antes"] or 0)
            p_desp = int(r["plan_dir_despues"] or 0)
            comparativa_institutos.append(
                {
                    "it": int(r["it"]),
                    "sigla": r["sigla"],
                    "horas_antes": h_ant,
                    "horas_despues": h_desp,
                    "delta_horas": round(h_desp - h_ant, 2),
                    "plan_dir_antes": p_ant,
                    "plan_dir_despues": p_desp,
                    "delta_plan_dir": p_desp - p_ant,
                    "mg_antes": int(r["mg_antes"] or 0),
                    "mg_despues": int(r["mg_despues"] or 0),
                }
            )

        # 3. Comparativa por profesional (periodo_anterior vs periodo_corte)
        prof_rows = cur.execute(
            f"""
            SELECT
                c.persona_id,
                c.it,
                i.sigla,
                c.periodo,
                c.cargo,
                c.cod_esp,
                c.horas_semanales,
                COALESCE(p.plan_dir_m, 0) AS plan_dir_m
            FROM contratos c
            LEFT JOIN institutos i ON c.it = i.it
            LEFT JOIN planes p ON (c.persona_id = p.persona_id AND c.it = p.it AND c.periodo = p.periodo)
            WHERE c.periodo IN (?, ?) {it_filter_sql}
            ORDER BY c.it ASC, c.persona_id ASC
            """,
            it_params,
        ).fetchall()

        mapa_deltas_tipo: Dict[Tuple[int, int], str] = {}
        for d in deltas_list:
            key = (int(d["persona_id"]), int(d["it"]))
            if key not in mapa_deltas_tipo or d["tipo_delta"] == "MULTI_SEDE":
                mapa_deltas_tipo[key] = str(d["tipo_delta"])

        por_prof: Dict[Tuple[int, int], Dict[str, Any]] = {}
        for r in prof_rows:
            key = (int(r["persona_id"]), int(r["it"]))
            entry = por_prof.setdefault(
                key,
                {
                    "persona_id": int(r["persona_id"]),
                    "it": int(r["it"]),
                    "sigla": r["sigla"],
                    "cargo": r["cargo"],
                    "cod_esp": r["cod_esp"],
                    "horas_antes": 0.0,
                    "horas_despues": 0.0,
                    "plan_dir_antes": 0,
                    "plan_dir_despues": 0,
                    "en_antes": False,
                    "en_despues": False,
                },
            )
            if r["periodo"] == periodo_anterior:
                entry["horas_antes"] = float(r["horas_semanales"])
                entry["plan_dir_antes"] = int(r["plan_dir_m"])
                entry["en_antes"] = True
            elif r["periodo"] == periodo_corte:
                entry["horas_despues"] = float(r["horas_semanales"])
                entry["plan_dir_despues"] = int(r["plan_dir_m"])
                entry["cargo"] = r["cargo"]
                entry["cod_esp"] = r["cod_esp"]
                entry["en_despues"] = True

        # Detectar multi-sede en periodo_corte si la tabla deltas estaba vacía
        sedes_por_persona_corte: Dict[int, int] = {}
        for (pid, _it_code), info in por_prof.items():
            if info["en_despues"]:
                sedes_por_persona_corte[pid] = sedes_por_persona_corte.get(pid, 0) + 1

        comparativa_profesionales = []
        for (pid, it_code), info in sorted(por_prof.items(), key=lambda x: (x[0][1], x[0][0])):
            if (pid, it_code) in mapa_deltas_tipo:
                t_delta = mapa_deltas_tipo[(pid, it_code)]
            elif sedes_por_persona_corte.get(pid, 0) > 1 and info["en_despues"]:
                t_delta = "MULTI_SEDE"
            elif info["en_despues"] and not info["en_antes"]:
                t_delta = "ALTA"
            elif info["en_antes"] and not info["en_despues"]:
                t_delta = "BAJA"
            elif abs(info["horas_despues"] - info["horas_antes"]) > 0.01:
                t_delta = "CAMBIO_JORNADA"
            else:
                t_delta = "SIN_CAMBIO"

            comparativa_profesionales.append(
                {
                    "persona_id": pid,
                    "it": it_code,
                    "sigla": info["sigla"],
                    "cargo": info["cargo"],
                    "cod_esp": info["cod_esp"],
                    "tipo_delta": t_delta,
                    "horas_antes": round(info["horas_antes"], 2),
                    "horas_despues": round(info["horas_despues"], 2),
                    "plan_dir_antes": info["plan_dir_antes"],
                    "plan_dir_despues": info["plan_dir_despues"],
                    "delta_plan_dir": info["plan_dir_despues"] - info["plan_dir_antes"],
                }
            )

        # Si la tabla deltas no tenía registros previos pero hay cambios entre meses, sintetizar conteo en resumen
        if deltas_list:
            resumen = {
                "ALTA": sum(1 for d in deltas_list if d["tipo_delta"] == "ALTA"),
                "BAJA": sum(1 for d in deltas_list if d["tipo_delta"] == "BAJA"),
                "CAMBIO_JORNADA": sum(1 for d in deltas_list if d["tipo_delta"] == "CAMBIO_JORNADA"),
                "MULTI_SEDE": sum(1 for d in deltas_list if d["tipo_delta"] == "MULTI_SEDE"),
                "total": len(deltas_list),
            }
        else:
            resumen = {
                "ALTA": sum(1 for p in comparativa_profesionales if p["tipo_delta"] == "ALTA"),
                "BAJA": sum(1 for p in comparativa_profesionales if p["tipo_delta"] == "BAJA"),
                "CAMBIO_JORNADA": sum(1 for p in comparativa_profesionales if p["tipo_delta"] == "CAMBIO_JORNADA"),
                "MULTI_SEDE": sum(1 for p in comparativa_profesionales if p["tipo_delta"] == "MULTI_SEDE"),
                "total": sum(1 for p in comparativa_profesionales if p["tipo_delta"] != "SIN_CAMBIO"),
            }

        # 4. Meses congelados (< periodo_corte) que demuestran no-retroactividad
        congelados_rows = cur.execute(
            f"""
            SELECT
                c.periodo,
                COUNT(c.contrato_id) AS total_contratos,
                COALESCE(SUM(c.horas_semanales), 0.0) AS horas_totales,
                COALESCE(SUM(p.plan_dir_m), 0) AS plan_dir_total,
                COALESCE(SUM(p.mg_dir_m), 0) AS mg_dir_total
            FROM contratos c
            LEFT JOIN planes p ON (c.persona_id = p.persona_id AND c.it = p.it AND c.periodo = p.periodo)
            WHERE c.periodo < ? {it_filter_sql}
            GROUP BY c.periodo
            ORDER BY c.periodo ASC
            """,
            [periodo_corte] + ([it] if it is not None else []),
        ).fetchall()

        meses_congelados = [
            {
                "periodo": r["periodo"],
                "total_contratos": int(r["total_contratos"]),
                "horas_totales": round(float(r["horas_totales"] or 0.0), 2),
                "plan_dir_total": int(r["plan_dir_total"] or 0),
                "mg_dir_total": int(r["mg_dir_total"] or 0),
                "inmutable": True,
            }
            for r in congelados_rows
        ]

    return {
        "periodo_corte": periodo_corte,
        "periodo_anterior": periodo_anterior,
        "resumen": resumen,
        "deltas": deltas_list,
        "comparativa_institutos": comparativa_institutos,
        "comparativa_profesionales": comparativa_profesionales,
        "meses_congelados": meses_congelados,
    }


FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")


