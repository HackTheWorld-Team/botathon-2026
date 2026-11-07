"""
Tests unitarios y de integración para bot/worker.py (Issue #11).
"""
import sqlite3
import subprocess
from pathlib import Path

import pandas as pd
import pytest

from bot.worker import normalizar_fecha, validar_y_procesar_buk


import sys

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

    con = sqlite3.connect(test_db)
    cur = con.cursor()
    count = cur.execute("SELECT COUNT(*) FROM contratos").fetchone()[0]
    assert count == 3123
    lotes = cur.execute("SELECT validos, rechazados FROM lotes WHERE lote_id = ?", (resumen["lote_id"],)).fetchone()
    assert lotes[0] == 3123
    assert lotes[1] == 0
    con.close()


def test_worker_aisla_registros_invalidos(test_db, tmp_path):
    # Generar archivo con errores
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

    # Verificar reporte excel
    rep_file = tmp_path / "reportes" / "Rejected_Records_Report.xlsx"
    assert rep_file.exists()
    df_rep = pd.read_excel(rep_file)
    assert len(df_rep) == 6
