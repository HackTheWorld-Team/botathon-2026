"""
Database initialization module for the backend.
Creates and manages the SQLite schema with batch versioning.
"""

import sqlite3
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import contextmanager


class Database:
    """SQLite database manager with batch versioning support."""

    def __init__(self, db_path: str = "backend/db.sqlite"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def connect(self):
        """Context manager for database connections."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def init_schema(self) -> None:
        """Initialize the database schema from schema.sql."""
        schema_path = Path("backend/schema.sql")
        if not schema_path.exists():
            raise FileNotFoundError(f"Schema file not found: {schema_path}")

        with open(schema_path, "r", encoding="utf-8") as f:
            schema_sql = f.read()

        with self.connect() as conn:
            conn.executescript(schema_sql)
            conn.commit()

    def create_lote(
        self,
        archivo_origen: Optional[str] = None,
        hash_archivo: Optional[str] = None,
        observaciones: Optional[str] = None,
    ) -> int:
        """Create a new batch (lote) and return its ID."""
        with self.connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO lotes (archivo_origen, hash_archivo, observaciones)
                VALUES (?, ?, ?)
                """,
                (archivo_origen, hash_archivo, observaciones),
            )
            conn.commit()
            return cursor.lastrowid

    def update_lote_counts(
        self,
        lote_id: int,
        total_registros: int,
        validos: int,
        rechazados: int,
        duracion_ms: int,
    ) -> None:
        """Update batch statistics after processing."""
        with self.connect() as conn:
            conn.execute(
                """
                UPDATE lotes
                SET total_registros = ?, validos = ?, rechazados = ?, duracion_ms = ?
                WHERE id = ?
                """,
                (total_registros, validos, rechazados, duracion_ms, lote_id),
            )
            conn.commit()

    def get_lote(self, lote_id: int) -> Optional[Dict[str, Any]]:
        """Get batch information by ID."""
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM lotes WHERE id = ?", (lote_id,)).fetchone()
            return dict(row) if row else None

    def get_latest_lote(self) -> Optional[Dict[str, Any]]:
        """Get the most recent batch."""
        with self.connect() as conn:
            row = conn.execute(
                "SELECT * FROM lotes ORDER BY timestamp_ingesta DESC LIMIT 1"
            ).fetchone()
            return dict(row) if row else None

    def list_lotes(self) -> List[Dict[str, Any]]:
        """List all batches ordered by timestamp descending."""
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM lotes ORDER BY timestamp_ingesta DESC"
            ).fetchall()
            return [dict(row) for row in rows]

    def insert_instituto(
        self,
        codigo_it: int,
        sigla: str,
        nombre: str,
        zona: Optional[str],
        lote_id: int,
        activo: int = 1,
    ) -> int:
        """Insert an institute record."""
        with self.connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO institutos (codigo_it, sigla, nombre, zona, activo, lote_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (codigo_it, sigla, nombre, zona, activo, lote_id),
            )
            conn.commit()
            return cursor.lastrowid

    def insert_contrato(
        self,
        persona_id: float,
        it: int,
        instituto_sigla: str,
        area: Optional[str],
        sub_area: Optional[str],
        centro_costo: Optional[str],
        fecha_nacimiento: Optional[str],
        periodo: str,
        tipo_contrato: Optional[str],
        tipo_trabajador: Optional[str],
        fecha_ingreso_compania: Optional[str],
        fecha_termino: Optional[str],
        horas_semanales: float,
        cargo: Optional[str],
        dias_jornada: Optional[str],
        reg_sic: Optional[str],
        cod_esp: Optional[str],
        n_dias: Optional[int],
        vacante_nuevo: Optional[str],
        lote_id: int,
    ) -> int:
        """Insert a contract record."""
        with self.connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO contratos (
                    persona_id, it, instituto_sigla, area, sub_area, centro_costo,
                    fecha_nacimiento, periodo, tipo_contrato, tipo_trabajador,
                    fecha_ingreso_compania, fecha_termino, horas_semanales, cargo,
                    dias_jornada, reg_sic, cod_esp, n_dias, vacante_nuevo, lote_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    persona_id,
                    it,
                    instituto_sigla,
                    area,
                    sub_area,
                    centro_costo,
                    fecha_nacimiento,
                    periodo,
                    tipo_contrato,
                    tipo_trabajador,
                    fecha_ingreso_compania,
                    fecha_termino,
                    horas_semanales,
                    cargo,
                    dias_jornada,
                    reg_sic,
                    cod_esp,
                    n_dias,
                    vacante_nuevo,
                    lote_id,
                ),
            )
            conn.commit()
            return cursor.lastrowid

    def insert_rechazado(
        self,
        fila_original: int,
        datos_json: str,
        motivo: str,
        severidad: str,
        lote_id: int,
    ) -> int:
        """Insert a rejected record."""
        with self.connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO rechazados (fila_original, datos_json, motivo, severidad, lote_id)
                VALUES (?, ?, ?, ?, ?)
                """,
                (fila_original, datos_json, motivo, severidad, lote_id),
            )
            conn.commit()
            return cursor.lastrowid

    def insert_parametro_distribucion(
        self,
        tramo: str,
        cargo: Optional[str],
        cod_esp: Optional[str],
        pct_nas: float,
        pct_directo: float,
        pct_indirecto: float,
        pausa_saludable_horas: float,
        colacion_15_min: int,
        otras_nas_horas: float,
        lote_id: int,
    ) -> int:
        """Insert a distribution parameter."""
        with self.connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO parametros_distribucion (
                    tramo, cargo, cod_esp, pct_nas, pct_directo, pct_indirecto,
                    pausa_saludable_horas, colacion_15_min, otras_nas_horas, lote_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tramo,
                    cargo,
                    cod_esp,
                    pct_nas,
                    pct_directo,
                    pct_indirecto,
                    pausa_saludable_horas,
                    colacion_15_min,
                    otras_nas_horas,
                    lote_id,
                ),
            )
            conn.commit()
            return cursor.lastrowid

    def insert_parametro_grupal(
        self,
        cargo: str,
        cod_esp: Optional[str],
        pct_grupal: float,
        n_pacientes: float,
        ate_sem_dir_grupal: float,
        lote_id: int,
    ) -> int:
        """Insert a group parameter."""
        with self.connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO parametros_grupal (
                    cargo, cod_esp, pct_grupal, n_pacientes, ate_sem_dir_grupal, lote_id
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (cargo, cod_esp, pct_grupal, n_pacientes, ate_sem_dir_grupal, lote_id),
            )
            conn.commit()
            return cursor.lastrowid

    def insert_asignacion(
        self,
        nombre: str,
        horas: float,
        cargo: Optional[str],
        cod_esp: Optional[str],
        it: Optional[int],
        lote_id: int,
    ) -> int:
        """Insert a special assignment."""
        with self.connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO asignaciones (nombre, horas, cargo, cod_esp, it, lote_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (nombre, horas, cargo, cod_esp, it, lote_id),
            )
            conn.commit()
            return cursor.lastrowid

    def insert_plan(
        self,
        persona_id: float,
        it: int,
        periodo: str,
        cargo: Optional[str],
        cod_esp: Optional[str],
        h_sem: float,
        tramo: str,
        plan_ate_dir_m: int,
        plan_ate_ind_m: int,
        pct_nas: Optional[float],
        pct_directo: Optional[float],
        pct_indirecto: Optional[float],
        pct_asistencial: Optional[float],
        h_sem_disp_ate: Optional[str],
        min_directa: Optional[float],
        ate_dir_sem: Optional[float],
        ate_ind_sem: Optional[float],
        pct_grupal: Optional[float],
        n_pacientes: Optional[float],
        ate_sem_dir_grupal: Optional[float],
        plan_dir_anual: Optional[int],
        total_plan_dir: Optional[float],
        total_mg_directa: Optional[float],
        lote_id: int,
    ) -> int:
        """Insert a calculated plan."""
        with self.connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO planes (
                    persona_id, it, periodo, cargo, cod_esp, h_sem, tramo,
                    plan_ate_dir_m, plan_ate_ind_m, pct_nas, pct_directo, pct_indirecto,
                    pct_asistencial, h_sem_disp_ate, min_directa, ate_dir_sem, ate_ind_sem,
                    pct_grupal, n_pacientes, ate_sem_dir_grupal, plan_dir_anual,
                    total_plan_dir, total_mg_directa, lote_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    persona_id,
                    it,
                    periodo,
                    cargo,
                    cod_esp,
                    h_sem,
                    tramo,
                    plan_ate_dir_m,
                    plan_ate_ind_m,
                    pct_nas,
                    pct_directo,
                    pct_indirecto,
                    pct_asistencial,
                    h_sem_disp_ate,
                    min_directa,
                    ate_dir_sem,
                    ate_ind_sem,
                    pct_grupal,
                    n_pacientes,
                    ate_sem_dir_grupal,
                    plan_dir_anual,
                    total_plan_dir,
                    total_mg_directa,
                    lote_id,
                ),
            )
            conn.commit()
            return cursor.lastrowid

    def insert_sic_real(
        self,
        persona_id: float,
        it: int,
        periodo: str,
        atenciones_directas: int,
        atenciones_indirectas: int,
        atenciones_grupales: int,
        lote_id: int,
    ) -> int:
        """Insert SIC real data."""
        with self.connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO sic_real (
                    persona_id, it, periodo, atenciones_directas,
                    atenciones_indirectas, atenciones_grupales, lote_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    persona_id,
                    it,
                    periodo,
                    atenciones_directas,
                    atenciones_indirectas,
                    atenciones_grupales,
                    lote_id,
                ),
            )
            conn.commit()
            return cursor.lastrowid

    def get_contratos_by_lote(self, lote_id: int) -> List[Dict[str, Any]]:
        """Get all contracts for a batch."""
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM contratos WHERE lote_id = ?", (lote_id,)
            ).fetchall()
            return [dict(row) for row in rows]

    def get_planes_by_lote(self, lote_id: int) -> List[Dict[str, Any]]:
        """Get all plans for a batch."""
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM planes WHERE lote_id = ?", (lote_id,)
            ).fetchall()
            return [dict(row) for row in rows]

    def get_sic_real_by_lote(self, lote_id: int) -> List[Dict[str, Any]]:
        """Get all SIC real data for a batch."""
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM sic_real WHERE lote_id = ?", (lote_id,)
            ).fetchall()
            return [dict(row) for row in rows]

    def get_rechazados_by_lote(self, lote_id: int) -> List[Dict[str, Any]]:
        """Get all rejected records for a batch."""
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM rechazados WHERE lote_id = ?", (lote_id,)
            ).fetchall()
            return [dict(row) for row in rows]

    def verify_schema(self) -> Dict[str, Any]:
        """Verify that all 9 tables exist and have correct structure."""
        expected_tables = {
            "lotes",
            "institutos",
            "contratos",
            "parametros_distribucion",
            "parametros_grupal",
            "asignaciones",
            "planes",
            "rechazados",
            "sic_real",
        }

        with self.connect() as conn:
            # Get all tables
            rows = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            ).fetchall()
            actual_tables = {row["name"] for row in rows}

            missing = expected_tables - actual_tables
            extra = actual_tables - expected_tables

            # Check contratos PK constraint
            pk_info = conn.execute("PRAGMA table_info(contratos)").fetchall()
            pk_columns = [col["name"] for col in pk_info if col["pk"] == 1]

            # Check unique constraint on contratos
            indexes = conn.execute("PRAGMA index_list(contratos)").fetchall()
            unique_indexes = []
            for idx in indexes:
                if idx["unique"] == 1:
                    idx_info = conn.execute(f"PRAGMA index_info({idx['name']})").fetchall()
                    unique_indexes.append([col["name"] for col in idx_info])

            return {
                "tables_exist": len(missing) == 0,
                "missing_tables": list(missing),
                "extra_tables": list(extra),
                "contratos_pk_columns": pk_columns,
                "contratos_unique_indexes": unique_indexes,
                "all_tables": list(actual_tables),
            }


def compute_file_hash(filepath: str) -> str:
    """Compute SHA256 hash of a file."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


if __name__ == "__main__":
    # Quick test
    db = Database("backend/test_db.sqlite")
    db.init_schema()
    result = db.verify_schema()
    print("Schema verification:", result)
    assert result["tables_exist"], f"Missing tables: {result['missing_tables']}"
    print("All 9 tables created successfully!")