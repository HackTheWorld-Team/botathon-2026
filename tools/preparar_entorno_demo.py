#!/usr/bin/env python3
"""
tools/preparar_entorno_demo.py — Empaquetado e inicialización idempotente del entorno de demo (Issue #55).

Prepara la base de datos SQLite y los artefactos de entrada/salida en la secuencia exacta
del guion de demo y grabación de video de Botathon 2026:
  1. Seed de catálogos y parámetros oficiales (backend/seed.py).
  2. Generación de insumos de demo si no existen (BUK_demo_invalidos.xlsx y BUK_Dotacion_2026_Mayo.xlsx).
  3. Lote 1 (BUK Base): "Nac - Base contratos x mes.xlsx" (3.123 contratos válidos + planes calculados).
  4. Si modo == "completo":
     - Lote 2 (BUK Corrupto - Paso 2): BUK_demo_invalidos.xlsx (445 válidos + 6 rechazados aislados).
     - Lote 3 (BUK Mayo 42h - Paso 3): BUK_Dotacion_2026_Mayo.xlsx (450 válidos, deltas ALTA #141845,
       140 CAMBIO_JORNADA 44h->42h, MULTI_SEDE #125129 Ant+Cal, recálculo mayo sin tocar ene-abr).
     - Lote 4 (SIC Real - Paso 4): "SIC_Atenciones_Reales.xlsx" (3.123 registros reales en sic_real).

Uso CLI:
    python tools/preparar_entorno_demo.py [--db backend/db.sqlite] [--modo completo|paso-inicial]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.seed import (
    INSTITUTOS,
    SEMANAS_2026,
    cargar_distribucion,
    cargar_grupal,
    crear_bd,
)
from bot.worker import validar_y_procesar_buk, validar_y_procesar_sic
from tools.generar_buk_mayo import generar_buk_mayo
from tools.make_demo_invalidos import generar as generar_buk_invalidos

BUK_BASE_XLSX = REPO_ROOT / "Nac - Base contratos x mes.xlsx"
SIC_REAL_XLSX = REPO_ROOT / "SIC_Atenciones_Reales.xlsx"


def seed_parametros_bd(db_path: str) -> Dict[str, int]:
    """Inicializa el esquema SQLite y carga todos los catálogos base (seed.py)."""
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    con = crear_bd(db_path)
    try:
        con.executemany(
            "INSERT OR REPLACE INTO institutos (it, sigla, nombre) VALUES (?,?,?)",
            [(it, sig, sig) for it, sig in INSTITUTOS],
        )
        con.executemany(
            "INSERT OR REPLACE INTO semanas_habiles VALUES (?,?,?)",
            [(2026, m, s) for m, s in SEMANAS_2026.items()],
        )
        n_dist = cargar_distribucion(con)
        n_grup = cargar_grupal(con)
        n_asig = con.execute("SELECT COUNT(*) FROM asignaciones").fetchone()[0]
        con.commit()
    finally:
        con.close()

    return {
        "institutos": len(INSTITUTOS),
        "semanas_habiles": len(SEMANAS_2026),
        "parametros_distribucion": n_dist,
        "parametros_grupal": n_grup,
        "asignaciones": n_asig,
    }


def preparar_entorno_demo(
    db_path: str = "backend/db.sqlite",
    modo: str = "completo",
    entrada_dir: Optional[str] = None,
    reportes_dir: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Ejecuta de forma limpia e idempotente la preparación completa del entorno de demo.
    Si la BD ya tenía lotes previos, recrea las tablas de datos transaccionales para
    garantizar ids y conteos deterministas en cada corrida.
    """
    if modo not in ("completo", "paso-inicial"):
        raise ValueError(f"Modo inválido '{modo}'. Use 'completo' o 'paso-inicial'.")

    in_dir = Path(entrada_dir) if entrada_dir else (REPO_ROOT / "bot" / "entrada")
    out_dir = Path(reportes_dir) if reportes_dir else (REPO_ROOT / "bot" / "reportes")
    in_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Limpiar tablas transaccionales para que la ejecución sea 100% idempotente
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
            "DELETE FROM sqlite_sequence WHERE name IN ('deltas','rechazados','planes','sic_real','contratos','lotes','auditoria_parametros');"
        )
        con.commit()
    except Exception:
        pass
    finally:
        con.close()

    # 1. Seed de parámetros y catálogos
    seed_info = seed_parametros_bd(db_path)

    # 2. Asegurar insumos generados de demo
    invalidos_xlsx = in_dir / "BUK_demo_invalidos.xlsx"
    mayo_xlsx = in_dir / "BUK_Dotacion_2026_Mayo.xlsx"

    if not invalidos_xlsx.exists():
        generar_buk_invalidos(str(invalidos_xlsx))
    if not mayo_xlsx.exists():
        generar_buk_mayo(mayo_xlsx)

    lotes_procesados: List[Dict[str, Any]] = []

    # 3. Lote 1: BUK Base (Ene–Jul 2026, 3.123 contratos válidos)
    lote_1 = validar_y_procesar_buk(
        str(BUK_BASE_XLSX),
        db_path=db_path,
        out_dir=str(out_dir),
    )
    lotes_procesados.append(lote_1)

    if modo == "completo":
        # 4. Lote 2 (Paso 2): BUK con 6 registros corruptos aislados en rechazados + Rejected_Records_Report.xlsx
        lote_2 = validar_y_procesar_buk(
            str(invalidos_xlsx),
            db_path=db_path,
            out_dir=str(out_dir),
        )
        lotes_procesados.append(lote_2)

        # 5. Lote 3 (Paso 3): BUK Mayo 42h (450 válidos, deltas ALTA/CAMBIO_JORNADA/MULTI_SEDE, no retroactivo)
        # Usamos un subdirectorio o preservamos Rejected_Records_Report.xlsx del Paso 2 para que siga disponible en disco
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

        # 6. Lote 4 (Paso 4): SIC Atenciones Reales (3.123 registros en sic_real)
        lote_4 = validar_y_procesar_sic(
            str(SIC_REAL_XLSX),
            db_path=db_path,
            out_dir=str(out_dir),
        )
        lotes_procesados.append(lote_4)

    return {
        "db_path": db_path,
        "modo": modo,
        "seed": seed_info,
        "archivos_demo": {
            "buk_invalidos": str(invalidos_xlsx),
            "buk_mayo": str(mayo_xlsx),
        },
        "lotes": lotes_procesados,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prepara de forma idempotente la BD y los lotes de demo de Botathon 2026."
    )
    parser.add_argument(
        "--db",
        default="backend/db.sqlite",
        help="Ruta a la base de datos SQLite (default: backend/db.sqlite)",
    )
    parser.add_argument(
        "--modo",
        choices=["completo", "paso-inicial"],
        default="completo",
        help="'completo' carga los 4 lotes de la demo; 'paso-inicial' deja solo el Lote 1 base.",
    )
    args = parser.parse_args()

    res = preparar_entorno_demo(db_path=args.db, modo=args.modo)
    print(f"Entorno demo preparado en '{res['db_path']}' (modo={res['modo']}):")
    print(f"  Catálogos seed: {res['seed']}")
    for lote in res["lotes"]:
        print(
            f"  Lote #{lote['lote_id']} [{lote['tipo']}] {lote['archivo']}: "
            f"válidos={lote['validos']} · rechazados={lote['rechazados']}"
        )


if __name__ == "__main__":
    main()
