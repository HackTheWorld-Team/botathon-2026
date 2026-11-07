"""
Tests for the database schema and initialization.
"""

import os
import tempfile
import pytest
from backend.db import Database, compute_file_hash


@pytest.fixture
def temp_db():
    """Create a temporary database for testing."""
    with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as f:
        db_path = f.name
    db = Database(db_path)
    db.init_schema()
    yield db
    os.unlink(db_path)


def test_schema_creates_all_9_tables(temp_db):
    """Test that the DDL creates all 9 required tables from empty DB."""
    result = temp_db.verify_schema()
    assert result["tables_exist"], f"Missing tables: {result['missing_tables']}"
    assert len(result["all_tables"]) == 9
    expected = {
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
    assert set(result["all_tables"]) == expected


def test_contratos_pk_prevents_duplicates(temp_db):
    """Test that contratos PK prevents duplicates on PersonaId+IT+Periodo+lote."""
    lote_id = temp_db.create_lote(archivo_origen="test.xlsx")

    # Insert first contract
    temp_db.insert_contrato(
        persona_id=12345.0,
        it=11,
        instituto_sigla="Ari",
        area="FI",
        sub_area=None,
        centro_costo=None,
        fecha_nacimiento=None,
        periodo="2026-01-01",
        tipo_contrato="Indefinido",
        tipo_trabajador=None,
        fecha_ingreso_compania=None,
        fecha_termino=None,
        horas_semanales=40.0,
        cargo="MEDICO FISIATRA",
        dias_jornada=None,
        reg_sic=None,
        cod_esp="FI",
        n_dias=None,
        vacante_nuevo=None,
        lote_id=lote_id,
    )

    # Try to insert duplicate - should fail due to UNIQUE constraint
    import sqlite3
    with pytest.raises(sqlite3.IntegrityError):
        temp_db.insert_contrato(
            persona_id=12345.0,
            it=11,
            instituto_sigla="Ari",
            area="FI",
            sub_area=None,
            centro_costo=None,
            fecha_nacimiento=None,
            periodo="2026-01-01",
            tipo_contrato="Indefinido",
            tipo_trabajador=None,
            fecha_ingreso_compania=None,
            fecha_termino=None,
            horas_semanales=40.0,
            cargo="MEDICO FISIATRA",
            dias_jornada=None,
            reg_sic=None,
            cod_esp="FI",
            n_dias=None,
            vacante_nuevo=None,
            lote_id=lote_id,
        )


def test_contratos_allows_same_person_different_lote(temp_db):
    """Test that same person can exist in different lotes."""
    lote_id_1 = temp_db.create_lote(archivo_origen="test1.xlsx")
    lote_id_2 = temp_db.create_lote(archivo_origen="test2.xlsx")

    # Insert in first lote
    temp_db.insert_contrato(
        persona_id=12345.0,
        it=11,
        instituto_sigla="Ari",
        area="FI",
        sub_area=None,
        centro_costo=None,
        fecha_nacimiento=None,
        periodo="2026-01-01",
        tipo_contrato="Indefinido",
        tipo_trabajador=None,
        fecha_ingreso_compania=None,
        fecha_termino=None,
        horas_semanales=40.0,
        cargo="MEDICO FISIATRA",
        dias_jornada=None,
        reg_sic=None,
        cod_esp="FI",
        n_dias=None,
        vacante_nuevo=None,
        lote_id=lote_id_1,
    )

    # Insert same person/period in different lote - should succeed
    temp_db.insert_contrato(
        persona_id=12345.0,
        it=11,
        instituto_sigla="Ari",
        area="FI",
        sub_area=None,
        centro_costo=None,
        fecha_nacimiento=None,
        periodo="2026-01-01",
        tipo_contrato="Indefinido",
        tipo_trabajador=None,
        fecha_ingreso_compania=None,
        fecha_termino=None,
        horas_semanales=40.0,
        cargo="MEDICO FISIATRA",
        dias_jornada=None,
        reg_sic=None,
        cod_esp="FI",
        n_dias=None,
        vacante_nuevo=None,
        lote_id=lote_id_2,
    )

    # Verify both exist
    contratos_1 = temp_db.get_contratos_by_lote(lote_id_1)
    contratos_2 = temp_db.get_contratos_by_lote(lote_id_2)
    assert len(contratos_1) == 1
    assert len(contratos_2) == 1


def test_lotes_tracks_counts_and_duration(temp_db):
    """Test that lotes table tracks id, timestamp, duration, valid/rejected counts."""
    lote_id = temp_db.create_lote(
        archivo_origen="test.xlsx",
        hash_archivo="abc123",
        observaciones="Test batch",
    )

    lote = temp_db.get_lote(lote_id)
    assert lote is not None
    assert lote["id"] == lote_id
    assert lote["archivo_origen"] == "test.xlsx"
    assert lote["hash_archivo"] == "abc123"
    assert lote["observaciones"] == "Test batch"
    assert lote["timestamp_ingesta"] is not None
    assert lote["total_registros"] == 0
    assert lote["validos"] == 0
    assert lote["rechazados"] == 0
    assert lote["duracion_ms"] == 0

    # Update counts
    temp_db.update_lote_counts(lote_id, total_registros=100, validos=95, rechazados=5, duracion_ms=1500)

    lote = temp_db.get_lote(lote_id)
    assert lote["total_registros"] == 100
    assert lote["validos"] == 95
    assert lote["rechazados"] == 5
    assert lote["duracion_ms"] == 1500


def test_all_data_tables_have_lote_id(temp_db):
    """Test that all data tables have lote_id column and FK to lotes."""
    lote_id = temp_db.create_lote(archivo_origen="test.xlsx")

    # Insert into each data table
    temp_db.insert_instituto(11, "Ari", "Instituto Arica", "Norte", lote_id)
    temp_db.insert_contrato(
        12345.0, 11, "Ari", "FI", None, None, None, "2026-01-01", "Indefinido",
        None, None, None, 40.0, "MEDICO", None, None, "FI", None, None, lote_id
    )
    temp_db.insert_parametro_distribucion(
        "tramo1_44h", "MEDICO", "FI", 0.2, 0.65, 0.15, 4.0, 0, 4.0, lote_id
    )
    temp_db.insert_parametro_grupal("MEDICO", "FI", 0.1, 1.5, 2.0, lote_id)
    temp_db.insert_asignacion("Líder Equipo", 2.0, "MEDICO", "FI", 11, lote_id)
    temp_db.insert_plan(
        12345.0, 11, "2026-01-01", "MEDICO", "FI", 40.0, "tramo1_44h",
        36, 11, 0.2, 0.65, 0.15, 0.75, "1 days 06:00:00", 40.0, 36.0, 11.0,
        0.1, 1.5, 2.0, 1638, 1638.0, 1467.0, lote_id
    )
    temp_db.insert_rechazado(1, '{"col": "val"}', "Invalid hours", "ERROR", lote_id)
    temp_db.insert_sic_real(12345.0, 11, "2026-01-01", 35, 10, 2, lote_id)

    # Verify all have lote_id
    with temp_db.connect() as conn:
        tables = [
            "institutos", "contratos", "parametros_distribucion",
            "parametros_grupal", "asignaciones", "planes",
            "rechazados", "sic_real"
        ]
        for table in tables:
            row = conn.execute(f"SELECT lote_id FROM {table} WHERE lote_id = ?", (lote_id,)).fetchone()
            assert row is not None, f"Table {table} missing lote_id"
            assert row["lote_id"] == lote_id


def test_schema_supports_kpi_queries(temp_db):
    """Test that schema supports queries for #20 (kpis/plan/plan-vs-real/lotes)."""
    lote_id = temp_db.create_lote(archivo_origen="test.xlsx")

    # Insert test data - two different institutes
    temp_db.insert_instituto(11, "Ari", "Instituto Arica", "Norte", lote_id)
    temp_db.insert_instituto(12, "Iqu", "Instituto Iquique", "Norte", lote_id)

    # Contracts - one per institute
    temp_db.insert_contrato(
        12345.0, 11, "Ari", "FI", None, None, None, "2026-01-01", "Indefinido",
        None, None, None, 40.0, "MEDICO FISIATRA", None, None, "FI", None, None, lote_id
    )
    temp_db.insert_contrato(
        71269.0, 12, "Iqu", "FI", None, None, None, "2026-01-01", "Indefinido",
        None, None, None, 10.0, "MEDICO GENERAL", None, None, "FI", None, None, lote_id
    )

    # Plans
    temp_db.insert_plan(
        12345.0, 11, "2026-01-01", "MEDICO FISIATRA", "FI", 40.0, "tramo1_44h",
        36, 11, 0.2, 0.65, 0.15, 0.75, "1 days 06:00:00", 40.0, 36.0, 11.0,
        0.1, 1.5, 2.0, 1638, 1638.0, 1467.0, lote_id
    )
    temp_db.insert_plan(
        71269.0, 12, "2026-01-01", "MEDICO GENERAL", "FI", 10.0, "tramo3_<22h",
        0, 0, 0.15, 0.75, 0.1, 0.8, "0 days 00:00:00", 40.0, 0.0, 0.0,
        0.0, 0.0, 0.0, 30, 30.0, 27.0, lote_id
    )

    # SIC real - matching the contracts by IT
    temp_db.insert_sic_real(12345.0, 11, "2026-01-01", 35, 10, 2, lote_id)
    temp_db.insert_sic_real(71269.0, 12, "2026-01-01", 0, 0, 0, lote_id)

    # Test KPI query: Total hours contracted per institute
    with temp_db.connect() as conn:
        # KPI: Total horas contratadas por instituto
        rows = conn.execute("""
            SELECT c.it, i.sigla, SUM(c.horas_semanales) as total_horas
            FROM contratos c
            JOIN institutos i ON c.it = i.codigo_it
            WHERE c.lote_id = ?
            GROUP BY c.it, i.sigla
        """, (lote_id,)).fetchall()
        assert len(rows) == 2
        # Order may vary, check both values present
        horas = {row["total_horas"] for row in rows}
        assert 40.0 in horas
        assert 10.0 in horas

        # KPI: Plan vs Real - atenciones directas
        rows = conn.execute("""
            SELECT p.persona_id, p.plan_ate_dir_m as plan, s.atenciones_directas as real,
                   (s.atenciones_directas - p.plan_ate_dir_m) as diff
            FROM planes p
            JOIN sic_real s ON p.persona_id = s.persona_id AND p.it = s.it AND p.periodo = s.periodo
            WHERE p.lote_id = ? AND s.lote_id = ?
        """, (lote_id, lote_id)).fetchall()
        assert len(rows) == 2
        diffs = {row["diff"] for row in rows}
        assert -1 in diffs  # 35 - 36
        assert 0 in diffs   # 0 - 0

        # Lotes query: list all lotes with stats
        rows = conn.execute("""
            SELECT id, timestamp_ingesta, total_registros, validos, rechazados, duracion_ms
            FROM lotes
            ORDER BY timestamp_ingesta DESC
        """).fetchall()
        assert len(rows) == 1
        assert rows[0]["validos"] == 0  # Not updated yet


def test_indexes_exist(temp_db):
    """Test that performance indexes are created."""
    with temp_db.connect() as conn:
        indexes = conn.execute("""
            SELECT name FROM sqlite_master
            WHERE type='index' AND name NOT LIKE 'sqlite_%'
        """).fetchall()
        index_names = {row["name"] for row in indexes}

        expected_indexes = {
            "idx_contratos_lote",
            "idx_contratos_persona_periodo",
            "idx_contratos_it_periodo",
            "idx_planes_lote",
            "idx_planes_persona_periodo",
            "idx_planes_it_periodo",
            "idx_sic_real_lote",
            "idx_sic_real_persona_periodo",
            "idx_rechazados_lote",
            "idx_parametros_dist_lote",
            "idx_parametros_grupal_lote",
            "idx_asignaciones_lote",
            "idx_institutos_lote",
        }
        assert expected_indexes.issubset(index_names), f"Missing indexes: {expected_indexes - index_names}"


def test_compute_file_hash():
    """Test file hash computation."""
    with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
        f.write("test content")
        filepath = f.name
    try:
        hash_val = compute_file_hash(filepath)
        assert len(hash_val) == 64  # SHA256 hex
        assert hash_val == compute_file_hash(filepath)  # Deterministic
    finally:
        os.unlink(filepath)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])