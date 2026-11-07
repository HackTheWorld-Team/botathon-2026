"""
Database models for Botathon 2026 backend.
SQLite schema for Parámetros and Distribucion_NAC data.
"""
import sqlite3
from pathlib import Path
from typing import Optional


SCHEMA_SQL = """
-- Parámetros: Homologación Cod_Esp → Cargo
CREATE TABLE IF NOT EXISTS parametros_homologacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cod_esp TEXT NOT NULL,
    cargo_homologado TEXT NOT NULL,
    centro_costo INTEGER,
    descripcion_centro_costo TEXT,
    UNIQUE(cod_esp, cargo_homologado)
);

-- Parámetros: Factor grupal (AS/ED/UEDA/ULAB/UTAC con N° pacientes San-Con vs resto)
CREATE TABLE IF NOT EXISTS parametros_factor_grupal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cargo TEXT NOT NULL UNIQUE,
    factor REAL NOT NULL,
    n_pacientes_san_con INTEGER NOT NULL,
    n_pacientes_otros INTEGER NOT NULL
);

-- Parámetros: Inhábiles 2026 (fechas)
CREATE TABLE IF NOT EXISTS parametros_inhabiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha DATE NOT NULL UNIQUE,
    descripcion TEXT
);

-- Parámetros: Inhábiles por mes
CREATE TABLE IF NOT EXISTS parametros_inhabiles_mes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mes INTEGER NOT NULL UNIQUE,
    mes_nombre TEXT NOT NULL,
    con_vacaciones INTEGER NOT NULL,
    sin_vacaciones INTEGER NOT NULL,
    dias_mes INTEGER NOT NULL,
    dia_habil INTEGER NOT NULL,
    dia_habil_con_vacaciones INTEGER NOT NULL
);

-- Parámetros: IT / Instituto / Área / Cargo / Tipo_Trabajador / Reg_SIC / Cod_Esp / Especialidad
CREATE TABLE IF NOT EXISTS parametros_personal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    it INTEGER NOT NULL,
    instituto TEXT NOT NULL,
    area TEXT NOT NULL,
    cargo TEXT NOT NULL,
    tipo_trabajador TEXT NOT NULL,
    reg_sic TEXT NOT NULL,
    cod_esp TEXT NOT NULL,
    especialidad TEXT NOT NULL,
    UNIQUE(it, instituto, area, cargo)
);

-- Distribucion_NAC: % Dir/Ind/NAS por cargo×tramo, minutos estándar, catálogo asignaciones
CREATE TABLE IF NOT EXISTS distribucion_nac (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    esp TEXT,
    cargo TEXT NOT NULL,
    unidad TEXT NOT NULL,
    std_minutos_atencion INTEGER NOT NULL,
    std_minutos_indirecta INTEGER NOT NULL,
    -- Tramo NAC >= 40 horas
    nac_ge_40_pct_dir REAL NOT NULL,
    nac_ge_40_pct_ind REAL NOT NULL,
    nac_ge_40_pct_nas REAL NOT NULL,
    -- Tramo NAC 22-40 horas
    nac_22_40_pct_dir REAL NOT NULL,
    nac_22_40_pct_ind REAL NOT NULL,
    nac_22_40_pct_nas REAL NOT NULL,
    -- Tramo NAC < 22 horas
    nac_lt_22_pct_dir REAL NOT NULL,
    nac_lt_22_pct_ind REAL NOT NULL,
    nac_lt_22_pct_nas REAL NOT NULL,
    -- Ponderados (calculated columns from Excel)
    pct_dir_ponderado REAL,
    pct_ind_ponderado REAL,
    pct_nas_ponderado REAL,
    -- Asignaciones
    asignacion_tipo TEXT,
    asignacion_horas REAL,
    asignacion_descripcion TEXT,
    UNIQUE(esp, cargo, unidad)
);

-- Distribucion_NAC: Pabellón (special section)
CREATE TABLE IF NOT EXISTS distribucion_nac_pabellon (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cargo TEXT NOT NULL,
    unidad TEXT NOT NULL,
    std_minutos_atencion INTEGER NOT NULL,
    std_minutos_indirecta INTEGER NOT NULL,
    pct_pabellon REAL NOT NULL,
    pct_directo REAL NOT NULL,
    pct_nas REAL NOT NULL,
    UNIQUE(cargo, unidad)
);

-- Distribucion_NAC: STD Minutos por Unidad
CREATE TABLE IF NOT EXISTS distribucion_nac_std_minutos_unidad (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unidad TEXT NOT NULL UNIQUE,
    std_minutos_directa INTEGER NOT NULL,
    std_minutos_indirecta INTEGER NOT NULL
);
"""


def get_db_path() -> Path:
    """Get the database file path."""
    return Path(__file__).parent / "botathon.db"


def init_db(db_path: Optional[Path] = None) -> sqlite3.Connection:
    """Initialize the database with schema."""
    if db_path is None:
        db_path = get_db_path()
    
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA_SQL)
    conn.commit()
    return conn


def get_connection(db_path: Optional[Path] = None) -> sqlite3.Connection:
    """Get a database connection."""
    if db_path is None:
        db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn


if __name__ == "__main__":
    # Test initialization
    conn = init_db()
    print("Database initialized successfully")
    conn.close()