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

    # 7. Insertar catálogos de parámetros base para /api/parametros
    con.executemany(
        """
        INSERT INTO parametros_distribucion (
            cargo, tramo, pct_directo, pct_indirecto, pct_nas, min_directa, min_indirecta
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        [
            ("MEDICO FISIATRA", 1, 0.65, 0.15, 0.20, 30, 30),
            ("KINESIOLOGO", 1, 0.75, 0.10, 0.15, 30, 30),
        ],
    )
    con.execute(
        """
        INSERT INTO parametros_grupal (cod_esp, pct_grupal, n_pac_san_con, n_pac_otros)
        VALUES ('AS', 0.10, 5.0, 4.0)
        """
    )
    con.execute(
        """
        INSERT INTO asignaciones (nombre, horas_semana, requiere_vb_dmn)
        VALUES ('Líder Equipo', 4.0, 1)
        """
    )
    con.executemany(
        "INSERT INTO semanas_habiles (anio, mes, semanas) VALUES (?, ?, ?)",
        [(2026, 4, 4.2), (2026, 5, 3.8)],
    )

    # 8. Insertar rechazados y deltas de prueba para lote 1
    con.executemany(
        """
        INSERT INTO rechazados (lote_id, fila_origen, motivo, detalle, payload)
        VALUES (?, ?, ?, ?, ?)
        """,
        [
            (1, 12, "NEGATIVE_HS", "Horas Semanales negativas: -10", '{"PersonaId": 9001, "Horas Semanales": -10}'),
            (1, 15, "NEGATIVE_HS", "Horas Semanales negativas: -5", '{"PersonaId": 9002, "Horas Semanales": -5}'),
            (1, 20, "BAD_IT", "IT 999 no existe en catálogo", '{"PersonaId": 9003, "IT": 999}'),
        ],
    )
    con.executemany(
        """
        INSERT INTO deltas (lote_id, periodo, persona_id, it, tipo_delta, valor_anterior, valor_nuevo, detalle)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (1, "2026-05-01", 1001, 131, "CAMBIO_JORNADA", "40.0h", "42.0h", "Cambio de jornada 40h a 42h"),
            (1, "2026-05-01", 1002, 81, "BAJA", "44.0h (IT 81)", "No figura en dotación", "Baja respecto a 2026-04-01"),
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


def test_lote_rechazados_y_reporte(client):
    """
    GET /api/lotes/{lote_id}/rechazados y /reporte-rechazos:
    Verifica el desglose por regla de validación y la descarga del reporte.
    """
    resp = client.get("/api/lotes/1/rechazados")
    assert resp.status_code == 200
    data = resp.json()
    assert data["lote_id"] == 1
    assert data["total_rechazados"] == 3
    assert len(data["rechazados"]) == 3

    resumen = {r["motivo"]: r["cantidad"] for r in data["resumen_reglas"]}
    assert resumen["NEGATIVE_HS"] == 2
    assert resumen["BAD_IT"] == 1

    # Lote inexistente -> 404
    resp_404 = client.get("/api/lotes/999/rechazados")
    assert resp_404.status_code == 404

    # Descarga de reporte Excel/CSV
    resp_rep = client.get("/api/lotes/1/reporte-rechazos")
    assert resp_rep.status_code == 200
    assert len(resp_rep.content) > 0


def test_deltas_antes_despues_y_meses_congelados(client):
    """
    GET /api/deltas verifica el resumen de cambios, comparativa por instituto y profesional,
    y que los meses previos al corte figuren como congelados/inmutables (#47).
    """
    resp = client.get("/api/deltas?periodo_corte=2026-05-01")
    assert resp.status_code == 200
    data = resp.json()

    assert data["periodo_corte"] == "2026-05-01"
    assert data["periodo_anterior"] == "2026-04-01"
    assert data["resumen"]["CAMBIO_JORNADA"] == 1
    assert data["resumen"]["BAJA"] == 1
    assert len(data["deltas"]) == 2

    # Comparativa por instituto
    comp_it = {r["it"]: r for r in data["comparativa_institutos"]}
    assert 131 in comp_it
    assert comp_it[131]["horas_antes"] == 40.0
    assert comp_it[131]["horas_despues"] == 42.0
    assert comp_it[131]["delta_horas"] == 2.0

    # Comparativa por profesional
    comp_prof = {(r["persona_id"], r["it"]): r for r in data["comparativa_profesionales"]}
    assert (1001, 131) in comp_prof
    assert comp_prof[(1001, 131)]["tipo_delta"] == "CAMBIO_JORNADA"
    assert comp_prof[(1002, 81)]["tipo_delta"] == "BAJA"

    # Meses congelados (< 2026-05-01)
    assert len(data["meses_congelados"]) == 1
    abril = data["meses_congelados"][0]
    assert abril["periodo"] == "2026-04-01"
    assert abril["total_contratos"] == 2
    assert abril["plan_dir_total"] == 330
    assert abril["inmutable"] is True


def test_get_parametros(client):
    """GET /api/parametros retorna distribucion, grupal, asignaciones, semanas_habiles y auditoria."""
    resp = client.get("/api/parametros")
    assert resp.status_code == 200
    data = resp.json()

    assert "distribucion" in data
    assert "grupal" in data
    assert "asignaciones" in data
    assert "semanas_habiles" in data
    assert "auditoria" in data

    fisiatra_t1 = next(
        r for r in data["distribucion"] if r["cargo"] == "MEDICO FISIATRA" and r["tramo"] == 1
    )
    assert fisiatra_t1["pct_directo"] == 0.65
    assert fisiatra_t1["min_directa"] == 30


def test_simular_parametros_no_muta_bd(client):
    """
    POST /api/parametros/simular calcula el impacto proyectado desde vigencia_desde
    sin modificar parametros_distribucion ni planes en la base de datos.
    """
    payload = {
        "cargo": "MEDICO FISIATRA",
        "tramo": 1,
        "pct_directo": 0.75,
        "pct_indirecto": 0.10,
        "pct_nas": 0.15,
        "min_directa": 30,
        "min_indirecta": 30,
        "vigencia_desde": "2026-05-01",
        "incluir_vacantes": False,
        "horas_vacantes_semanales": 0.0,
    }
    resp = client.post("/api/parametros/simular", json=payload)
    assert resp.status_code == 200
    sim = resp.json()

    assert sim["vigencia_desde"] == "2026-05-01"
    assert sim["contratos_afectados"] == 1
    assert sim["plan_dir_actual"] == 140
    # 42h * 0.75 * 60 / 30 = 63 ate_dir_sem -> floor(63 * 3.8) = 239
    assert sim["plan_dir_simulado"] == 239
    assert sim["delta_plan_dir"] == 99
    assert sim["foja_simulado_pct"] == 75.0

    # Verificar que la BD NO fue modificada por la simulación
    resp_params = client.get("/api/parametros").json()
    fisiatra_t1 = next(
        r for r in resp_params["distribucion"] if r["cargo"] == "MEDICO FISIATRA" and r["tramo"] == 1
    )
    assert fisiatra_t1["pct_directo"] == 0.65

    resp_kpi_mayo = client.get("/api/kpis?periodo=2026-05-01").json()
    assert resp_kpi_mayo["plan_directo_mensual"] == 140


def test_patch_parametros_recalculo_vigencia_y_auditoria(client):
    """
    PATCH /api/parametros (#21):
    1. Valida porcentajes (rechaza suma != 100% con 400).
    2. Actualiza parametros_distribucion en SQLite.
    3. Recalcula planes SOLO para periodo >= 2026-05-01.
    4. Mantiene 100% intactos los planes de periodos < 2026-05-01 (abril = 150 y 180).
    5. Registra la auditoría en auditoria_parametros con usuario, timestamp y valores antes/después.
    """
    # 1. Validación rechaza suma inválida
    bad_resp = client.patch(
        "/api/parametros",
        json={
            "cargo": "MEDICO FISIATRA",
            "tramo": 1,
            "pct_directo": 0.80,
            "pct_indirecto": 0.30,
            "pct_nas": 0.20,
            "vigencia_desde": "2026-05-01",
        },
    )
    assert bad_resp.status_code == 400

    # 2. Capturar estado de abril (< 2026-05-01) antes del PATCH
    abril_antes = client.get("/api/plan?periodo=2026-04-01").json()["items"]
    kpi_abril_antes = client.get("/api/kpis?periodo=2026-04-01").json()

    # 3. Aplicar PATCH válido desde 2026-05-01
    patch_resp = client.patch(
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
            "usuario": "dra_soto",
            "motivo": "Aumento de dedicación directa desde mayo 2026",
        },
    )
    assert patch_resp.status_code == 200
    res = patch_resp.json()

    assert res["status"] == "ok"
    assert res["planes_recalculados"] == 1
    assert "2026-04-01" in res["periodos_inmutables"]
    assert res["regla_actualizada"]["pct_directo"] == 0.75
    assert res["auditoria"]["usuario"] == "dra_soto"
    assert res["auditoria"]["tipo_cambio"] == "DISTRIBUCION"
    assert res["auditoria"]["entidad_clave"] == "MEDICO FISIATRA:T1"
    assert res["auditoria"]["vigencia_desde"] == "2026-05-01"

    # 4. Verificar que mayo (>= 2026-05-01) se recalculó (239 atenciones directas, MG 215)
    kpi_mayo_despues = client.get("/api/kpis?periodo=2026-05-01").json()
    assert kpi_mayo_despues["plan_directo_mensual"] == 239
    assert kpi_mayo_despues["meta_gestion_mensual"] == 215
    assert kpi_mayo_despues["foja_pct"] == 75.0

    # 5. Verificar NO-RETROACTIVIDAD: abril (< 2026-05-01) permanece 100% idéntico
    abril_despues = client.get("/api/plan?periodo=2026-04-01").json()["items"]
    kpi_abril_despues = client.get("/api/kpis?periodo=2026-04-01").json()
    assert abril_despues == abril_antes
    assert kpi_abril_despues == kpi_abril_antes
    assert kpi_abril_despues["plan_directo_mensual"] == 330

    # 6. Verificar que el registro quedó persistido en GET /api/parametros -> auditoria
    params_after = client.get("/api/parametros").json()
    assert len(params_after["auditoria"]) >= 1
    ult_audit = params_after["auditoria"][0]
    assert ult_audit["usuario"] == "dra_soto"
    assert ult_audit["planes_recalculados"] == 1


def test_e2e_preparar_entorno_demo_y_stack_completo(tmp_path, monkeypatch):
    """
    Smoke Test E2E (Issue #55):
    1. Ejecuta preparar_entorno_demo(db_path=..., modo='completo') creando los 4 lotes de la demo.
    2. Verifica que /api/kpis, /api/lotes, /api/deltas, /api/plan-vs-real y /api/parametros
       retornan datos completos y coherentes con el guion de la demo.
    3. Verifica que '/' sirve el frontend estático (index.html con <div id="root">) cuando frontend/dist existe.
    """
    from tools.preparar_entorno_demo import preparar_entorno_demo

    tmp_db = tmp_path / "demo_e2e.sqlite"
    tmp_in = tmp_path / "entrada"
    tmp_rep = tmp_path / "reportes"

    res = preparar_entorno_demo(
        db_path=str(tmp_db),
        modo="completo",
        entrada_dir=str(tmp_in),
        reportes_dir=str(tmp_rep),
    )

    assert len(res["lotes"]) == 4
    assert res["lotes"][0]["validos"] == 3123
    assert res["lotes"][1]["validos"] == 445
    assert res["lotes"][1]["rechazados"] == 6
    assert res["lotes"][2]["validos"] == 450
    assert res["lotes"][3]["validos"] == 3123

    monkeypatch.setenv("BOTATHON_DB_PATH", str(tmp_db))
    with TestClient(app) as demo_client:
        # 1. /api/kpis
        kpis = demo_client.get("/api/kpis?periodo=2026-05-01").json()
        assert kpis["total_contratos"] >= 450
        assert kpis["plan_directo_mensual"] > 0
        assert kpis["meta_gestion_mensual"] > 0
        assert kpis["foja_pct"] > 0

        # 2. /api/lotes y rechazados del Lote 2
        lotes = demo_client.get("/api/lotes").json()
        assert len(lotes) == 4
        lote_corrupto = next(l for l in lotes if l["rechazados"] == 6)
        rech_detail = demo_client.get(f"/api/lotes/{lote_corrupto['lote_id']}/rechazados").json()
        assert rech_detail["total_rechazados"] == 6
        assert len(rech_detail["resumen_reglas"]) == 6

        # 3. /api/deltas (Mayo 42h vs Abril, multi-sede 125129 y meses congelados ene-abr)
        deltas = demo_client.get("/api/deltas?periodo_corte=2026-05-01").json()
        assert deltas["resumen"]["ALTA"] >= 1
        assert deltas["resumen"]["CAMBIO_JORNADA"] >= 140
        assert deltas["resumen"]["MULTI_SEDE"] >= 2
        assert len(deltas["meses_congelados"]) == 4
        assert all(m["inmutable"] is True for m in deltas["meses_congelados"])

        # 4. /api/plan-vs-real (cruce con SIC Real)
        pvr = demo_client.get("/api/plan-vs-real?periodo=2026-04-01&agrupado=true").json()
        assert len(pvr) > 0
        assert any(item["real_directo"] > 0 for item in pvr)

        # 5. /api/parametros
        params = demo_client.get("/api/parametros").json()
        assert len(params["distribucion"]) >= 50
        assert len(params["grupal"]) == 5
        assert len(params["semanas_habiles"]) == 12

        # 6. Servido estático de frontend/dist en '/'
        frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
        if frontend_dist.exists():
            root_resp = demo_client.get("/")
            assert root_resp.status_code == 200
            assert '<div id="root">' in root_resp.text


