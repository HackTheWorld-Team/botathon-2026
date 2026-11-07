"""
tests/test_api.py — Suite de pruebas automatizadas para los endpoints FastAPI (Issue #20).

Valida:
1. Health check y conexión a BD.
2. Catálogo de filtros para el dashboard (/api/filtros).
3. Agregaciones de KPIs (% FOJA, Meta 90%, Horas Totales/Dir/Ind/NAS) y filtros dinámicos.
4. Resiliencia ante base vacía (estado cero sin caídas).
5. Paginación y filtrado en /api/plan.
6. Cruce /api/plan-vs-real con alertas WCAG (déficit, cumplimiento, superávit) agrupado y desagrupado.
7. Auditoría de lotes (/api/lotes).
8. Cumplimiento de latencia SLA (< 300ms).
"""
import os
import sqlite3
import time
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.main import app

SCHEMA_PATH = Path("backend/schema.sql")
SEED_PATH = Path("backend/seed.py")


@pytest.fixture(scope="module")
def test_db_path(tmp_path_factory):
    """Crea una base de datos temporal con el esquema oficial y catálogos de seed."""
    tmp_dir = tmp_path_factory.mktemp("db_test")
    db_file = tmp_dir / "test_api.sqlite"

    # 1. Crear tablas con schema.sql
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        ddl = f.read()

    con = sqlite3.connect(str(db_file))
    con.executescript(ddl)

    # 2. Insertar institutos base
    con.executemany(
        "INSERT INTO institutos (it, sigla, nombre) VALUES (?, ?, ?)",
        [
            (11, "Ari", "Arica"),
            (81, "Con", "Concepción"),
            (131, "San", "Santiago"),
        ],
    )

    # 3. Insertar lote 1 BUK y lote 2 SIC
    con.execute(
        """
        INSERT INTO lotes (lote_id, archivo, tipo, fecha_corrida, duracion_ms, validos, rechazados)
        VALUES (1, 'BUK_2026_04.xlsx', 'BUK', '2026-04-30T10:00:00', 450, 2, 0)
        """
    )
    con.execute(
        """
        INSERT INTO lotes (lote_id, archivo, tipo, fecha_corrida, duracion_ms, validos, rechazados)
        VALUES (2, 'SIC_2026_04.xlsx', 'SIC', '2026-04-30T10:05:00', 320, 2, 0)
        """
    )

    # 4. Insertar contratos de prueba
    con.executemany(
        """
        INSERT INTO contratos (
            lote_id, it, persona_id, periodo, cargo, area, horas_semanales, cod_esp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            # Persona 1: Santiago, Fisiatra 40h, Periodo 2026-04-01
            (1, 131, 1001, "2026-04-01", "MEDICO FISIATRA", "Medicina", 40.0, "FI"),
            # Persona 2: Concepción, Kinesiólogo 44h, Periodo 2026-04-01
            (1, 81, 1002, "2026-04-01", "KINESIOLOGO", "Kinesiologia", 44.0, "KI"),
            # Persona 3: Santiago, Fisiatra 42h, Periodo 2026-05-01 (Transición mayo)
            (1, 131, 1001, "2026-05-01", "MEDICO FISIATRA", "Medicina", 42.0, "FI"),
        ],
    )

    # 5. Insertar planes proyectados asociados
    con.executemany(
        """
        INSERT INTO planes (
            persona_id, it, periodo, pct_nas, pct_directo, pct_indirecto,
            h_sem_disp_ate, ate_dir_sem, ate_ind_sem, sem_efectivas,
            plan_dir_m, plan_ind_m, mg_dir_m, lote_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            # 1001 abril: Plan Dir 150, MG 135
            (1001, 131, "2026-04-01", 0.20, 0.65, 0.15, 32.0, 32, 8, 4.2, 150, 33, 135, 1),
            # 1002 abril: Plan Dir 180, MG 162
            (1002, 81, "2026-04-01", 0.20, 0.65, 0.15, 35.2, 38, 9, 4.2, 180, 37, 162, 1),
            # 1001 mayo: Plan Dir 140, MG 126
            (1001, 131, "2026-05-01", 0.20, 0.65, 0.15, 33.6, 33, 8, 3.8, 140, 30, 126, 1),
        ],
    )

    # 6. Insertar registros reales en sic_real
    con.executemany(
        """
        INSERT INTO sic_real (
            lote_id, periodo, it, persona_id, cod_esp, ate_dir_reales, ate_ind_reales
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        [
            # 1001 abril: 120 atenciones reales -> menor a MG 135 -> DÉFICIT CRÍTICO
            (2, "2026-04-01", 131, 1001, "FI", 120, 30),
            # 1002 abril: 170 atenciones reales -> entre MG 162 y Plan 180 -> META CUMPLIDA
            (2, "2026-04-01", 81, 1002, "KI", 170, 35),
            # 1001 mayo: 145 atenciones reales -> mayor a Plan 140 -> SUPERÁVIT
            (2, "2026-05-01", 131, 1001, "FI", 145, 32),
        ],
    )

    con.commit()
    con.close()
    return str(db_file)


@pytest.fixture
def client(test_db_path, monkeypatch):
    """Cliente de prueba configurado con la base de datos temporal."""
    monkeypatch.setenv("BOTATHON_DB_PATH", test_db_path)
    with TestClient(app) as test_client:
        yield test_client


# ------------------------------------------------------------------------------
# TESTS
# ------------------------------------------------------------------------------

def test_health_check(client):
    """GET /api/health retorna 200 y conectividad OK."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"


def test_filtros_disponibles(client):
    """GET /api/filtros retorna listas de sedes, periodos, cargos, áreas y especialidades."""
    resp = client.get("/api/filtros")
    assert resp.status_code == 200
    data = resp.json()

    assert "institutos" in data
    assert any(i["sigla"] == "San" for i in data["institutos"])
    assert "2026-04-01" in data["periodos"]
    assert "MEDICO FISIATRA" in data["cargos"]
    assert "areas" in data
    assert "Medicina" in data["areas"]
    assert "Kinesiologia" in data["areas"]
    assert "FI" in data["especialidades"]


def test_kpis_sin_datos(tmp_path, monkeypatch):
    """Resiliencia: GET /api/kpis sobre BD sin contratos retorna ceros limpios (no 500)."""
    empty_db = tmp_path / "empty.sqlite"
    con = sqlite3.connect(str(empty_db))
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        con.executescript(f.read())
    con.close()

    monkeypatch.setenv("BOTATHON_DB_PATH", str(empty_db))
    with TestClient(app) as empty_client:
        resp = empty_client.get("/api/kpis")
        assert resp.status_code == 200
        kpi = resp.json()
        assert kpi["total_profesionales"] == 0
        assert kpi["total_contratos"] == 0
        assert kpi["horas_contratadas_semanales"] == 0.0
        assert kpi["foja_pct"] == 0.0
        assert kpi["plan_directo_mensual"] == 0
        assert kpi["meta_gestion_mensual"] == 0


def test_kpis_calculos_agregados_y_filtros(client):
    """
    Verifica agregaciones de KPIs y aplicación de filtros dinámicos:
    - Mes abril 2026: 2 contratos (40h + 44h = 84h contratadas)
    - Horas directas: 40*0.65 + 44*0.65 = 26 + 28.6 = 54.6h
    - FOJA: 54.6 / 84 * 100 = 65.0%
    - Plan Directo: 150 + 180 = 330
    - Meta Gestión: 135 + 162 = 297
    """
    # 1. Filtro por período abril
    resp_abril = client.get("/api/kpis?periodo=2026-04-01")
    assert resp_abril.status_code == 200
    kpi_abril = resp_abril.json()

    assert kpi_abril["total_profesionales"] == 2
    assert kpi_abril["total_contratos"] == 2
    assert kpi_abril["horas_contratadas_semanales"] == 84.0
    assert kpi_abril["horas_directas_semanales"] == 54.6
    assert kpi_abril["foja_pct"] == 65.0
    assert kpi_abril["plan_directo_mensual"] == 330
    assert kpi_abril["meta_gestion_mensual"] == 297

    # 2. Filtro por sede Santiago (IT 131) en abril
    resp_san = client.get("/api/kpis?periodo=2026-04-01&it=131")
    assert resp_san.status_code == 200
    kpi_san = resp_san.json()
    assert kpi_san["total_contratos"] == 1
    assert kpi_san["horas_contratadas_semanales"] == 40.0
    assert kpi_san["plan_directo_mensual"] == 150
    assert kpi_san["meta_gestion_mensual"] == 135

    # 3. Filtro por área Kinesiología en abril
    resp_kin = client.get("/api/kpis?periodo=2026-04-01&area=Kinesiologia")
    assert resp_kin.status_code == 200
    kpi_kin = resp_kin.json()
    assert kpi_kin["total_contratos"] == 1
    assert kpi_kin["horas_contratadas_semanales"] == 44.0
    assert kpi_kin["plan_directo_mensual"] == 180
    assert kpi_kin["meta_gestion_mensual"] == 162


def test_plan_paginacion_y_filtros(client):
    """GET /api/plan verifica paginación, total y campos de detalle."""
    # Página 1 (limit 2)
    resp = client.get("/api/plan?limit=2&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert len(data["items"]) == 2
    assert data["limit"] == 2
    assert data["offset"] == 0

    item = data["items"][0]
    assert "persona_id" in item
    assert "area" in item
    assert "horas_semanales" in item
    assert "plan_dir_m" in item
    assert "mg_dir_m" in item

    # Filtro por cargo
    resp_fisiatra = client.get("/api/plan?cargo=MEDICO FISIATRA")
    assert resp_fisiatra.status_code == 200
    assert resp_fisiatra.json()["total"] == 2

    # Filtro por área
    resp_area_kin = client.get("/api/plan?area=Kinesiologia")
    assert resp_area_kin.status_code == 200
    assert resp_area_kin.json()["total"] == 1


def test_plan_vs_real_agrupado_alertas_wcag(client):
    """
    GET /api/plan-vs-real con agrupación:
    Verifica el semáforo y la doble codificación WCAG (texto explícito + icono):
    - Santiago abril: Real 120 < MG 135 -> DÉFICIT CRÍTICO (icono ⚠️)
    - Concepción abril: Real 170 >= MG 162 y < Plan 180 -> CUMPLIDO (icono ✅)
    - Santiago mayo: Real 145 >= Plan 140 -> SUPERÁVIT (icono 📈)
    """
    resp = client.get("/api/plan-vs-real?agrupado=true")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 3

    # Buscamos Santiago abril
    san_abril = next(i for i in items if i["it"] == 131 and i["periodo"] == "2026-04-01")
    assert san_abril["plan_directo"] == 150
    assert san_abril["real_directo"] == 120
    assert san_abril["meta_gestion"] == 135
    assert san_abril["cumplimiento_pct"] == 80.0
    assert san_abril["alerta"]["nivel"] == "CRITICO"
    assert san_abril["alerta"]["icono"] == "⚠️"

    # Buscamos Concepción abril
    con_abril = next(i for i in items if i["it"] == 81 and i["periodo"] == "2026-04-01")
    assert con_abril["plan_directo"] == 180
    assert con_abril["real_directo"] == 170
    assert con_abril["alerta"]["nivel"] == "CUMPLIDO"
    assert con_abril["alerta"]["icono"] == "✅"

    # Buscamos Santiago mayo
    san_mayo = next(i for i in items if i["it"] == 131 and i["periodo"] == "2026-05-01")
    assert san_mayo["plan_directo"] == 140
    assert san_mayo["real_directo"] == 145
    assert san_mayo["alerta"]["nivel"] == "SUPERAVIT"
    assert san_mayo["alerta"]["icono"] == "📈"

    # Filtro por área en plan-vs-real
    resp_area = client.get("/api/plan-vs-real?agrupado=true&area=Kinesiologia")
    assert resp_area.status_code == 200
    items_area = resp_area.json()
    assert len(items_area) == 1
    assert items_area[0]["cod_esp"] == "KI"


def test_plan_vs_real_desagrupado(client):
    """GET /api/plan-vs-real?agrupado=false retorna detalle con persona_id."""
    resp = client.get("/api/plan-vs-real?agrupado=false")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 3
    assert all("persona_id" in i and i["persona_id"] is not None for i in items)


def test_lotes_historial(client):
    """GET /api/lotes retorna el historial de lotes ordenados descendente."""
    resp = client.get("/api/lotes")
    assert resp.status_code == 200
    lotes = resp.json()
    assert len(lotes) == 2
    assert lotes[0]["lote_id"] == 2
    assert lotes[0]["tipo"] == "SIC"
    assert lotes[1]["lote_id"] == 1
    assert lotes[1]["tipo"] == "BUK"


def test_sla_latencia_endpoints(client):
    """
    SLA de latencia: cada endpoint debe responder en < 300ms (Issue #20).
    En local con SQLite/FastAPI esperamos < 30ms.
    """
    endpoints = [
        "/api/health",
        "/api/filtros",
        "/api/kpis",
        "/api/plan?limit=50",
        "/api/plan-vs-real?agrupado=true",
        "/api/lotes",
    ]

    for ep in endpoints:
        start = time.perf_counter()
        resp = client.get(ep)
        elapsed_ms = (time.perf_counter() - start) * 1000.0

        assert resp.status_code == 200
        assert elapsed_ms < 300.0, f"Endpoint {ep} excedió los 300ms SLA ({elapsed_ms:.2f}ms)"
