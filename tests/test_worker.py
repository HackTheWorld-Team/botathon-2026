"""
Tests unitarios y de integración para bot/worker.py (Issues #11, #15, #28).
"""
import sqlite3
import subprocess
import sys
from pathlib import Path

import pandas as pd
import pytest

from bot.worker import normalizar_fecha, validar_y_procesar_buk, validar_y_procesar_sic, procesar_archivo


@pytest.fixture
def test_db(tmp_path):
    db_file = tmp_path / "test.db"
    subprocess.run([sys.executable, "backend/seed.py", "--db", str(db_file)], check=True)
    return str(db_file)


def test_normalizar_fecha():
    assert normalizar_fecha("2026-05-01") == "2026-05-01"
    assert normalizar_fecha(pd.Timestamp("2026-05-01")) == "2026-05-01"
    assert normalizar_fecha(None) is None
    assert normalizar_fecha("NaT") is None
    assert normalizar_fecha("") is None


def test_worker_procesa_archivo_real_completo(test_db, tmp_path):
    resumen = validar_y_procesar_buk(
        "Nac - Base contratos x mes.xlsx",
        db_path=test_db,
        out_dir=str(tmp_path / "reportes")
    )
    assert resumen["validos"] == 3123
    assert resumen["rechazados"] == 0
    assert resumen["total_filas"] == 3123
    assert resumen["planes_calculados"] == 3123
    assert resumen["deltas"]["total_deltas"] > 0

    con = sqlite3.connect(test_db)
    cur = con.cursor()
    count = cur.execute("SELECT COUNT(*) FROM contratos").fetchone()[0]
    assert count == 3123
    count_planes = cur.execute("SELECT COUNT(*) FROM planes").fetchone()[0]
    assert count_planes == 3123
    lotes = cur.execute("SELECT validos, rechazados FROM lotes WHERE lote_id = ?", (resumen["lote_id"],)).fetchone()
    assert lotes[0] == 3123
    assert lotes[1] == 0
    con.close()


def test_worker_aisla_registros_invalidos(test_db, tmp_path):
    corrupt_file = tmp_path / "corrupto.xlsx"
    from tools.make_demo_invalidos import generar
    generar(str(corrupt_file))

    resumen = validar_y_procesar_buk(
        str(corrupt_file),
        db_path=test_db,
        out_dir=str(tmp_path / "reportes")
    )

    assert resumen["validos"] == 445
    assert resumen["rechazados"] == 6

    con = sqlite3.connect(test_db)
    cur = con.cursor()
    rechazos = cur.execute("SELECT motivo FROM rechazados WHERE lote_id = ?", (resumen["lote_id"],)).fetchall()
    motivos = [r[0] for r in rechazos]
    assert "NEGATIVE_HS" in motivos
    assert "TEXT_HS" in motivos
    assert "BAD_IT" in motivos
    assert "HS_OVER" in motivos
    assert "BAD_ESP" in motivos
    assert "DUP_PK" in motivos
    con.close()

    rep_file = tmp_path / "reportes" / "Rejected_Records_Report.xlsx"
    assert rep_file.exists()
    df_rep = pd.read_excel(rep_file)
    assert len(df_rep) == 6


def test_worker_deteccion_deltas_y_42h_no_retroactivo(test_db, tmp_path):
    res_base = validar_y_procesar_buk(
        "Nac - Base contratos x mes.xlsx",
        db_path=test_db,
        out_dir=str(tmp_path / "rep1")
    )
    assert res_base["validos"] == 3123

    con = sqlite3.connect(test_db)
    cur = con.cursor()
    planes_previos = {}
    for mes in ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"]:
        c, s = cur.execute("SELECT COUNT(*), SUM(plan_dir_m) FROM planes WHERE periodo = ?", (mes,)).fetchone()
        planes_previos[mes] = (c, s)

    from tools.generar_buk_mayo import main as generar_mayo
    generar_mayo()

    res_mayo = validar_y_procesar_buk(
        "bot/entrada/BUK_Dotacion_2026_Mayo.xlsx",
        db_path=test_db,
        out_dir=str(tmp_path / "rep2")
    )

    assert res_mayo["validos"] == 450
    assert res_mayo["rechazados"] == 0

    deltas = res_mayo["deltas"]
    assert deltas["altas"] >= 1
    assert deltas["cambios_jornada"] >= 140
    assert deltas["multi_sede"] >= 2

    for mes, (c_ant, s_ant) in planes_previos.items():
        c_post, s_post = cur.execute("SELECT COUNT(*), SUM(plan_dir_m) FROM planes WHERE periodo = ?", (mes,)).fetchone()
        assert c_post == c_ant
        assert s_post == s_ant

    max_hs_mayo = cur.execute(
        "SELECT MAX(horas_semanales) FROM contratos WHERE periodo = '2026-05-01'"
    ).fetchone()[0]
    assert max_hs_mayo <= 42.0
    con.close()


def test_worker_ingesta_sic_y_rechazos(test_db, tmp_path):
    # 1. Ingesta normal de SIC_Atenciones_Reales.xlsx
    res_sic = validar_y_procesar_sic(
        "SIC_Atenciones_Reales.xlsx",
        db_path=test_db,
        out_dir=str(tmp_path / "sic_rep")
    )
    assert res_sic["validos"] == 3123
    assert res_sic["rechazados"] == 0

    con = sqlite3.connect(test_db)
    cur = con.cursor()
    count_sic = cur.execute("SELECT COUNT(*) FROM sic_real").fetchone()[0]
    assert count_sic == 3123
    con.close()

    # 2. Generar archivo SIC con datos corruptos
    sic_corrupto = tmp_path / "sic_corrupto.xlsx"
    df_sic = pd.read_excel("SIC_Atenciones_Reales.xlsx").head(20).copy()
    df_sic["Atenciones_Directas_Reales"] = df_sic["Atenciones_Directas_Reales"].astype(object)
    df_sic["Atenciones_Indirectas_Reales"] = df_sic["Atenciones_Indirectas_Reales"].astype(object)
    
    # Inyectar errores
    df_sic.loc[0, "Atenciones_Directas_Reales"] = -10  # NEGATIVE_ATE
    df_sic.loc[1, "Atenciones_Indirectas_Reales"] = "Veinte"  # TEXT_ATE
    df_sic.loc[2, "IT"] = 999  # BAD_IT
    # Duplicado de PK
    dup = df_sic.iloc[[3]].copy()
    df_sic = pd.concat([df_sic, dup], ignore_index=True)
    df_sic.to_excel(sic_corrupto, index=False)

    res_corrupto = procesar_archivo(
        str(sic_corrupto),
        db_path=test_db,
        out_dir=str(tmp_path / "sic_corrupt_rep"),
        tipo="SIC"
    )

    assert res_corrupto["rechazados"] == 4
    assert res_corrupto["validos"] == 17

    con = sqlite3.connect(test_db)
    cur = con.cursor()
    rechazos = cur.execute("SELECT motivo FROM rechazados WHERE lote_id = ?", (res_corrupto["lote_id"],)).fetchall()
    motivos = [r[0] for r in rechazos]
    assert "NEGATIVE_ATE" in motivos
    assert "TEXT_ATE" in motivos
    assert "BAD_IT" in motivos
    assert "DUP_PK" in motivos
    con.close()
