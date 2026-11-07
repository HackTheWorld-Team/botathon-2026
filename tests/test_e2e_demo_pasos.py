"""
tests/test_e2e_demo_pasos.py — Suite integral E2E de los 4 pasos de la demo oficial (Issue #66).

Verifica secuencialmente sobre un entorno temporal aislado (tmp_path, sin tocar backend/db.sqlite):
  - Paso 1: Dashboard inicial Enero–Abril 2026 (seed + ingesta BUK Ene–Abr -> KPIs, filtros, lotes).
  - Paso 2: Bot + Archivo corrupto (make_demo_invalidos -> 6 anomalías aisladas, reporte Excel y endpoints).
  - Paso 3: Carga Mayo 2026 + Transición 42h + No Retroactividad (deltas ALTA 141845, 44h->42h,
            MULTI_SEDE 125129 Ant+Cal, inmutabilidad Ene–Abr y comparativa Antes/Después).
  - Paso 4: Parametrización en vivo + Simulación (con/sin vacantes 1.047h sin mutar BD) + PATCH no
            retroactivo con auditoría + Ingesta SIC Real y cruce Plan vs Real con doble codificación WCAG.
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path
from typing import Any, Dict, Tuple

import pandas as pd
import pytest
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.main import app
from bot.worker import procesar_archivo, validar_y_procesar_sic
from tools.generar_buk_mayo import generar_buk_mayo
from tools.make_demo_invalidos import generar as generar_archivo_invalido
from tools.preparar_entorno_demo import (
    BUK_BASE_XLSX,
    SIC_REAL_XLSX,
    seed_parametros_bd,
)


def _crear_buk_ene_abr(destino: Path) -> Path:
    """Genera un archivo BUK filtrado únicamente a Enero–Abril 2026 (2026-01-01 a 2026-04-01)."""
    df = pd.read_excel(BUK_BASE_XLSX, sheet_name="Dotacion_2026", header=1)
    schema = df.columns.tolist()
    df_ene_abr = df[df["Periodo"] <= "2026-04-01"].copy().reset_index(drop=True)

    destino.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(destino, engine="openpyxl") as writer:
        df_ene_abr.to_excel(writer, sheet_name="Dotacion_2026", index=False, startrow=1)
        ws = writer.sheets["Dotacion_2026"]
        for col_idx, col_name in enumerate(schema, 1):
            ws.cell(row=1, column=col_idx, value=col_name)
    return destino


def _snapshot_planes_ene_abr(db_path: str) -> Dict[str, Tuple[int, int, int]]:
    """Retorna {periodo: (count, sum_plan_dir_m, sum_mg_dir_m)} para Enero–Abril."""
    with sqlite3.connect(db_path) as con:
        rows = con.execute(
            """
            SELECT periodo, COUNT(*), COALESCE(SUM(plan_dir_m), 0), COALESCE(SUM(mg_dir_m), 0)
            FROM planes
            WHERE periodo < '2026-05-01'
            GROUP BY periodo
            ORDER BY periodo ASC
            """
        ).fetchall()
    return {r[0]: (int(r[1]), int(r[2]), int(r[3])) for r in rows}


@pytest.fixture(scope="module")
def demo_env(tmp_path_factory: pytest.TempPathFactory) -> Dict[str, Any]:
    """Entorno temporal aislado compartido secuencialmente por los 4 pasos de la demo."""
    base_dir = tmp_path_factory.mktemp("demo_e2e_pasos")
    db_path = base_dir / "demo_pasos_e2e.sqlite"
    entrada_dir = base_dir / "entrada"
    reportes_dir = base_dir / "reportes"
    entrada_dir.mkdir(parents=True, exist_ok=True)
    reportes_dir.mkdir(parents=True, exist_ok=True)
    return {
        "base_dir": base_dir,
        "db_path": db_path,
        "entrada_dir": entrada_dir,
        "reportes_dir": reportes_dir,
        "snapshot_ene_abr": {},
        "lote_corrupto_id": None,
    }


def test_paso_1_dashboard_inicial_ene_abr(
    demo_env: Dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """
    Paso 1 (Dashboard inicial Ene–Abr):
    - Seed de catálogos + ingesta BUK filtrada a Enero–Abril (2026-01..2026-04) con procesar_archivo.
    - Verifica GET /api/kpis, GET /api/filtros (institutos, 4 meses iniciales) y GET /api/lotes (1 lote OK).
    """
    db_path = demo_env["db_path"]
    entrada_dir = demo_env["entrada_dir"]
    reportes_dir = demo_env["reportes_dir"]

    monkeypatch.chdir(REPO_ROOT)
    monkeypatch.setenv("BOTATHON_DB_PATH", str(db_path))

    seed_info = seed_parametros_bd(str(db_path))
    assert seed_info["institutos"] >= 15
    assert seed_info["semanas_habiles"] == 12
    assert seed_info["parametros_distribucion"] >= 50
    assert seed_info["parametros_grupal"] == 5

    buk_ene_abr_xlsx = _crear_buk_ene_abr(entrada_dir / "BUK_Enero_Abril_2026.xlsx")
    res_paso1 = procesar_archivo(
        str(buk_ene_abr_xlsx),
        db_path=str(db_path),
        out_dir=str(reportes_dir / "paso1"),
    )

    assert res_paso1["estado"] == "OK"
    assert res_paso1["tipo"] == "BUK"
    assert res_paso1["rechazados"] == 0
    assert res_paso1["validos"] == 1785
    assert res_paso1["periodos_afectados"] == [
        "2026-01-01",
        "2026-02-01",
        "2026-03-01",
        "2026-04-01",
    ]

    snapshot_inicial = _snapshot_planes_ene_abr(str(db_path))
    assert len(snapshot_inicial) == 4
    demo_env["snapshot_ene_abr"] = snapshot_inicial

    with TestClient(app) as client:
        resp_kpis = client.get("/api/kpis")
        assert resp_kpis.status_code == 200
        kpis = resp_kpis.json()
        assert kpis["foja_pct"] > 0
        assert kpis["meta_gestion_mensual"] > 0
        assert kpis["plan_directo_mensual"] > 0
        assert kpis["plan_total_mensual"] > 0
        assert kpis["horas_directas_semanales"] > 0
        assert kpis["horas_indirectas_semanales"] > 0
        assert kpis["horas_nas_semanales"] > 0
        assert kpis["horas_contratadas_semanales"] > 0

        resp_filtros = client.get("/api/filtros")
        assert resp_filtros.status_code == 200
        filtros = resp_filtros.json()
        assert len(filtros["institutos"]) >= 15
        assert filtros["periodos"] == [
            "2026-01-01",
            "2026-02-01",
            "2026-03-01",
            "2026-04-01",
        ]
        assert len(filtros["cargos"]) > 0
        assert len(filtros["especialidades"]) > 0

        resp_lotes = client.get("/api/lotes")
        assert resp_lotes.status_code == 200
        lotes = resp_lotes.json()
        assert len(lotes) == 1
        assert lotes[0]["validos"] == 1785
        assert lotes[0]["rechazados"] == 0


def test_paso_2_bot_archivo_corrupto_6_anomalias(
    demo_env: Dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """
    Paso 2 (Bot + Archivo corrupto):
    - Genera archivo corrupto con make_demo_invalidos e ingesta con bot.worker.procesar_archivo.
    - Verifica estado == 'CON_RECHAZOS', rechazados == 6, Rejected_Records_Report.xlsx con las 6 anomalías,
      y que GET /api/lotes/{id}/rechazados y GET /api/lotes/{id}/reporte-rechazos responden 200 OK.
    """
    db_path = demo_env["db_path"]
    entrada_dir = demo_env["entrada_dir"]
    reportes_dir = demo_env["reportes_dir"]

    monkeypatch.chdir(REPO_ROOT)
    monkeypatch.setenv("BOTATHON_DB_PATH", str(db_path))

    corrupto_xlsx = entrada_dir / "BUK_demo_invalidos.xlsx"
    generar_archivo_invalido(str(corrupto_xlsx))
    assert corrupto_xlsx.exists()

    res_paso2 = procesar_archivo(
        str(corrupto_xlsx),
        db_path=str(db_path),
        out_dir=str(reportes_dir / "paso2"),
    )
    assert res_paso2["estado"] == "CON_RECHAZOS"
    assert res_paso2["rechazados"] == 6
    assert res_paso2["validos"] == 445
    lote_corrupto_id = res_paso2["lote_id"]
    demo_env["lote_corrupto_id"] = lote_corrupto_id

    reporte_rechazos_path = reportes_dir / "paso2" / "Rejected_Records_Report.xlsx"
    assert reporte_rechazos_path.exists()
    df_rech = pd.read_excel(reporte_rechazos_path)
    assert len(df_rech) == 6
    motivos_excel = set(df_rech["Motivo"].tolist())
    motivos_esperados = {
        "NEGATIVE_HS",  # HORAS_NEGATIVAS
        "TEXT_HS",      # FORMATO_NUMERICO_INVALIDO
        "BAD_IT",       # IT_NO_EXISTE
        "BAD_ESP",      # COD_ESP_NO_EXISTE
        "DUP_PK",       # DUPLICADO_PK
        "HS_OVER",      # JORNADA_EXCEDE_MAXIMO
    }
    assert motivos_excel == motivos_esperados

    with TestClient(app) as client:
        resp_rech = client.get(f"/api/lotes/{lote_corrupto_id}/rechazados")
        assert resp_rech.status_code == 200
        data_rech = resp_rech.json()
        assert data_rech["total_rechazados"] == 6
        assert {r["motivo"] for r in data_rech["resumen_reglas"]} == motivos_esperados

        resp_rep = client.get(f"/api/lotes/{lote_corrupto_id}/reporte-rechazos")
        assert resp_rep.status_code == 200
        assert len(resp_rep.content) > 0


def test_paso_3_carga_mayo_42h_deltas_y_no_retroactividad(
    demo_env: Dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """
    Paso 3 (Carga Mayo 2026 + Transición 42h + No Retroactividad):
    - Genera e ingesta BUK Mayo 2026 (generar_buk_mayo).
    - Verifica vía GET /api/deltas que se detectan ALTA (141845), CAMBIO_JORNADA (44h -> 42h) y
      MULTI_SEDE (125129), que meses_congelados (2026-01..2026-04) tienen diferencia == 0 e inmutable is True,
      y que comparativa_institutos y comparativa_profesionales retornan Antes/Después completo.
    """
    db_path = demo_env["db_path"]
    entrada_dir = demo_env["entrada_dir"]
    reportes_dir = demo_env["reportes_dir"]
    snapshot_inicial = demo_env["snapshot_ene_abr"]

    monkeypatch.chdir(REPO_ROOT)
    monkeypatch.setenv("BOTATHON_DB_PATH", str(db_path))

    mayo_xlsx = generar_buk_mayo(entrada_dir / "BUK_Dotacion_2026_Mayo.xlsx")
    assert Path(mayo_xlsx).exists()

    res_paso3 = procesar_archivo(
        str(mayo_xlsx),
        db_path=str(db_path),
        out_dir=str(reportes_dir / "paso3"),
    )
    assert res_paso3["estado"] == "OK"
    assert res_paso3["validos"] == 450
    assert res_paso3["rechazados"] == 0
    assert res_paso3["deltas"]["altas"] >= 1
    assert res_paso3["deltas"]["cambios_jornada"] >= 140
    assert res_paso3["deltas"]["multi_sede"] >= 2

    with TestClient(app) as client:
        resp_deltas = client.get("/api/deltas?periodo_corte=2026-05-01")
        assert resp_deltas.status_code == 200
        deltas_data = resp_deltas.json()

        assert deltas_data["periodo_corte"] == "2026-05-01"
        assert deltas_data["periodo_anterior"] == "2026-04-01"
        assert deltas_data["resumen"]["ALTA"] >= 1
        assert deltas_data["resumen"]["CAMBIO_JORNADA"] >= 140
        assert deltas_data["resumen"]["MULTI_SEDE"] >= 2

        deltas_items = deltas_data["deltas"]
        assert any(
            d["persona_id"] == 141845 and d["tipo_delta"] == "ALTA"
            for d in deltas_items
        )
        assert any(
            d["tipo_delta"] == "CAMBIO_JORNADA"
            and "44" in str(d["valor_anterior"])
            and "42" in str(d["valor_nuevo"])
            for d in deltas_items
        )
        multi_125129 = [
            d for d in deltas_items
            if d["persona_id"] == 125129 and d["tipo_delta"] == "MULTI_SEDE"
        ]
        assert {d["it"] for d in multi_125129} == {21, 22}

        snapshot_post_mayo = _snapshot_planes_ene_abr(str(db_path))
        assert snapshot_post_mayo == snapshot_inicial

        meses_congelados = deltas_data["meses_congelados"]
        assert [m["periodo"] for m in meses_congelados] == [
            "2026-01-01",
            "2026-02-01",
            "2026-03-01",
            "2026-04-01",
        ]
        for m in meses_congelados:
            per = m["periodo"]
            count_ini, plan_dir_ini, mg_ini = snapshot_inicial[per]
            assert m["inmutable"] is True
            assert m["total_contratos"] - count_ini == 0
            assert m["plan_dir_total"] - plan_dir_ini == 0
            assert m["mg_dir_total"] - mg_ini == 0

        assert len(deltas_data["comparativa_institutos"]) >= 15
        assert len(deltas_data["comparativa_profesionales"]) >= 450
        prof_125129 = [
            p for p in deltas_data["comparativa_profesionales"]
            if p["persona_id"] == 125129
        ]
        assert len(prof_125129) == 2
        assert all(p["tipo_delta"] == "MULTI_SEDE" for p in prof_125129)


def test_paso_4_parametrizacion_simulacion_y_capa_sic_real(
    demo_env: Dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """
    Paso 4 (Parametrización en vivo + Simulación + Capa SIC Real):
    - POST /api/parametros/simular con incluir_vacantes=False vs True (1.047h semanales) sin mutar BD.
    - PATCH /api/parametros cambiando % Directo y horas_semana de asignación con vigencia_desde='2026-05-01',
      verificando no-retroactividad Ene–Abr, recálculo de Mayo y registro en auditoria.
    - Ingesta SIC_Atenciones_Reales.xlsx con validar_y_procesar_sic y verifica GET /api/plan-vs-real
      (por especialidad y por profesional) con alertas WCAG (icono + badge + mensaje).
    """
    db_path = demo_env["db_path"]
    reportes_dir = demo_env["reportes_dir"]
    snapshot_inicial = demo_env["snapshot_ene_abr"]

    monkeypatch.chdir(REPO_ROOT)
    monkeypatch.setenv("BOTATHON_DB_PATH", str(db_path))

    with TestClient(app) as client:
        # 4.1 Simulación sin vacantes vs con vacantes (1.047h semanales) sin mutar la BD
        sim_sin_vac_resp = client.post(
            "/api/parametros/simular",
            json={
                "cargo": "MEDICO FISIATRA",
                "tramo": 1,
                "pct_directo": 0.70,
                "pct_indirecto": 0.15,
                "pct_nas": 0.15,
                "min_directa": 30,
                "min_indirecta": 30,
                "vigencia_desde": "2026-05-01",
                "incluir_vacantes": False,
                "horas_vacantes_semanales": 0.0,
            },
        )
        assert sim_sin_vac_resp.status_code == 200
        sim_sin_vac = sim_sin_vac_resp.json()

        sim_con_vac_resp = client.post(
            "/api/parametros/simular",
            json={
                "cargo": "MEDICO FISIATRA",
                "tramo": 1,
                "pct_directo": 0.70,
                "pct_indirecto": 0.15,
                "pct_nas": 0.15,
                "min_directa": 30,
                "min_indirecta": 30,
                "vigencia_desde": "2026-05-01",
                "incluir_vacantes": True,
                "horas_vacantes_semanales": 1047.0,
            },
        )
        assert sim_con_vac_resp.status_code == 200
        sim_con_vac = sim_con_vac_resp.json()
        assert sim_con_vac["plan_dir_simulado"] > sim_sin_vac["plan_dir_simulado"]
        assert sim_con_vac["mg_dir_simulado"] > sim_sin_vac["mg_dir_simulado"]

        kpis_mayo_pre_patch = client.get("/api/kpis?periodo=2026-05-01").json()
        assert kpis_mayo_pre_patch["plan_directo_mensual"] == sim_sin_vac["plan_dir_actual"]

        # 4.2 PATCH /api/parametros (% Directo y horas_semana de asignación con vigencia 2026-05-01)
        patch_dist_resp = client.patch(
            "/api/parametros",
            json={
                "cargo": "MEDICO FISIATRA",
                "tramo": 1,
                "pct_directo": 0.75,
                "pct_indirecto": 0.10,
                "pct_nas": 0.15,
                "min_directa": 30,
                "min_indirecta": 30,
                "vigencia_desde": "2026-05-01",
                "usuario": "lider_clinico",
                "motivo": "Ajuste demo Paso 4",
            },
        )
        assert patch_dist_resp.status_code == 200
        patch_dist = patch_dist_resp.json()
        assert patch_dist["status"] == "ok"
        assert patch_dist["planes_recalculados"] == 450
        assert patch_dist["periodos_recalculados"] == ["2026-05-01"]
        assert patch_dist["periodos_inmutables"] == [
            "2026-01-01",
            "2026-02-01",
            "2026-03-01",
            "2026-04-01",
        ]

        patch_asig_resp = client.patch(
            "/api/parametros",
            json={
                "nombre_asignacion": "Coordinación Clínica Demo",
                "horas_semana": 6.0,
                "requiere_vb_dmn": 1,
                "vigencia_desde": "2026-05-01",
                "usuario": "lider_clinico",
                "motivo": "Actualización asignación demo",
            },
        )
        assert patch_asig_resp.status_code == 200
        assert patch_asig_resp.json()["auditoria"]["tipo_cambio"] == "ASIGNACION"

        snapshot_post_patch = _snapshot_planes_ene_abr(str(db_path))
        assert snapshot_post_patch == snapshot_inicial

        kpis_mayo_post_patch = client.get("/api/kpis?periodo=2026-05-01").json()
        assert kpis_mayo_post_patch["plan_directo_mensual"] != kpis_mayo_pre_patch["plan_directo_mensual"]

        params_data = client.get("/api/parametros").json()
        assert len(params_data["auditoria"]) >= 2
        assert any(a["usuario"] == "lider_clinico" for a in params_data["auditoria"])

        # 4.3 Ingesta SIC_Atenciones_Reales.xlsx y verificación de GET /api/plan-vs-real
        res_sic = validar_y_procesar_sic(
            str(SIC_REAL_XLSX),
            db_path=str(db_path),
            out_dir=str(reportes_dir / "paso4_sic"),
        )
        assert res_sic["estado"] == "OK"
        assert res_sic["validos"] == 3123
        assert res_sic["rechazados"] == 0

        resp_pvr_esp = client.get("/api/plan-vs-real?periodo=2026-04-01&agrupado=true")
        assert resp_pvr_esp.status_code == 200
        pvr_esp = resp_pvr_esp.json()
        assert len(pvr_esp) > 0
        for item in pvr_esp:
            alerta = item["alerta"]
            assert alerta["nivel"] in {"CRITICO", "CUMPLIDO", "SUPERAVIT", "SIN_PLAN"}
            assert alerta["icono"] in {"⚠️", "✅", "📈", "ℹ️"}
            assert len(alerta["badge"]) > 0
            assert len(alerta["mensaje"]) > 0

        resp_pvr_prof = client.get("/api/plan-vs-real?periodo=2026-04-01&agrupado=false")
        assert resp_pvr_prof.status_code == 200
        pvr_prof = resp_pvr_prof.json()
        assert len(pvr_prof) >= 445
        assert all(item["persona_id"] is not None for item in pvr_prof)
        niveles_prof = {item["alerta"]["nivel"] for item in pvr_prof}
        assert len(niveles_prof.intersection({"CRITICO", "CUMPLIDO", "SUPERAVIT"})) >= 2
