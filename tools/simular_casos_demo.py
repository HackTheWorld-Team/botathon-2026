#!/usr/bin/env python3
"""
tools/simular_casos_demo.py — Simulador de casos de uso y estados para la demo en vivo (Issue #68).

Permite preparar, simular o saltar instantáneamente (< 3 s) a cualquiera de los 4 escenarios
del guion oficial de la demo sobre una ruta `--db` configurable (por defecto `backend/db.sqlite`):

  - paso1-inicial:
      Seed de catálogos + Lote 1 (`Nac - Base contratos x mes.xlsx` filtrado a Enero–Abril
      `2026-01`..`2026-04`), dejando listos en `bot/entrada/` los archivos
      `BUK_demo_invalidos.xlsx` y `BUK_Dotacion_2026_Mayo.xlsx` para Blue Prism Studio.
  - paso2-rechazos:
      Parte de `paso1-inicial` e ingesta `BUK_demo_invalidos.xlsx` (Lote 2 en estado
      `CON_RECHAZOS`, 6 registros aislados en `bot/reportes/Rejected_Records_Report.xlsx`).
  - paso3-deltas-mayo:
      Parte de `paso2-rechazos` e ingesta `BUK_Dotacion_2026_Mayo.xlsx` (Lote 3), activando
      los deltas de Mayo (`ALTA` 141845, `CAMBIO_JORNADA` 44h->42h, `MULTI_SEDE` 125129 Ant/Cal)
      con Enero–Abril congelados (no retroactividad).
  - paso4-completo:
      Parte de `paso3-deltas-mayo`, aplica cambio de parámetros auditado con vigencia desde
      `2026-05-01` (asignación `Líder Equipo` 2h->3h + distribución `MEDICO FISIATRA` T1
      65%->70% directo) y carga `SIC_Atenciones_Reales.xlsx` (Lote 4) habilitando `Plan vs. Real`.

Modo `--verificar-todo`:
  Ejecuta los 4 escenarios en secuencia sobre una BD temporal (o la indicada), consulta los
  endpoints de FastAPI (`TestClient`) en cada paso e imprime un reporte JSON y tabla resumen
  con las cifras exactas y casos estrella (`137732`, `125129`, `141845`, `115444`).
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.main import PatchParametrosRequest, app, patch_parametros
from backend.motor import CatalogosMotor, calcular_contrato_mes, calcular_distribucion_final
from backend.seed import crear_bd
from bot.worker import validar_y_procesar_buk, validar_y_procesar_sic
from tools.generar_buk_mayo import generar_buk_mayo
from tools.make_demo_invalidos import generar as generar_buk_invalidos
from tools.preparar_entorno_demo import (
    BUK_BASE_XLSX,
    SIC_REAL_XLSX,
    seed_parametros_bd,
)

ESCENARIOS_VALIDOS = (
    "paso1-inicial",
    "paso2-rechazos",
    "paso3-deltas-mayo",
    "paso4-completo",
)

_CACHED_DF_ENE_ABR: Optional[pd.DataFrame] = None


def generar_buk_base_ene_abr(destino_xlsx: Path) -> Path:
    """
    Genera una copia filtrada a Enero–Abril (2026-01-01 .. 2026-04-01) de
    `Nac - Base contratos x mes.xlsx` sin tocar jamás el Excel fuente original.
    Conserva exactamente el formato con encabezados en fila 2 (startrow=1).
    """
    global _CACHED_DF_ENE_ABR
    if _CACHED_DF_ENE_ABR is None:
        df_full = pd.read_excel(BUK_BASE_XLSX, sheet_name="Dotacion_2026", header=1)
        fechas = pd.to_datetime(df_full["Periodo"]).dt.strftime("%Y-%m-%d")
        _CACHED_DF_ENE_ABR = df_full[fechas <= "2026-04-01"].copy().reset_index(drop=True)

    destino_xlsx.parent.mkdir(parents=True, exist_ok=True)
    _CACHED_DF_ENE_ABR.to_excel(
        destino_xlsx,
        sheet_name="Dotacion_2026",
        index=False,
        startrow=1,
    )
    return destino_xlsx


def _limpiar_tablas_transaccionales(db_path: str) -> None:
    """Limpia las tablas de datos transaccionales y reinicia secuencias para idempotencia."""
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    con = crear_bd(db_path)
    try:
        for tabla in (
            "deltas",
            "rechazados",
            "planes",
            "sic_real",
            "contratos",
            "lotes",
            "auditoria_parametros",
        ):
            con.execute(f"DELETE FROM {tabla};")
        con.execute(
            "DELETE FROM sqlite_sequence WHERE name IN "
            "('deltas','rechazados','planes','sic_real','contratos','lotes','auditoria_parametros');"
        )
        con.commit()
    finally:
        con.close()


def _aplicar_cambio_parametros_paso4(db_path: str) -> List[Dict[str, Any]]:
    """
    Aplica los cambios auditados del Paso 4 con vigencia desde 2026-05-01:
      1. Asignación 'Líder Equipo' -> 3.0 h/sem (con V°B° DMN).
      2. Distribución 'MEDICO FISIATRA' Tramo 1 -> 70% Directo / 10% Indirecto / 20% NAS.
    Garantiza recálculo exclusivo desde 2026-05-01 (Enero–Abril inmutables).
    """
    prev_env = os.environ.get("BOTATHON_DB_PATH")
    os.environ["BOTATHON_DB_PATH"] = str(db_path)
    try:
        res_asig = patch_parametros(
            PatchParametrosRequest(
                nombre_asignacion="Líder Equipo",
                horas_semana=3.0,
                requiere_vb_dmn=1,
                vigencia_desde="2026-05-01",
                usuario="lider_demo",
                motivo="Demo Paso 4: ajuste asignación Líder Equipo de 2.0h a 3.0h semanales",
            )
        )
        res_dist = patch_parametros(
            PatchParametrosRequest(
                cargo="MEDICO FISIATRA",
                tramo=1,
                pct_directo=0.70,
                pct_indirecto=0.10,
                pct_nas=0.20,
                min_directa=40,
                min_indirecta=30,
                vigencia_desde="2026-05-01",
                usuario="lider_demo",
                motivo="Demo Paso 4: aumento dedicación directa MEDICO FISIATRA T1 (65% -> 70%) desde mayo",
            )
        )
        return [res_asig, res_dist]
    finally:
        if prev_env is None:
            os.environ.pop("BOTATHON_DB_PATH", None)
        else:
            os.environ["BOTATHON_DB_PATH"] = prev_env


def simular_escenario(
    escenario: str = "paso4-completo",
    db_path: str = "backend/db.sqlite",
    entrada_dir: Optional[str] = None,
    reportes_dir: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Prepara de forma determinista e idempotente el escenario solicitado sobre `db_path`.
    """
    if escenario not in ESCENARIOS_VALIDOS:
        raise ValueError(
            f"Escenario inválido '{escenario}'. Opciones válidas: {', '.join(ESCENARIOS_VALIDOS)}"
        )

    t0 = time.perf_counter()
    in_dir = Path(entrada_dir) if entrada_dir else (REPO_ROOT / "bot" / "entrada")
    out_dir = Path(reportes_dir) if reportes_dir else (REPO_ROOT / "bot" / "reportes")
    staging_dir = out_dir.parent / "procesados"
    in_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    staging_dir.mkdir(parents=True, exist_ok=True)

    # 1. Reset y seed de catálogos
    _limpiar_tablas_transaccionales(db_path)
    seed_info = seed_parametros_bd(db_path)

    # 2. Asegurar archivos de entrada para Blue Prism Studio en bot/entrada/
    invalidos_xlsx = in_dir / "BUK_demo_invalidos.xlsx"
    mayo_xlsx = in_dir / "BUK_Dotacion_2026_Mayo.xlsx"
    if not invalidos_xlsx.exists():
        generar_buk_invalidos(str(invalidos_xlsx))
    if not mayo_xlsx.exists():
        generar_buk_mayo(mayo_xlsx)

    # 3. Paso 1: Lote 1 (BUK Base filtrado a Enero–Abril 2026-01..2026-04)
    buk_ene_abr_xlsx = staging_dir / "Nac - Base contratos x mes.xlsx"
    if not buk_ene_abr_xlsx.exists():
        generar_buk_base_ene_abr(buk_ene_abr_xlsx)

    lotes_procesados: List[Dict[str, Any]] = []
    cambios_parametros: List[Dict[str, Any]] = []

    lote_1 = validar_y_procesar_buk(
        str(buk_ene_abr_xlsx),
        db_path=db_path,
        out_dir=str(out_dir),
    )
    lotes_procesados.append(lote_1)

    # 4. Paso 2: Lote 2 (BUK_demo_invalidos.xlsx con 6 rechazos aislados)
    if escenario in ("paso2-rechazos", "paso3-deltas-mayo", "paso4-completo"):
        lote_2 = validar_y_procesar_buk(
            str(invalidos_xlsx),
            db_path=db_path,
            out_dir=str(out_dir),
        )
        lotes_procesados.append(lote_2)

    # 5. Paso 3: Lote 3 (BUK_Dotacion_2026_Mayo.xlsx con deltas Mayo y Ene–Abr congelados)
    if escenario in ("paso3-deltas-mayo", "paso4-completo"):
        rep_corrupto = out_dir / "Rejected_Records_Report.xlsx"
        rep_corrupto_bytes = rep_corrupto.read_bytes() if rep_corrupto.exists() else None

        lote_3 = validar_y_procesar_buk(
            str(mayo_xlsx),
            db_path=db_path,
            out_dir=str(out_dir),
        )
        if rep_corrupto_bytes is not None:
            rep_corrupto.write_bytes(rep_corrupto_bytes)
        lotes_procesados.append(lote_3)

    # 6. Paso 4: Cambio de parámetros auditado desde 2026-05-01 + Lote 4 (SIC Real)
    if escenario == "paso4-completo":
        cambios_parametros = _aplicar_cambio_parametros_paso4(db_path)
        lote_4 = validar_y_procesar_sic(
            str(SIC_REAL_XLSX),
            db_path=db_path,
            out_dir=str(out_dir),
        )
        lotes_procesados.append(lote_4)

    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    return {
        "escenario": escenario,
        "db_path": str(db_path),
        "duracion_total_ms": elapsed_ms,
        "seed": seed_info,
        "archivos_entrada_listos": {
            "buk_invalidos": str(invalidos_xlsx),
            "buk_mayo": str(mayo_xlsx),
        },
        "lotes": lotes_procesados,
        "cambios_parametros": cambios_parametros,
    }


def _inspeccionar_casos_estrella(db_path: str) -> Dict[str, Any]:
    """
    Extrae las cifras exactas de los 4 casos estrella del desafío:
      - 137732: Médico Fisiatra 40h en Arica (IT=11) + Líder Equipo 2h (Duda 1: Dir 60,94%, Ind 14,06%).
      - 125129: Médico Fisiatra multi-sede en Mayo (Antofagasta IT=21 35h + Calama IT=22 8h).
      - 141845: Kinesiólogo alta nueva en Mayo (Arica IT=11, 42h, tope legal 2026-05-01).
      - 115444: Médico Fisiatra multi-sede caso dorado (Iquique IT=12 36h Tramo 2 + Coyhaique IT=111 6h Tramo 3).
    """
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    try:
        catalogos = CatalogosMotor.desde_db_con(con)
        # Caso 137732: Duda 1 oficial (Fisiatra 40h base 65/15/20 con 2h Líder de Equipo)
        dist_duda1 = calcular_distribucion_final(40.0, 0.65, 0.15, 0.20, 2.0)
        ate_dir_sem_137732 = int((40.0 * dist_duda1["pct_directo_final"] * 60) // 40)
        ate_ind_sem_137732 = int((40.0 * dist_duda1["pct_indirecto_final"] * 60) // 30)
        plan_dir_abril_137732 = int(ate_dir_sem_137732 * 4.2)
        mg_dir_abril_137732 = int(plan_dir_abril_137732 * 0.90)

        duda1_res = {
            "pct_directo_final": round(dist_duda1["pct_directo_final"] * 100, 4),
            "pct_indirecto_final": round(dist_duda1["pct_indirecto_final"] * 100, 4),
            "pct_nas_total": round(dist_duda1["pct_nas_total"] * 100, 4),
            "ate_dir_sem": ate_dir_sem_137732,
            "ate_ind_sem": ate_ind_sem_137732,
            "plan_dir_abril": plan_dir_abril_137732,
            "mg_dir_abril": mg_dir_abril_137732,
        }

        c137732_db = [
            dict(r)
            for r in con.execute(
                """
                SELECT c.periodo, c.it, c.cargo, c.horas_semanales,
                       p.pct_directo, p.pct_indirecto, p.pct_nas,
                       p.ate_dir_sem, p.ate_ind_sem, p.plan_dir_m, p.plan_ind_m, p.mg_dir_m
                FROM contratos c
                LEFT JOIN planes p ON (c.persona_id = p.persona_id AND c.it = p.it AND c.periodo = p.periodo)
                WHERE c.persona_id = 137732
                ORDER BY c.periodo ASC
                """
            ).fetchall()
        ]

        # Caso 125129: Multi-sede Antofagasta (IT 21) + Calama (IT 22)
        c125129_db = [
            dict(r)
            for r in con.execute(
                """
                SELECT c.periodo, c.it, i.sigla, c.cargo, c.horas_semanales,
                       p.ate_dir_sem, p.plan_dir_m, p.plan_ind_m, p.mg_dir_m
                FROM contratos c
                LEFT JOIN institutos i ON c.it = i.it
                LEFT JOIN planes p ON (c.persona_id = p.persona_id AND c.it = p.it AND c.periodo = p.periodo)
                WHERE c.persona_id = 125129
                ORDER BY c.periodo ASC, c.it ASC
                """
            ).fetchall()
        ]

        # Caso 141845: Alta nueva Mayo 42h
        c141845_db = [
            dict(r)
            for r in con.execute(
                """
                SELECT c.periodo, c.it, i.sigla, c.cargo, c.horas_semanales,
                       p.ate_dir_sem, p.plan_dir_m, p.plan_ind_m, p.mg_dir_m
                FROM contratos c
                LEFT JOIN institutos i ON c.it = i.it
                LEFT JOIN planes p ON (c.persona_id = p.persona_id AND c.it = p.it AND c.periodo = p.periodo)
                WHERE c.persona_id = 141845
                ORDER BY c.periodo ASC, c.it ASC
                """
            ).fetchall()
        ]

        # Caso 115444: Caso dorado Tramo 2 (Iqu 36h) + Multi-sede Excepciones (Coy 6h)
        c115444_db = [
            dict(r)
            for r in con.execute(
                """
                SELECT c.periodo, c.it, i.sigla, c.cargo, c.horas_semanales,
                       p.ate_dir_sem, p.plan_dir_m, p.plan_ind_m, p.mg_dir_m
                FROM contratos c
                LEFT JOIN institutos i ON c.it = i.it
                LEFT JOIN planes p ON (c.persona_id = p.persona_id AND c.it = p.it AND c.periodo = p.periodo)
                WHERE c.persona_id = 115444
                ORDER BY c.periodo ASC, c.it ASC
                """
            ).fetchall()
        ]
        c115444_coy_6h = calcular_contrato_mes(
            persona_id=115444,
            it=111,
            periodo="2026-04-01",
            cargo="MEDICO FISIATRA",
            cod_esp="FI",
            horas_semanales=6.0,
            catalogos=catalogos,
        )

        return {
            "137732": {
                "duda1_con_2h_lider_equipo": duda1_res,
                "contratos_bd": c137732_db,
            },
            "125129": {
                "contratos_bd": c125129_db,
            },
            "141845": {
                "contratos_bd": c141845_db,
            },
            "115444": {
                "contratos_bd": c115444_db,
                "excepcion_coyhaique_6h": {
                    "it": 111,
                    "sigla": "Coy",
                    "horas_semanales": 6.0,
                    "tramo": c115444_coy_6h["tramo"],
                    "ate_dir_sem": c115444_coy_6h["ate_dir_sem"],
                    "ate_ind_sem": c115444_coy_6h["ate_ind_sem"],
                    "plan_dir_abril": c115444_coy_6h["plan_dir_m"],
                    "mg_dir_abril": c115444_coy_6h["mg_dir_m"],
                },
            },
        }
    finally:
        con.close()


def verificar_todos_los_escenarios(
    db_path: Optional[str] = None,
    entrada_dir: Optional[str] = None,
    reportes_dir: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Ejecuta en secuencia los 4 escenarios de la demo, consulta los endpoints de FastAPI
    con TestClient en cada paso y retorna el reporte estructurado completo.
    """
    from fastapi.testclient import TestClient

    tmpdir_obj = None
    if db_path is None:
        tmpdir_obj = tempfile.TemporaryDirectory(
            prefix="botathon_sim_demo_", ignore_cleanup_errors=True
        )
        base_tmp = Path(tmpdir_obj.name)
        target_db = str(base_tmp / "demo_verificacion.sqlite")
        target_in = str(base_tmp / "entrada") if entrada_dir is None else entrada_dir
        target_rep = str(base_tmp / "reportes") if reportes_dir is None else reportes_dir
    else:
        target_db = db_path
        target_in = entrada_dir
        target_rep = reportes_dir

    prev_env = os.environ.get("BOTATHON_DB_PATH")
    os.environ["BOTATHON_DB_PATH"] = target_db

    reporte_pasos: Dict[str, Any] = {}
    try:
        for esc in ESCENARIOS_VALIDOS:
            sim_res = simular_escenario(
                escenario=esc,
                db_path=target_db,
                entrada_dir=target_in,
                reportes_dir=target_rep,
            )
            with TestClient(app) as client:
                kpis_global = client.get("/api/kpis").json()
                kpis_enero = client.get("/api/kpis?periodo=2026-01-01").json()
                kpis_abril = client.get("/api/kpis?periodo=2026-04-01").json()
                kpis_mayo = client.get("/api/kpis?periodo=2026-05-01").json()
                filtros = client.get("/api/filtros").json()
                lotes = client.get("/api/lotes").json()
                deltas_mayo = client.get("/api/deltas?periodo_corte=2026-05-01").json()
                parametros = client.get("/api/parametros").json()
                pvr_abril = client.get("/api/plan-vs-real?periodo=2026-04-01&agrupado=true").json()
                pvr_mayo = client.get("/api/plan-vs-real?periodo=2026-05-01&agrupado=true").json()

                rechazados_lote2 = None
                for l in lotes:
                    if l["rechazados"] > 0:
                        rechazados_lote2 = client.get(f"/api/lotes/{l['lote_id']}/rechazados").json()
                        break

            casos_estrella = _inspeccionar_casos_estrella(target_db)

            # Resumen de alertas Plan vs Real en abril y mayo
            def _resumir_pvr(items: List[Dict[str, Any]]) -> Dict[str, Any]:
                plan_tot = sum(i["plan_directo"] for i in items)
                real_tot = sum(i["real_directo"] for i in items)
                mg_tot = sum(i["meta_gestion"] for i in items)
                cump = round((real_tot / plan_tot * 100.0), 1) if plan_tot > 0 else 0.0
                niveles = {"CRITICO": 0, "CUMPLIDO": 0, "SUPERAVIT": 0, "SIN_PLAN": 0}
                for i in items:
                    niv = i.get("alerta", {}).get("nivel", "SIN_PLAN")
                    niveles[niv] = niveles.get(niv, 0) + 1
                return {
                    "grupos": len(items),
                    "plan_directo_total": plan_tot,
                    "real_directo_total": real_tot,
                    "meta_gestion_total": mg_tot,
                    "cumplimiento_pct": cump,
                    "alertas_por_nivel": niveles,
                }

            reporte_pasos[esc] = {
                "duracion_ms": sim_res["duracion_total_ms"],
                "periodos_disponibles": filtros["periodos"],
                "total_lotes": len(lotes),
                "lotes": lotes,
                "kpis_global": kpis_global,
                "kpis_enero": kpis_enero,
                "kpis_abril": kpis_abril,
                "kpis_mayo": kpis_mayo,
                "rechazados_lote2": {
                    "total_rechazados": rechazados_lote2["total_rechazados"] if rechazados_lote2 else 0,
                    "resumen_reglas": rechazados_lote2["resumen_reglas"] if rechazados_lote2 else [],
                },
                "deltas_mayo": {
                    "resumen": deltas_mayo["resumen"],
                    "meses_congelados": deltas_mayo["meses_congelados"],
                },
                "auditoria_parametros": parametros["auditoria"],
                "plan_vs_real_abril": _resumir_pvr(pvr_abril),
                "plan_vs_real_mayo": _resumir_pvr(pvr_mayo),
                "casos_estrella": casos_estrella,
            }

        return {
            "verificacion_ok": True,
            "escenarios": reporte_pasos,
        }
    finally:
        if prev_env is None:
            os.environ.pop("BOTATHON_DB_PATH", None)
        else:
            os.environ["BOTATHON_DB_PATH"] = prev_env
        if tmpdir_obj is not None:
            tmpdir_obj.cleanup()


def _imprimir_tabla_resumen(reporte: Dict[str, Any]) -> None:
    """Imprime en consola una tabla legible con las métricas exactas de los 4 escenarios."""
    print("=" * 108)
    print(" RESUMEN DE VERIFICACIÓN E2E — 4 ESCENARIOS DE DEMO (Botathon 2026)")
    print("=" * 108)
    header = (
        f"{'Escenario':<20} | {'Lotes':>5} | {'Contratos':>9} | {'% FOJA':>7} | "
        f"{'Plan Dir':>9} | {'Plan Tot':>9} | {'MG 90%':>8} | {'Rechazos':>8} | {'Deltas May':>10} | {'Audit':>5}"
    )
    print(header)
    print("-" * 108)
    for esc, data in reporte["escenarios"].items():
        kg = data["kpis_global"]
        rech = data["rechazados_lote2"]["total_rechazados"]
        deltas_tot = data["deltas_mayo"]["resumen"]["total"]
        audit_cnt = len(data["auditoria_parametros"])
        print(
            f"{esc:<20} | {data['total_lotes']:>5} | {kg['total_contratos']:>9} | "
            f"{kg['foja_pct']:>6.2f}% | {kg['plan_directo_mensual']:>9} | "
            f"{kg['plan_total_mensual']:>9} | {kg['meta_gestion_mensual']:>8} | "
            f"{rech:>8} | {deltas_tot:>10} | {audit_cnt:>5}"
        )
    print("=" * 108)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Simulador de casos de uso y saltos de estado para la demo en vivo (Issue #68)."
    )
    parser.add_argument(
        "--db",
        default="backend/db.sqlite",
        help="Ruta a la base de datos SQLite (default: backend/db.sqlite)",
    )
    parser.add_argument(
        "--escenario",
        choices=list(ESCENARIOS_VALIDOS),
        default="paso4-completo",
        help="Escenario de la demo a materializar en la base de datos.",
    )
    parser.add_argument(
        "--entrada-dir",
        default=None,
        help="Directorio de entrada para insumos del bot (default: bot/entrada).",
    )
    parser.add_argument(
        "--reportes-dir",
        default=None,
        help="Directorio de salida de reportes del bot (default: bot/reportes).",
    )
    parser.add_argument(
        "--verificar-todo",
        action="store_true",
        help="Ejecuta los 4 escenarios en una BD temporal, valida endpoints FastAPI e imprime reporte.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Imprime la salida únicamente en formato JSON.",
    )
    args = parser.parse_args()

    if args.verificar_todo:
        rep = verificar_todos_los_escenarios(
            db_path=None,
            entrada_dir=args.entrada_dir,
            reportes_dir=args.reportes_dir,
        )
        if not args.json:
            _imprimir_tabla_resumen(rep)
        print(json.dumps(rep, indent=2, ensure_ascii=False))
        return

    res = simular_escenario(
        escenario=args.escenario,
        db_path=args.db,
        entrada_dir=args.entrada_dir,
        reportes_dir=args.reportes_dir,
    )
    if args.json:
        print(json.dumps(res, indent=2, ensure_ascii=False))
    else:
        print(
            f"[OK] Escenario '{res['escenario']}' preparado en '{res['db_path']}' "
            f"({res['duracion_total_ms']} ms)."
        )
        for lote in res["lotes"]:
            print(
                f"  - Lote #{lote['lote_id']} [{lote['tipo']}] {lote['archivo']}: "
                f"estado={lote['estado']} · válidos={lote['validos']} · rechazados={lote['rechazados']}"
            )
        if res["cambios_parametros"]:
            print(f"  - Cambios de parámetros auditados aplicados: {len(res['cambios_parametros'])}")


if __name__ == "__main__":
    main()
