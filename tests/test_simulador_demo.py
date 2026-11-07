"""
tests/test_simulador_demo.py — Pruebas automatizadas del simulador de estados de demo (Issue #68).

Valida sobre `tmp_path`:
1. Escenario `paso1-inicial`: Lote 1 BUK filtrado a Enero–Abril (`2026-01`..`2026-04`) + insumos listos en `entrada/`.
2. Escenario `paso2-rechazos`: Lote 2 `CON_RECHAZOS` con 6 errores aislados y `Rejected_Records_Report.xlsx`.
3. Escenario `paso3-deltas-mayo`: Lote 3 BUK Mayo 42h con deltas (`ALTA` 141845, 140 `CAMBIO_JORNADA`, `MULTI_SEDE` 125129) y Enero–Abril congelados.
4. Escenario `paso4-completo`: Cambio de parámetros auditado desde `2026-05-01` + Lote 4 SIC Real (`Plan vs. Real`).
5. Modo `--verificar-todo` (`verificar_todos_los_escenarios`): reporte consolidado y casos estrella (`137732`, `125129`, `141845`, `115444`).
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from tools.simular_casos_demo import (
    ESCENARIOS_VALIDOS,
    simular_escenario,
    verificar_todos_los_escenarios,
)


def test_escenarios_secuenciales_en_tmp_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Valida los 4 escenarios de la demo real y su consistencia con los endpoints FastAPI."""
    db_file = tmp_path / "sim_demo.sqlite"
    in_dir = tmp_path / "entrada"
    rep_dir = tmp_path / "reportes"

    monkeypatch.setenv("BOTATHON_DB_PATH", str(db_file))

    # --- PASO 1: INICIAL (Enero–Abril) ---
    res1 = simular_escenario(
        escenario="paso1-inicial",
        db_path=str(db_file),
        entrada_dir=str(in_dir),
        reportes_dir=str(rep_dir),
    )
    assert res1["escenario"] == "paso1-inicial"
    assert len(res1["lotes"]) == 1
    assert res1["lotes"][0]["estado"] == "OK"
    assert res1["lotes"][0]["rechazados"] == 0
    assert (in_dir / "BUK_demo_invalidos.xlsx").exists()
    assert (in_dir / "BUK_Dotacion_2026_Mayo.xlsx").exists()

    with TestClient(app) as client:
        filtros1 = client.get("/api/filtros").json()
        assert filtros1["periodos"] == [
            "2026-01-01",
            "2026-02-01",
            "2026-03-01",
            "2026-04-01",
        ]
        kpis_abril_p1 = client.get("/api/kpis?periodo=2026-04-01").json()
        assert kpis_abril_p1["total_contratos"] == 448
        assert kpis_abril_p1["foja_pct"] > 0
        assert kpis_abril_p1["plan_directo_mensual"] > 0

    # --- PASO 2: RECHAZOS (BUK_demo_invalidos.xlsx) ---
    res2 = simular_escenario(
        escenario="paso2-rechazos",
        db_path=str(db_file),
        entrada_dir=str(in_dir),
        reportes_dir=str(rep_dir),
    )
    assert res2["escenario"] == "paso2-rechazos"
    assert len(res2["lotes"]) == 2
    assert res2["lotes"][1]["estado"] == "CON_RECHAZOS"
    assert res2["lotes"][1]["validos"] == 445
    assert res2["lotes"][1]["rechazados"] == 6

    reporte_xlsx = rep_dir / "Rejected_Records_Report.xlsx"
    assert reporte_xlsx.exists()
    df_rech = pd.read_excel(reporte_xlsx)
    assert len(df_rech) == 6

    with TestClient(app) as client:
        rech2 = client.get("/api/lotes/2/rechazados").json()
        assert rech2["total_rechazados"] == 6
        motivos = {r["motivo"] for r in rech2["resumen_reglas"]}
        assert motivos == {"NEGATIVE_HS", "TEXT_HS", "BAD_IT", "DUP_PK", "HS_OVER", "BAD_ESP"}

    # --- PASO 3: DELTAS MAYO (BUK_Dotacion_2026_Mayo.xlsx) ---
    res3 = simular_escenario(
        escenario="paso3-deltas-mayo",
        db_path=str(db_file),
        entrada_dir=str(in_dir),
        reportes_dir=str(rep_dir),
    )
    assert res3["escenario"] == "paso3-deltas-mayo"
    assert len(res3["lotes"]) == 3
    assert res3["lotes"][2]["estado"] == "OK"
    assert res3["lotes"][2]["validos"] == 450
    assert res3["lotes"][2]["rechazados"] == 0
    # El reporte de rechazos del Paso 2 se preserva en disco para mostrarlo en cualquier momento
    assert len(pd.read_excel(reporte_xlsx)) == 6

    with TestClient(app) as client:
        deltas = client.get("/api/deltas?periodo_corte=2026-05-01").json()
        assert deltas["resumen"]["ALTA"] >= 1
        assert deltas["resumen"]["CAMBIO_JORNADA"] == 140
        assert deltas["resumen"]["MULTI_SEDE"] == 2
        assert len(deltas["meses_congelados"]) == 4
        assert all(m["inmutable"] is True for m in deltas["meses_congelados"])

        # Verificar casos estrella 141845 (ALTA) y 125129 (MULTI_SEDE Ant/Cal)
        pids_deltas = {(d["persona_id"], d["tipo_delta"]) for d in deltas["deltas"]}
        assert (141845, "ALTA") in pids_deltas
        assert (125129, "MULTI_SEDE") in pids_deltas
        multi_125129_its = {d["it"] for d in deltas["deltas"] if d["persona_id"] == 125129}
        assert multi_125129_its == {21, 22}

        # No-retroactividad: Abril en Paso 3 es idéntico a Abril en Paso 1
        kpis_abril_p3 = client.get("/api/kpis?periodo=2026-04-01").json()
        assert kpis_abril_p3 == kpis_abril_p1
        kpis_mayo_p3 = client.get("/api/kpis?periodo=2026-05-01").json()
        assert kpis_mayo_p3["total_contratos"] == 450

    # --- PASO 4: COMPLETO (Parámetros auditados + SIC Real) ---
    res4 = simular_escenario(
        escenario="paso4-completo",
        db_path=str(db_file),
        entrada_dir=str(in_dir),
        reportes_dir=str(rep_dir),
    )
    assert res4["escenario"] == "paso4-completo"
    assert len(res4["lotes"]) == 4
    assert res4["lotes"][3]["tipo"] == "SIC"
    assert res4["lotes"][3]["validos"] == 3123
    assert len(res4["cambios_parametros"]) == 2

    with TestClient(app) as client:
        params = client.get("/api/parametros").json()
        assert len(params["auditoria"]) == 2
        tipos_audit = {a["tipo_cambio"] for a in params["auditoria"]}
        assert tipos_audit == {"ASIGNACION", "DISTRIBUCION"}

        # No-retroactividad: Abril en Paso 4 sigue 100% congelado
        kpis_abril_p4 = client.get("/api/kpis?periodo=2026-04-01").json()
        assert kpis_abril_p4 == kpis_abril_p1

        # Mayo sí aumentó su Plan Directo y % FOJA tras el aumento de dedicación directa en Fisiatría T1
        kpis_mayo_p4 = client.get("/api/kpis?periodo=2026-05-01").json()
        assert kpis_mayo_p4["plan_directo_mensual"] > kpis_mayo_p3["plan_directo_mensual"]
        assert kpis_mayo_p4["foja_pct"] > kpis_mayo_p3["foja_pct"]

        # Vista Plan vs. Real poblada con alertas WCAG
        pvr = client.get("/api/plan-vs-real?periodo=2026-04-01&agrupado=true").json()
        assert len(pvr) > 0
        assert any(i["real_directo"] > 0 for i in pvr)
        assert any(i["alerta"]["nivel"] == "CRITICO" for i in pvr)


def test_verificar_todos_los_escenarios_y_casos_estrella(tmp_path: Path) -> None:
    """Valida el modo `--verificar-todo` sobre `tmp_path` y los 4 casos estrella."""
    rep = verificar_todos_los_escenarios(
        db_path=str(tmp_path / "verif.sqlite"),
        entrada_dir=str(tmp_path / "entrada"),
        reportes_dir=str(tmp_path / "reportes"),
    )
    assert rep["verificacion_ok"] is True
    assert tuple(rep["escenarios"].keys()) == ESCENARIOS_VALIDOS

    p4 = rep["escenarios"]["paso4-completo"]
    assert p4["total_lotes"] == 4
    estrellas = p4["casos_estrella"]

    # 137732: Duda 1 (60.9375% directo, 14.0625% indirecto, 25% NAS)
    assert estrellas["137732"]["duda1_con_2h_lider_equipo"]["pct_directo_final"] == 60.9375
    assert estrellas["137732"]["duda1_con_2h_lider_equipo"]["pct_indirecto_final"] == 14.0625
    assert estrellas["137732"]["duda1_con_2h_lider_equipo"]["pct_nas_total"] == 25.0

    # 125129: Multi-sede Antofagasta (IT 21, 35h) + Calama (IT 22, 8h) en Mayo
    c125129_mayo = [
        c for c in estrellas["125129"]["contratos_bd"] if c["periodo"] == "2026-05-01"
    ]
    assert len(c125129_mayo) == 2
    horas_por_it = {c["it"]: c["horas_semanales"] for c in c125129_mayo}
    assert horas_por_it == {21: 35.0, 22: 8.0}

    # 141845: Alta nueva en Mayo con 42h (tope legal)
    c141845 = estrellas["141845"]["contratos_bd"]
    assert len(c141845) == 1
    assert c141845[0]["periodo"] == "2026-05-01"
    assert c141845[0]["horas_semanales"] == 42.0

    # 115444: Caso dorado Iquique (36h Tramo 2) + Excepción Coyhaique (6h Tramo 3)
    assert len(estrellas["115444"]["contratos_bd"]) >= 4
    assert estrellas["115444"]["excepcion_coyhaique_6h"]["ate_dir_sem"] == 5
    assert estrellas["115444"]["excepcion_coyhaique_6h"]["ate_ind_sem"] == 1


def test_escenario_invalido_lanza_value_error(tmp_path: Path) -> None:
    """Verifica que un nombre de escenario desconocido lance ValueError claro."""
    with pytest.raises(ValueError, match="Escenario inválido"):
        simular_escenario(escenario="paso99-inexistente", db_path=str(tmp_path / "err.sqlite"))
