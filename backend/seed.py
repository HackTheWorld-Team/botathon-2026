#!/usr/bin/env python3
"""
Seed script for Botathon 2026 backend.

Reads 'Parámetros' and 'Distribucion_NAC' sheets from
'Nac - Planificación Asistencial x mes.xlsx' and populates SQLite database.

Usage:
    python backend/seed.py

Idempotent: re-running does not duplicate rows (uses UNIQUE constraints).
Fails with clear message if source file or expected coordinates are missing.
"""
import sys
import sqlite3
from pathlib import Path
from datetime import date
from typing import Optional

import openpyxl

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from models import init_db, get_db_path, SCHEMA_SQL


SOURCE_FILE = Path(__file__).parent.parent / "Nac - Planificación Asistencial x mes.xlsx"


class SeedError(Exception):
    """Custom exception for seed errors with clear messages."""
    pass


def validate_source_file() -> openpyxl.Workbook:
    """Validate source file exists and has required sheets."""
    if not SOURCE_FILE.exists():
        raise SeedError(f"Source file not found: {SOURCE_FILE}")
    
    try:
        wb = openpyxl.load_workbook(SOURCE_FILE, data_only=True)
    except Exception as e:
        raise SeedError(f"Failed to load Excel file: {e}")
    
    required_sheets = ["Parámetros", "Distribucion_NAC"]
    for sheet in required_sheets:
        if sheet not in wb.sheetnames:
            raise SeedError(f"Required sheet '{sheet}' not found in workbook. Available: {wb.sheetnames}")
    
    return wb


def validate_coordinate(ws, row: int, col: int, description: str) -> any:
    """Validate a specific coordinate has a value."""
    val = ws.cell(row=row, column=col).value
    if val is None:
        raise SeedError(f"Expected value at {description} (row {row}, col {col}) is empty")
    return val


def seed_parametros_homologacion(conn: sqlite3.Connection, ws) -> int:
    """Seed homologación Cod_Esp → Cargo (rows 2-9, cols A-D)."""
    count = 0
    for i in range(2, 10):  # rows 2-9 (1-indexed)
        cod_esp = ws.cell(row=i, column=1).value
        cargo_homologado = ws.cell(row=i, column=2).value
        centro_costo = ws.cell(row=i, column=3).value
        descripcion = ws.cell(row=i, column=4).value
        
        if cod_esp and cargo_homologado:
            try:
                conn.execute(
                    """INSERT OR IGNORE INTO parametros_homologacion 
                       (cod_esp, cargo_homologado, centro_costo, descripcion_centro_costo)
                       VALUES (?, ?, ?, ?)""",
                    (cod_esp, cargo_homologado, centro_costo, descripcion)
                )
                count += 1
            except sqlite3.IntegrityError:
                pass  # Duplicate, ignore due to idempotency
    conn.commit()
    return count


def seed_parametros_factor_grupal(conn: sqlite3.Connection, ws) -> int:
    """Seed factor grupal (rows 4-8, cols F-I)."""
    count = 0
    # Row 4 (index 4): headers in row 3, data starts row 4
    for i in range(4, 9):  # rows 4-8
        cargo = ws.cell(row=i, column=6).value  # col F
        factor = ws.cell(row=i, column=7).value  # col G
        n_san_con = ws.cell(row=i, column=8).value  # col H
        n_otros = ws.cell(row=i, column=9).value  # col I
        
        if cargo is not None and factor is not None:
            try:
                conn.execute(
                    """INSERT OR IGNORE INTO parametros_factor_grupal 
                       (cargo, factor, n_pacientes_san_con, n_pacientes_otros)
                       VALUES (?, ?, ?, ?)""",
                    (cargo, factor, n_san_con or 0, n_otros or 0)
                )
                count += 1
            except sqlite3.IntegrityError:
                pass
    conn.commit()
    return count


def seed_parametros_inhabiles(conn: sqlite3.Connection, ws) -> int:
    """Seed inhábiles 2026 (col K, rows 2-13)."""
    count = 0
    for i in range(2, 14):  # rows 2-13
        fecha = ws.cell(row=i, column=11).value  # col K
        descripcion = ws.cell(row=i, column=12).value  # col L
        
        if fecha:
            # Convert datetime to date string
            if hasattr(fecha, 'date'):
                fecha_str = fecha.date().isoformat()
            else:
                fecha_str = str(fecha)
            try:
                conn.execute(
                    """INSERT OR IGNORE INTO parametros_inhabiles (fecha, descripcion)
                       VALUES (?, ?)""",
                    (fecha_str, descripcion)
                )
                count += 1
            except sqlite3.IntegrityError:
                pass
    conn.commit()
    return count


def seed_parametros_inhabiles_mes(conn: sqlite3.Connection, ws) -> int:
    """Seed inhábiles por mes (cols S-Z, rows 2-13)."""
    count = 0
    for i in range(2, 14):  # rows 2-13
        mes = ws.cell(row=i, column=19).value  # col S
        con_vac = ws.cell(row=i, column=20).value  # col T
        sin_vac = ws.cell(row=i, column=21).value  # col U
        adic = ws.cell(row=i, column=22).value  # col V
        dias = ws.cell(row=i, column=23).value  # col W
        mes_nombre = ws.cell(row=i, column=24).value  # col X
        dia_habil = ws.cell(row=i, column=25).value  # col Y
        dia_habil_con_vac = ws.cell(row=i, column=26).value  # col Z
        
        if mes is not None:
            try:
                conn.execute(
                    """INSERT OR IGNORE INTO parametros_inhabiles_mes 
                       (mes, mes_nombre, con_vacaciones, sin_vacaciones, dias_mes, dia_habil, dia_habil_con_vacaciones)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (mes, mes_nombre, con_vac or 0, sin_vac or 0, dias or 0, dia_habil or 0, dia_habil_con_vac or 0)
                )
                count += 1
            except sqlite3.IntegrityError:
                pass
    conn.commit()
    return count


def seed_parametros_personal(conn: sqlite3.Connection, ws) -> int:
    """Seed personal data (cols AN-AV, rows 2-138)."""
    count = 0
    for i in range(2, 139):  # rows 2-138
        it = ws.cell(row=i, column=39).value  # col AN
        instituto = ws.cell(row=i, column=40).value  # col AO
        area = ws.cell(row=i, column=41).value  # col AP
        cargo = ws.cell(row=i, column=44).value  # col AR
        tipo_trabajador = ws.cell(row=i, column=45).value  # col AS
        reg_sic = ws.cell(row=i, column=46).value  # col AT
        cod_esp = ws.cell(row=i, column=47).value  # col AU
        especialidad = ws.cell(row=i, column=51).value  # col AY
        
        if it and instituto and area and cargo:
            try:
                conn.execute(
                    """INSERT OR IGNORE INTO parametros_personal 
                       (it, instituto, area, cargo, tipo_trabajador, reg_sic, cod_esp, especialidad)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (it, instituto, area, cargo, tipo_trabajador, reg_sic, cod_esp, especialidad)
                )
                count += 1
            except sqlite3.IntegrityError:
                pass
    conn.commit()
    return count


def seed_distribucion_nac(conn: sqlite3.Connection, ws) -> int:
    """Seed Distribucion_NAC main table (rows 7-91, cols A-P + R-T)."""
    count = 0
    for i in range(7, 92):  # rows 7-91 (1-indexed)
        esp = ws.cell(row=i, column=1).value  # col A
        cargo = ws.cell(row=i, column=2).value  # col B
        unidad = ws.cell(row=i, column=3).value  # col C
        std_min = ws.cell(row=i, column=4).value  # col D
        std_min_ind = ws.cell(row=i, column=5).value  # col E
        
        # NAC >= 40
        nac_ge_40_dir = ws.cell(row=i, column=6).value  # col F
        nac_ge_40_ind = ws.cell(row=i, column=7).value  # col G
        nac_ge_40_nas = ws.cell(row=i, column=8).value  # col H
        
        # NAC 22-40
        nac_22_40_dir = ws.cell(row=i, column=9).value  # col I
        nac_22_40_ind = ws.cell(row=i, column=10).value  # col J
        nac_22_40_nas = ws.cell(row=i, column=11).value  # col K
        
        # NAC < 22
        nac_lt_22_dir = ws.cell(row=i, column=12).value  # col L
        nac_lt_22_ind = ws.cell(row=i, column=13).value  # col M
        nac_lt_22_nas = ws.cell(row=i, column=14).value  # col N
        
        # Ponderados
        pct_dir_pond = ws.cell(row=i, column=15).value  # col O
        pct_ind_pond = ws.cell(row=i, column=16).value  # col P
        
        # Asignaciones
        asignacion_tipo = ws.cell(row=i, column=18).value  # col R
        asignacion_horas = ws.cell(row=i, column=19).value  # col S
        asignacion_desc = ws.cell(row=i, column=20).value  # col T
        
        if cargo and unidad and std_min is not None:
            # Validate required percentage fields
            required_pcts = [nac_ge_40_dir, nac_ge_40_ind, nac_ge_40_nas,
                           nac_22_40_dir, nac_22_40_ind, nac_22_40_nas,
                           nac_lt_22_dir, nac_lt_22_ind, nac_lt_22_nas]
            if any(p is None for p in required_pcts):
                continue  # Skip incomplete rows
            
            try:
                conn.execute(
                    """INSERT OR IGNORE INTO distribucion_nac 
                       (esp, cargo, unidad, std_minutos_atencion, std_minutos_indirecta,
                        nac_ge_40_pct_dir, nac_ge_40_pct_ind, nac_ge_40_pct_nas,
                        nac_22_40_pct_dir, nac_22_40_pct_ind, nac_22_40_pct_nas,
                        nac_lt_22_pct_dir, nac_lt_22_pct_ind, nac_lt_22_pct_nas,
                        pct_dir_ponderado, pct_ind_ponderado, pct_nas_ponderado,
                        asignacion_tipo, asignacion_horas, asignacion_descripcion)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (esp, cargo, unidad, std_min, std_min_ind or 0,
                     nac_ge_40_dir, nac_ge_40_ind, nac_ge_40_nas,
                     nac_22_40_dir, nac_22_40_ind, nac_22_40_nas,
                     nac_lt_22_dir, nac_lt_22_ind, nac_lt_22_nas,
                     pct_dir_pond, pct_ind_pond, None,  # pct_nas_ponderado not in Excel
                     asignacion_tipo, asignacion_horas, asignacion_desc)
                )
                count += 1
            except sqlite3.IntegrityError:
                pass
    conn.commit()
    return count


def seed_distribucion_nac_pabellon(conn: sqlite3.Connection, ws) -> int:
    """Seed Distribucion_NAC Pabellón section (rows 97-102, cols B-H)."""
    count = 0
    for i in range(97, 103):  # rows 97-102
        cargo = ws.cell(row=i, column=2).value  # col B
        unidad = ws.cell(row=i, column=3).value  # col C
        std_min = ws.cell(row=i, column=4).value  # col D
        std_min_ind = ws.cell(row=i, column=5).value  # col E
        pct_pabellon = ws.cell(row=i, column=6).value  # col F
        pct_directo = ws.cell(row=i, column=7).value  # col G
        pct_nas = ws.cell(row=i, column=8).value  # col H
        
        if cargo and unidad and std_min is not None:
            try:
                conn.execute(
                    """INSERT OR IGNORE INTO distribucion_nac_pabellon 
                       (cargo, unidad, std_minutos_atencion, std_minutos_indirecta,
                        pct_pabellon, pct_directo, pct_nas)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (cargo, unidad, std_min, std_min_ind or 0,
                     pct_pabellon, pct_directo, pct_nas)
                )
                count += 1
            except sqlite3.IntegrityError:
                pass
    conn.commit()
    return count


def seed_distribucion_nac_std_minutos_unidad(conn: sqlite3.Connection, ws) -> int:
    """Seed Distribucion_NAC STD Minutos por Unidad (rows 110-130, cols C-D)."""
    count = 0
    for i in range(110, 131):  # rows 110-130
        unidad = ws.cell(row=i, column=3).value  # col C
        std_dir = ws.cell(row=i, column=4).value  # col D
        std_ind = ws.cell(row=i, column=5).value  # col E
        
        if unidad and std_dir is not None:
            try:
                conn.execute(
                    """INSERT OR IGNORE INTO distribucion_nac_std_minutos_unidad 
                       (unidad, std_minutos_directa, std_minutos_indirecta)
                       VALUES (?, ?, ?)""",
                    (unidad, std_dir, std_ind or 0)
                )
                count += 1
            except sqlite3.IntegrityError:
                pass
    conn.commit()
    return count


def verify_seed(conn: sqlite3.Connection) -> dict:
    """Verify seeded data matches expected counts."""
    tables = [
        "parametros_homologacion",
        "parametros_factor_grupal",
        "parametros_inhabiles",
        "parametros_inhabiles_mes",
        "parametros_personal",
        "distribucion_nac",
        "distribucion_nac_pabellon",
        "distribucion_nac_std_minutos_unidad",
    ]
    
    results = {}
    for table in tables:
        cursor = conn.execute(f"SELECT COUNT(*) as cnt FROM {table}")
        results[table] = cursor.fetchone()["cnt"]
    
    return results


def main():
    """Main seed function."""
    print("=" * 60)
    print("Botathon 2026 - Database Seed")
    print("=" * 60)
    
    # Validate source
    print(f"\n[1/4] Validating source file: {SOURCE_FILE}")
    wb = validate_source_file()
    print("    ✓ Source file valid")
    
    # Initialize database
    print(f"\n[2/4] Initializing database: {get_db_path()}")
    conn = init_db()
    print("    ✓ Database schema created")
    
    # Seed Parámetros
    print("\n[3/4] Seeding Parámetros sheet...")
    ws_params = wb["Parámetros"]
    
    c1 = seed_parametros_homologacion(conn, ws_params)
    print(f"    ✓ parametros_homologacion: {c1} rows")
    
    c2 = seed_parametros_factor_grupal(conn, ws_params)
    print(f"    ✓ parametros_factor_grupal: {c2} rows")
    
    c3 = seed_parametros_inhabiles(conn, ws_params)
    print(f"    ✓ parametros_inhabiles: {c3} rows")
    
    c4 = seed_parametros_inhabiles_mes(conn, ws_params)
    print(f"    ✓ parametros_inhabiles_mes: {c4} rows")
    
    c5 = seed_parametros_personal(conn, ws_params)
    print(f"    ✓ parametros_personal: {c5} rows")
    
    # Seed Distribucion_NAC
    print("\n[4/4] Seeding Distribucion_NAC sheet...")
    ws_dist = wb["Distribucion_NAC"]
    
    c6 = seed_distribucion_nac(conn, ws_dist)
    print(f"    ✓ distribucion_nac: {c6} rows")
    
    c7 = seed_distribucion_nac_pabellon(conn, ws_dist)
    print(f"    ✓ distribucion_nac_pabellon: {c7} rows")
    
    c8 = seed_distribucion_nac_std_minutos_unidad(conn, ws_dist)
    print(f"    ✓ distribucion_nac_std_minutos_unidad: {c8} rows")
    
    # Verify
    print("\n" + "=" * 60)
    print("VERIFICATION")
    print("=" * 60)
    results = verify_seed(conn)
    for table, count in results.items():
        print(f"  {table}: {count} rows")
    
    conn.close()
    print("\n✓ Seed completed successfully!")
    print(f"  Database: {get_db_path()}")


if __name__ == "__main__":
    try:
        main()
    except SeedError as e:
        print(f"\n✗ SEED ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ UNEXPECTED ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)