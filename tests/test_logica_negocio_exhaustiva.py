"""
tests/test_logica_negocio_exhaustiva.py — Auditoría exhaustiva de lógica de negocio (Issue #67).

Cubre todas las reglas del desafío (§4 Dudas 1-4, bordes, factor grupal, zonas y casos dorados):
1. Duda 1 (Asignaciones absorbidas en NAS):
   - Caso estrella PersonaId 137732 (Fisiatra 40h, Líder Equipo 2h) al cuarto decimal:
     %NAS = 25.0%, %Asistencial = 75.0%, %Dir_final = 60.9375% (0.609375), %Ind_final = 14.0625% (0.140625).
   - Invariante de suma 100%: %Dir_final + %Ind_final + %NAS_final == 1.0 para toda combinación válida.
   - Comportamiento con 0, 1 y 2 asignaciones especiales (ej. kinesiólogo 42h con 2 asignaciones).
2. Duda 2 (Tramos inclusivos e inmutabilidad):
   - Fronteras exactas de determinar_tramo / tramo_inclusivo:
     44.0 -> T1 (1), 42.0 -> T1 (1), 40.0 -> T1 (1), 39.99 -> T2 (2),
     22.0 -> T2 (2), 21.99 -> T3 (3), 10.0 -> T3 (3), 0.0 -> T3 (3).
3. Duda 3 (Horas -> Atenciones, Factor Grupal y Doble Redondeo Piso):
   - Primer truncado (math.floor) en AteDir_Sem y AteInd_Sem ANTES de multiplicar por factor grupal y SemEfectivas_m.
   - Factor grupal [(1 - %Grupal) + (%Grupal * N_pac)] en cargos grupales (AS, ED, UTAC, UEDA, ULAB)
     y factor efectivo 1.0 en cargos individuales (FI, KI, TO, FO, PS, EN, NU, OR).
   - Minutos estándar por cargo (30, 40 para ULAB/FI/KI, 45, 60) e indirecta fijo en 30 min.
   - MG_m = math.floor(PlanAteDir_m * 0.90) con segundo truncado piso.
4. Duda 4 (Transición legal 44h -> 42h en Mayo 2026):
   - Contrato de 44h en 2026-01..2026-04 conserva 44h (ajuste_42h_aplicado == False).
   - Contrato de 44h en 2026-05..2026-12 se acota a 42h (ajuste_42h_aplicado == True).
   - Contratos de 40h o 36h no sufren recorte en mayo ni el resto del año.
5. Casos especiales y Casos Dorados:
   - Multi-sede: 115444 (Iqu 36h -> T2 + Coy 6h -> T3) y 125129 (Ant 35h -> T2 + Cal 8h -> T3).
   - Variación por semanas hábiles/efectivas (SemHab_m: ene 4.2, feb 4.0, mar 4.4, abr 4.2, may 3.8, jul 4.4)
     y descuentos por vacaciones/permisos/feriados regionales (zonas extremas Arica/Ñuble/Aysén).
   - Re-verificación al 100% de los 10 casos de tools/casos_dorados.csv.
"""
from __future__ import annotations

import math
import os
import sqlite3
import sys
from pathlib import Path
from typing import Dict, Tuple

import pandas as pd
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.motor import (
    ESPECIALIDADES_GRUPAL,
    SEDES_SAN_CON,
    SEMANAS_HABILES_2026_DEFAULT,
    CatalogosMotor,
    ajustar_atencion_grupal,
    ajustar_tope_42h,
    calcular_atenciones_semanales,
    calcular_contrato_mes,
    calcular_distribucion_final,
    calcular_foja,
    calcular_plan_mensual,
    calcular_semanas_efectivas,
    tramo_inclusivo,
)

CASOS_DORADOS_PATH = REPO_ROOT / "tools" / "casos_dorados.csv"
DB_PATH = REPO_ROOT / "backend" / "db.sqlite"


def determinar_tramo_label(horas: float) -> str:
    """Helper que mapea tramo_inclusivo (1, 2, 3) a etiqueta formal ('T1', 'T2', 'T3')."""
    return f"T{tramo_inclusivo(horas)}"


@pytest.fixture(scope="module")
def catalogos_motor() -> CatalogosMotor:
    """Carga catálogos reales desde backend/db.sqlite o los inicializa en memoria desde seed.py."""
    if DB_PATH.exists():
        try:
            cat = CatalogosMotor.desde_db(str(DB_PATH))
            if cat.distribucion and cat.grupal and cat.semanas:
                return cat
        except Exception:
            pass

    from backend.seed import (
        INSTITUTOS,
        SEMANAS_2026,
        cargar_distribucion,
        cargar_grupal,
    )

    prev_cwd = Path.cwd()
    os.chdir(REPO_ROOT)
    try:
        schema_sql = (REPO_ROOT / "backend" / "schema.sql").read_text(encoding="utf-8")
        con = sqlite3.connect(":memory:")
        con.row_factory = sqlite3.Row
        con.executescript(schema_sql)
        con.executemany(
            "INSERT OR REPLACE INTO institutos (it, sigla, nombre) VALUES (?,?,?)",
            [(it, sig, sig) for it, sig in INSTITUTOS],
        )
        con.executemany(
            "INSERT OR REPLACE INTO semanas_habiles VALUES (?,?,?)",
            [(2026, m, s) for m, s in SEMANAS_2026.items()],
        )
        cargar_distribucion(con)
        cargar_grupal(con)
        con.commit()
        cat = CatalogosMotor.desde_db_con(con)
        con.close()
        return cat
    finally:
        os.chdir(prev_cwd)


# ==============================================================================
# 1. DUDA 1: ASIGNACIONES ABSORBIDAS EN NAS E INVARIANTE DE SUMA 100%
# ==============================================================================


def test_duda1_caso_estrella_137732_cuarto_decimal():
    """
    Caso PersonaId 137732 (Médico Fisiatra 40h, Líder Equipo 2h):
    - Base Fisiatra T1: %Dir = 65%, %Ind = 15%, %NAS = 20%
    - Asignación: 2h / 40h = 5.0% absorbida en NAS -> %NAS = 25.0% (0.2500)
    - %Asistencial = 1 - 0.25 = 75.0% (0.7500)
    - %Dir_final = 0.75 * (0.65 / 0.80) = 0.609375 (60.9375%)
    - %Ind_final = 0.75 * (0.15 / 0.80) = 0.140625 (14.0625%)
    """
    dist = calcular_distribucion_final(
        horas=40.0,
        pct_directo_base=0.65,
        pct_indirecto_base=0.15,
        pct_nas_base=0.20,
        horas_asignaciones=2.0,
    )

    assert round(dist["pct_nas_total"], 6) == 0.250000
    assert round(dist["pct_asistencial"], 6) == 0.750000
    assert round(dist["pct_directo_final"], 6) == 0.609375
    assert round(dist["pct_indirecto_final"], 6) == 0.140625

    # Verificación explícita en porcentaje al cuarto decimal
    assert round(dist["pct_nas_total"] * 100, 4) == 25.0000
    assert round(dist["pct_asistencial"] * 100, 4) == 75.0000
    assert round(dist["pct_directo_final"] * 100, 4) == 60.9375
    assert round(dist["pct_indirecto_final"] * 100, 4) == 14.0625


@pytest.mark.parametrize(
    "horas,pct_dir_base,pct_ind_base,pct_nas_base,horas_asig",
    [
        (44.0, 0.65, 0.15, 0.20, 0.0),
        (42.0, 0.65, 0.10, 0.25, 1.0),
        (42.0, 0.65, 0.10, 0.25, 2.25),
        (42.0, 0.65, 0.10, 0.25, 2.75),
        (40.0, 0.65, 0.15, 0.20, 2.0),
        (40.0, 0.55, 0.15, 0.30, 3.75),
        (36.0, 0.65, 0.15, 0.20, 0.0),
        (33.0, 0.70, 0.10, 0.20, 1.5),
        (27.0, 0.60, 0.15, 0.25, 0.5),
        (22.0, 0.65, 0.15, 0.20, 1.0),
        (20.0, 0.75, 0.10, 0.15, 0.5),
        (20.0, 0.75, 0.10, 0.15, 0.75),
        (11.0, 0.75, 0.10, 0.15, 0.25),
        (6.0, 0.65, 0.15, 0.20, 0.0),
    ],
)
def test_duda1_invariante_suma_100_porciento(
    horas: float,
    pct_dir_base: float,
    pct_ind_base: float,
    pct_nas_base: float,
    horas_asig: float,
):
    """
    Invariante fundamental Duda 1:
    Para toda combinación válida de jornada y asignaciones no saturantes,
    %Dir_final + %Ind_final + %NAS_final == 1.0 (100%) y la proporción Dir/Ind se preserva.
    """
    assert pytest.approx(pct_dir_base + pct_ind_base + pct_nas_base, abs=1e-9) == 1.0

    dist = calcular_distribucion_final(
        horas=horas,
        pct_directo_base=pct_dir_base,
        pct_indirecto_base=pct_ind_base,
        pct_nas_base=pct_nas_base,
        horas_asignaciones=horas_asig,
    )

    suma_total = (
        dist["pct_directo_final"]
        + dist["pct_indirecto_final"]
        + dist["pct_nas_total"]
    )
    assert suma_total == pytest.approx(1.0, abs=1e-12)
    assert (
        dist["pct_directo_final"] + dist["pct_indirecto_final"]
    ) == pytest.approx(dist["pct_asistencial"], abs=1e-12)

    # La razón relativa Directo / Indirecto se mantiene idéntica a la base
    ratio_base = pct_dir_base / pct_ind_base
    ratio_final = dist["pct_directo_final"] / dist["pct_indirecto_final"]
    assert ratio_final == pytest.approx(ratio_base, abs=1e-12)


def test_duda1_cero_una_y_dos_asignaciones_especiales():
    """
    Verifica qué ocurre con 0, 1 y 2 asignaciones especiales (incluyendo casos reales de kinesiólogo 42h).
    """
    # 0 asignaciones: Fisiatra 36h (115444 en Iquique) -> porcentajes finales iguales a los base
    dist_0 = calcular_distribucion_final(
        horas=36.0,
        pct_directo_base=0.65,
        pct_indirecto_base=0.15,
        pct_nas_base=0.20,
        horas_asignaciones=0.0,
    )
    assert dist_0["pct_nas_total"] == pytest.approx(0.20)
    assert dist_0["pct_asistencial"] == pytest.approx(0.80)
    assert dist_0["pct_directo_final"] == pytest.approx(0.65)
    assert dist_0["pct_indirecto_final"] == pytest.approx(0.15)

    # 1 asignación: Fisiatra 40h con Líder Equipo (2.0h) -> PersonaId 137732
    dist_1 = calcular_distribucion_final(
        horas=40.0,
        pct_directo_base=0.65,
        pct_indirecto_base=0.15,
        pct_nas_base=0.20,
        horas_asignaciones=2.0,
    )
    assert dist_1["pct_nas_total"] == pytest.approx(0.25)
    assert dist_1["pct_directo_final"] == pytest.approx(0.609375)
    assert dist_1["pct_indirecto_final"] == pytest.approx(0.140625)

    # 2 asignaciones (Caso Dorado PersonaId 71580: Kinesiólogo 42h, GMFM 1h + Tutor docente 1h + colación = 2.25h tot)
    dist_2a = calcular_distribucion_final(
        horas=42.0,
        pct_directo_base=0.65,
        pct_indirecto_base=0.10,
        pct_nas_base=0.25,
        horas_asignaciones=2.25,
    )
    assert dist_2a["pct_nas_total"] == pytest.approx(0.25 + 2.25 / 42.0, abs=1e-12)
    assert dist_2a["pct_asistencial"] == pytest.approx(0.6964285714285714, abs=1e-12)
    assert dist_2a["pct_directo_final"] == pytest.approx(0.6035714285714285, abs=1e-12)
    assert dist_2a["pct_indirecto_final"] == pytest.approx(0.09285714285714286, abs=1e-12)
    ate_2a = calcular_atenciones_semanales(
        horas=42.0,
        pct_directo_final=dist_2a["pct_directo_final"],
        pct_indirecto_final=dist_2a["pct_indirecto_final"],
        min_directa=40,
        min_indirecta=30,
    )
    assert ate_2a["ate_dir_sem"] == 38
    assert ate_2a["ate_ind_sem"] == 7

    # 2 asignaciones (Caso Dorado PersonaId 120466: Kinesiólogo 42h, Coordinación 1h + Tutor docente 1h -> 2.75h tot)
    dist_2b = calcular_distribucion_final(
        horas=42.0,
        pct_directo_base=0.65,
        pct_indirecto_base=0.10,
        pct_nas_base=0.25,
        horas_asignaciones=2.75,
    )
    assert dist_2b["pct_nas_total"] == pytest.approx(0.31547619047619047, abs=1e-12)
    assert dist_2b["pct_asistencial"] == pytest.approx(0.6845238095238095, abs=1e-12)
    assert dist_2b["pct_directo_final"] == pytest.approx(0.5932539682539683, abs=1e-12)
    assert dist_2b["pct_indirecto_final"] == pytest.approx(0.09126984126984128, abs=1e-12)
    ate_2b = calcular_atenciones_semanales(
        horas=42.0,
        pct_directo_final=dist_2b["pct_directo_final"],
        pct_indirecto_final=dist_2b["pct_indirecto_final"],
        min_directa=40,
        min_indirecta=30,
    )
    assert ate_2b["ate_dir_sem"] == 37
    assert ate_2b["ate_ind_sem"] == 7


# ==============================================================================
# 2. DUDA 2: TRAMOS INCLUSIVOS E INMUTABILIDAD
# ==============================================================================


@pytest.mark.parametrize(
    "horas,tramo_esperado,etiqueta_esperada",
    [
        (44.0, 1, "T1"),
        (42.0, 1, "T1"),
        (40.0, 1, "T1"),
        (39.99, 2, "T2"),
        (22.0, 2, "T2"),
        (21.99, 3, "T3"),
        (10.0, 3, "T3"),
        (0.0, 3, "T3"),
    ],
)
def test_duda2_fronteras_exactas_determinar_tramo(
    horas: float, tramo_esperado: int, etiqueta_esperada: str
):
    """
    Verifica las fronteras exactas de determinar_tramo / tramo_inclusivo:
    44.0 -> T1, 42.0 -> T1, 40.0 -> T1, 39.99 -> T2, 22.0 -> T2, 21.99 -> T3, 10.0 -> T3, 0.0 -> T3.
    """
    assert tramo_inclusivo(horas) == tramo_esperado
    assert determinar_tramo_label(horas) == etiqueta_esperada


def test_duda2_inmutabilidad_pasado_ante_cambio_jornada(catalogos_motor: CatalogosMotor):
    """
    Verifica que al segmentar un contrato por vigencia (ej. cambio de jornada en mayo de 40h T1 a 30h T2),
    los meses pasados (ene-abr) permanecen inmutables en T1 y el nuevo tramo T2 rige solo desde mayo.
    """
    planes_ene_abr = [
        calcular_contrato_mes(
            persona_id=500001,
            it=11,
            periodo=f"2026-0{m}-01",
            cargo="KINESIOLOGO",
            cod_esp="KI",
            horas_semanales=40.0,
            catalogos=catalogos_motor,
        )
        for m in range(1, 5)
    ]
    planes_may_ago = [
        calcular_contrato_mes(
            persona_id=500001,
            it=11,
            periodo=f"2026-0{m}-01",
            cargo="KINESIOLOGO",
            cod_esp="KI",
            horas_semanales=30.0,
            catalogos=catalogos_motor,
        )
        for m in range(5, 9)
    ]

    for p in planes_ene_abr:
        assert p["tramo"] == 1
        assert p["horas_efectivas_semanales"] == 40.0

    for p in planes_may_ago:
        assert p["tramo"] == 2
        assert p["horas_efectivas_semanales"] == 30.0
        assert p["ate_dir_sem"] < planes_ene_abr[0]["ate_dir_sem"]


# ==============================================================================
# 3. DUDA 3: HORAS -> ATENCIONES, FACTOR GRUPAL Y DOBLE REDONDEO PISO
# ==============================================================================


def test_duda3_primer_truncado_antes_de_grupal_y_semanas_efectivas():
    """
    Verifica que el primer math.floor ocurre en AteDir_Sem y AteInd_Sem ANTES
    de multiplicar por el factor grupal y por SemEfectivas_m.
    Si NO se truncara antes del factor grupal ni de las semanas efectivas, el resultado cambiaría.
    """
    # Ejemplo: 40h * 0.609375 * 60 / 40 = 36.5625 -> truncado piso da 36 (no 36.5625 ni 37)
    ate = calcular_atenciones_semanales(
        horas=40.0,
        pct_directo_final=0.609375,
        pct_indirecto_final=0.140625,
        min_directa=40,
        min_indirecta=30,
    )
    assert ate["ate_dir_sem"] == 36  # math.floor(36.5625)
    assert ate["ate_ind_sem"] == 11  # math.floor(11.25)

    # Si fuera especialidad grupal AS (%Grupal=10%, N_pac=1.5 -> factor=1.05):
    # Con primer truncado antes: 36 * 1.05 = 37.8 -> * 4.2 sem = 158.76 -> floor = 158
    # Sin primer truncado antes: 36.5625 * 1.05 = 38.390625 -> * 4.2 sem = 161.24 -> floor = 161
    ate_grup = ajustar_atencion_grupal(
        ate_dir_sem=ate["ate_dir_sem"],
        cod_esp="AS",
        pct_grupal=0.10,
        n_pacientes=1.5,
    )
    assert ate_grup == pytest.approx(36 * 1.05)
    plan = calcular_plan_mensual(
        ate_dir_total_sem=ate_grup,
        ate_ind_sem=ate["ate_ind_sem"],
        semanas_efectivas=4.2,
    )
    assert plan["plan_dir_m"] == 158  # floor(37.8 * 4.2) = floor(158.76) = 158
    assert plan["plan_ind_m"] == 46   # floor(11 * 4.2) = floor(46.2) = 46


@pytest.mark.parametrize(
    "cod_esp,pct_grupal,n_pac",
    [
        ("AS", 0.10, 3.0),
        ("AS", 0.10, 1.5),
        ("ED", 0.10, 3.0),
        ("ED", 0.10, 1.5),
        ("UTAC", 0.55, 5.0),
        ("UTAC", 0.55, 3.0),
        ("UEDA", 0.55, 6.0),
        ("UEDA", 0.55, 3.0),
        ("ULAB", 0.10, 3.0),
        ("ULAB", 0.10, 1.5),
    ],
)
def test_duda3_factor_grupal_cargos_grupales(cod_esp: str, pct_grupal: float, n_pac: float):
    """
    Verifica que el factor grupal [(1 - %Grupal) + (%Grupal * N_pac)] aplica exactamente
    en los cargos grupales autorizados: AS, ED, UTAC, UEDA, ULAB.
    """
    assert cod_esp in ESPECIALIDADES_GRUPAL
    ate_base = 20
    factor_esperado = (1.0 - pct_grupal) + (pct_grupal * n_pac)
    resultado = ajustar_atencion_grupal(
        ate_dir_sem=ate_base,
        cod_esp=cod_esp,
        pct_grupal=pct_grupal,
        n_pacientes=n_pac,
    )
    assert resultado == pytest.approx(ate_base * factor_esperado, abs=1e-9)
    assert resultado > ate_base


@pytest.mark.parametrize("cod_esp", ["FI", "KI", "TO", "FO", "PS", "EN", "NU", "OR"])
def test_duda3_factor_grupal_cargos_individuales_es_uno(cod_esp: str):
    """
    Verifica que en los cargos individuales (FI, KI, TO, FO, PS, EN, NU, OR)
    el factor grupal efectivo es exactamente 1.0 incluso si se pasaran parámetros grupales > 0.
    """
    assert cod_esp not in ESPECIALIDADES_GRUPAL
    ate_base = 35
    resultado = ajustar_atencion_grupal(
        ate_dir_sem=ate_base,
        cod_esp=cod_esp,
        pct_grupal=0.55,
        n_pacientes=4.0,
    )
    assert resultado == float(ate_base)
    assert resultado / ate_base == 1.0


def test_duda3_minutos_estandar_por_cargo_e_indirecta_fijo_30(catalogos_motor: CatalogosMotor):
    """
    Verifica minutos estándar por cargo en el catálogo (30, 40 incl. ULAB, 45, 60)
    y que la atención indirecta tiene minutos estándar fijos en 30 min.
    Además verifica el cálculo matemático de calcular_atenciones_semanales para 30, 40, 45 y 60 min.
    """
    # 1. Verificar el cálculo directo para min_directa en {30, 40, 45, 60} y min_indirecta=30
    # Con 30h semanales, 60% directo (1080 min) y 15% indirecto (270 min):
    for min_dir, esperado_dir in [(30, 36), (40, 27), (45, 24), (60, 18)]:
        ate = calcular_atenciones_semanales(
            horas=30.0,
            pct_directo_final=0.60,
            pct_indirecto_final=0.15,
            min_directa=min_dir,
            min_indirecta=30,
        )
        assert ate["ate_dir_sem"] == esperado_dir
        assert ate["ate_ind_sem"] == 9  # 270 / 30 = 9 fijo

    # 2. Verificar en el catálogo real de la BD los minutos estándar y que indirecta es siempre 30
    minutos_directa_vistos = {v["min_directa"] for v in catalogos_motor.distribucion.values()}
    minutos_indirecta_vistos = {v["min_indirecta"] for v in catalogos_motor.distribucion.values()}

    assert {30, 40, 45, 60}.issubset(minutos_directa_vistos)
    assert minutos_indirecta_vistos == {30}

    # Verificar ULAB = 40 min (p. ej. TERAPEUTA OCUPACIONAL PROFESIONAL ULAB / ORIENTADOR LABORAL)
    cargos_ulab_40 = [
        cargo
        for (cargo, tramo), params in catalogos_motor.distribucion.items()
        if "ULAB" in cargo or "LABORAL" in cargo
    ]
    assert len(cargos_ulab_40) > 0
    for c in cargos_ulab_40:
        assert catalogos_motor.distribucion[(c, 1)]["min_directa"] == 40
        assert catalogos_motor.distribucion[(c, 1)]["min_indirecta"] == 30


@pytest.mark.parametrize(
    "ate_dir_total_sem,ate_ind_sem,sem_efectivas,plan_dir_esp,mg_esp",
    [
        (36.0, 11, 4.2, 151, 135),   # 36 * 4.2 = 151.2 -> 151; 151 * 0.90 = 135.9 -> 135
        (36.0, 11, 3.8, 136, 122),   # 36 * 3.8 = 136.8 -> 136; 136 * 0.90 = 122.4 -> 122
        (29.4, 10, 4.2, 123, 110),   # 29.4 * 4.2 = 123.48 -> 123; 123 * 0.90 = 110.7 -> 110
        (31.5, 3, 4.4, 138, 124),    # 31.5 * 4.4 = 138.6 -> 138; 138 * 0.90 = 124.2 -> 124
        (34.65, 12, 3.8, 131, 117),  # 34.65 * 3.8 = 131.67 -> 131; 131 * 0.90 = 117.9 -> 117
    ],
)
def test_duda3_segundo_truncado_piso_plan_y_mg_90(
    ate_dir_total_sem: float,
    ate_ind_sem: int,
    sem_efectivas: float,
    plan_dir_esp: int,
    mg_esp: int,
):
    """
    Verifica que PlanAteDir_m = math.floor(AteDir_Total_Sem * SemEfectivas_m)
    y MG_m = math.floor(PlanAteDir_m * 0.90) cumplen exactamente el segundo truncado piso.
    """
    res = calcular_plan_mensual(
        ate_dir_total_sem=ate_dir_total_sem,
        ate_ind_sem=ate_ind_sem,
        semanas_efectivas=sem_efectivas,
    )
    assert res["plan_dir_m"] == math.floor(round(ate_dir_total_sem * sem_efectivas, 9))
    assert res["plan_dir_m"] == plan_dir_esp
    assert res["mg_dir_m"] == math.floor(res["plan_dir_m"] * 0.90)
    assert res["mg_dir_m"] == mg_esp


# ==============================================================================
# 4. DUDA 4: TRANSICIÓN LEGAL 44h -> 42h EN MAYO 2026
# ==============================================================================


@pytest.mark.parametrize(
    "mes,esperado_hs,ajuste_42h_aplicado",
    [
        (1, 44.0, False),
        (2, 44.0, False),
        (3, 44.0, False),
        (4, 44.0, False),
        (5, 42.0, True),
        (6, 42.0, True),
        (7, 42.0, True),
        (8, 42.0, True),
        (9, 42.0, True),
        (10, 42.0, True),
        (11, 42.0, True),
        (12, 42.0, True),
    ],
)
def test_duda4_transicion_legal_44h_a_42h_todos_los_meses_2026(
    mes: int,
    esperado_hs: float,
    ajuste_42h_aplicado: bool,
    catalogos_motor: CatalogosMotor,
):
    """
    Verifica que un contrato de 44h en 2026-01..2026-04 conserva 44h (ajuste_42h_aplicado == False),
    pero en 2026-05..2026-12 se acota automáticamente a 42h (ajuste_42h_aplicado == True).
    """
    periodo = f"2026-{mes:02d}-01"
    hs_ajustada = ajustar_tope_42h(44.0, periodo)
    fue_ajustado = hs_ajustada < 44.0

    assert hs_ajustada == esperado_hs
    assert fue_ajustado is ajuste_42h_aplicado

    res = calcular_contrato_mes(
        persona_id=777001,
        it=131,
        periodo=periodo,
        cargo="KINESIOLOGO",
        cod_esp="KI",
        horas_semanales=44.0,
        catalogos=catalogos_motor,
    )
    assert res["horas_efectivas_semanales"] == esperado_hs
    assert (res["horas_efectivas_semanales"] < 44.0) is ajuste_42h_aplicado
    assert res["tramo"] == 1


@pytest.mark.parametrize("horas_contrato,tramo_esp", [(40.0, 1), (36.0, 2)])
@pytest.mark.parametrize("mes", range(1, 13))
def test_duda4_contratos_40h_y_36h_no_sufren_recorte_en_mayo(
    horas_contrato: float,
    tramo_esp: int,
    mes: int,
    catalogos_motor: CatalogosMotor,
):
    """
    Verifica que contratos de 40h o 36h no sufren ningún recorte en mayo ni en ningún mes de 2026.
    """
    periodo = f"2026-{mes:02d}-01"
    hs_ajustada = ajustar_tope_42h(horas_contrato, periodo)
    ajuste_42h_aplicado = hs_ajustada != horas_contrato

    assert hs_ajustada == horas_contrato
    assert ajuste_42h_aplicado is False

    res = calcular_contrato_mes(
        persona_id=777002,
        it=131,
        periodo=periodo,
        cargo="MEDICO FISIATRA",
        cod_esp="FI",
        horas_semanales=horas_contrato,
        catalogos=catalogos_motor,
    )
    assert res["horas_efectivas_semanales"] == horas_contrato
    assert res["tramo"] == tramo_esp


# ==============================================================================
# 5. CASOS ESPECIALES Y CASOS DORADOS (MULTI-SEDE, SEMANAS HÁBILES, ZONAS, 10 DORADOS)
# ==============================================================================


def test_caso_especial_multisede_115444_y_125129(catalogos_motor: CatalogosMotor):
    """
    Verifica profesionales multi-sede emblemáticos:
    1) PersonaId 115444 (Médico Fisiatra):
       - Iquique (IT 12): 36.0h -> Tramo 2 (T2), AteDirSem = 35, AteIndSem = 10
       - Coyhaique (IT 111): 6.0h -> Tramo 3 (T3), AteDirSem = 5, AteIndSem = 1
    2) PersonaId 125129 (Médico Fisiatra en Excepciones / BUK Mayo):
       - Antofagasta (IT 21): 35.0h -> Tramo 2 (T2)
       - Calama (IT 22): 8.0h -> Tramo 3 (T3)
    Cada sede evalúa su tramo según las horas del contrato en esa sede.
    """
    # 1. PersonaId 115444: Iquique (36h) + Coyhaique (6h)
    res_115444_iqu = calcular_contrato_mes(
        persona_id=115444,
        it=12,
        periodo="2026-05-01",
        cargo="MEDICO FISIATRA",
        cod_esp="FI",
        horas_semanales=36.0,
        catalogos=catalogos_motor,
    )
    res_115444_coy = calcular_contrato_mes(
        persona_id=115444,
        it=111,
        periodo="2026-05-01",
        cargo="MEDICO FISIATRA",
        cod_esp="FI",
        horas_semanales=6.0,
        catalogos=catalogos_motor,
    )

    assert res_115444_iqu["tramo"] == 2
    assert res_115444_iqu["ate_dir_sem"] == 35
    assert res_115444_iqu["ate_ind_sem"] == 10

    assert res_115444_coy["tramo"] == 3
    assert res_115444_coy["ate_dir_sem"] == 5
    assert res_115444_coy["ate_ind_sem"] == 1

    # 2. PersonaId 125129: Antofagasta (35h o 27h en T2) + Calama (8h en T3)
    res_125129_ant = calcular_contrato_mes(
        persona_id=125129,
        it=21,
        periodo="2026-05-01",
        cargo="MEDICO FISIATRA",
        cod_esp="FI",
        horas_semanales=35.0,
        catalogos=catalogos_motor,
    )
    res_125129_cal = calcular_contrato_mes(
        persona_id=125129,
        it=22,
        periodo="2026-05-01",
        cargo="MEDICO FISIATRA",
        cod_esp="FI",
        horas_semanales=8.0,
        catalogos=catalogos_motor,
    )

    assert res_125129_ant["tramo"] == 2
    assert res_125129_cal["tramo"] == 3
    assert res_125129_ant["ate_dir_sem"] > res_125129_cal["ate_dir_sem"]


def test_caso_especial_variacion_semanas_habiles_y_zonas_extremas(catalogos_motor: CatalogosMotor):
    """
    Verifica:
    1) Semanas hábiles por mes en 2026:
       ene=4.2, feb=4.0, mar=4.4, abr=4.2, may=3.8, jun=4.2, jul=4.4, ago-dic=4.2.
    2) Descuentos por vacaciones, permisos y feriados regionales (zonas extremas como Arica IT=11,
       Ñuble/Concepción, Aysén/Coyhaique IT=111) sobre las semanas efectivas y el plan mensual.
    3) Diferenciación geográfica de N_pacientes en atención grupal:
       Santiago (131) y Concepción (81) vs otras zonas (Arica 11, Iquique 12, Coyhaique 111).
    """
    esperadas = {
        1: 4.2,
        2: 4.0,
        3: 4.4,
        4: 4.2,
        5: 3.8,
        6: 4.2,
        7: 4.4,
        8: 4.2,
        9: 4.2,
        10: 4.2,
        11: 4.2,
        12: 4.2,
    }
    for mes, sem_esp in esperadas.items():
        assert SEMANAS_HABILES_2026_DEFAULT[mes] == sem_esp
        assert catalogos_motor.semanas[(2026, mes)] == sem_esp

    # Variación de plan mensual para un mismo contrato entre marzo (4.4), abril (4.2), mayo (3.8) y febrero (4.0)
    planes_por_mes = {
        mes: calcular_contrato_mes(
            persona_id=137732,
            it=11,
            periodo=f"2026-{mes:02d}-01",
            cargo="MEDICO FISIATRA",
            cod_esp="FI",
            horas_semanales=40.0,
            horas_asignaciones=2.0,
            catalogos=catalogos_motor,
        )
        for mes in (1, 2, 3, 4, 5, 7)
    }

    assert planes_por_mes[1]["sem_efectivas"] == 4.2
    assert planes_por_mes[2]["sem_efectivas"] == 4.0
    assert planes_por_mes[3]["sem_efectivas"] == 4.4
    assert planes_por_mes[4]["sem_efectivas"] == 4.2
    assert planes_por_mes[5]["sem_efectivas"] == 3.8
    assert planes_por_mes[7]["sem_efectivas"] == 4.4

    # Con AteDirSem = 36:
    # mar (4.4) -> floor(36*4.4)=158 > ene/abr (4.2) -> floor(36*4.2)=151 > feb (4.0) -> 144 > may (3.8) -> 136
    assert planes_por_mes[3]["plan_dir_m"] == 158
    assert planes_por_mes[1]["plan_dir_m"] == 151
    assert planes_por_mes[2]["plan_dir_m"] == 144
    assert planes_por_mes[5]["plan_dir_m"] == 136

    # Descuentos en zonas extremas:
    # Arica (IT 11) / Ñuble con feriado regional (ej. permisos=0.2 sem) y Aysén/Coyhaique (IT 111) con vacaciones adicionales
    res_arica_feriado = calcular_contrato_mes(
        persona_id=137732,
        it=11,  # Arica
        periodo="2026-06-01",
        cargo="MEDICO FISIATRA",
        cod_esp="FI",
        horas_semanales=40.0,
        horas_asignaciones=2.0,
        permisos=0.2,  # 1 día feriado regional = 0.2 semanas
        catalogos=catalogos_motor,
    )
    assert res_arica_feriado["sem_efectivas"] == pytest.approx(4.0)
    assert res_arica_feriado["plan_dir_m"] == 144  # floor(36 * 4.0)

    res_aysen_vacaciones = calcular_contrato_mes(
        persona_id=115444,
        it=111,  # Coyhaique (Aysén)
        periodo="2026-02-01",
        cargo="MEDICO FISIATRA",
        cod_esp="FI",
        horas_semanales=36.0,
        vacaciones=3.0,  # Vacaciones zona extrema Aysén
        permisos=0.2,
        catalogos=catalogos_motor,
    )
    assert res_aysen_vacaciones["sem_efectivas"] == pytest.approx(0.8)
    assert res_aysen_vacaciones["plan_dir_m"] == math.floor(35 * 0.8)

    # Diferencia geográfica de factor grupal: Santiago (131) / Concepción (81) vs Arica (11) / Coyhaique (111)
    res_as_santiago = calcular_contrato_mes(
        persona_id=900001,
        it=131,  # Santiago (en SEDES_SAN_CON)
        periodo="2026-01-01",
        cargo="ASISTENTE SOCIAL",
        cod_esp="AS",
        horas_semanales=40.0,
        catalogos=catalogos_motor,
    )
    res_as_arica = calcular_contrato_mes(
        persona_id=900001,
        it=11,  # Arica (fuera de SEDES_SAN_CON)
        periodo="2026-01-01",
        cargo="ASISTENTE SOCIAL",
        cod_esp="AS",
        horas_semanales=40.0,
        catalogos=catalogos_motor,
    )
    assert 131 in SEDES_SAN_CON and 81 in SEDES_SAN_CON
    assert 11 not in SEDES_SAN_CON and 111 not in SEDES_SAN_CON
    assert res_as_santiago["ate_dir_total_sem"] > res_as_arica["ate_dir_total_sem"]
    assert res_as_santiago["plan_dir_m"] > res_as_arica["plan_dir_m"]


def test_reverificacion_10_casos_dorados_al_100_porciento():
    """
    Re-verificación exhaustiva de los 10 casos de tools/casos_dorados.csv al 100%:
    Comprueba las 10 filas (incluyendo el contrato terminado en feb PersonaId 71269 con HSemAntesNAS=0.0
    y los 9 contratos activos ene-dic / may-dic).
    """
    assert CASOS_DORADOS_PATH.exists(), f"No existe {CASOS_DORADOS_PATH}"
    df = pd.read_csv(CASOS_DORADOS_PATH)
    assert len(df) == 10

    for idx, r in df.iterrows():
        pid = int(r["PersonaId"])
        hs_prom = float(r["PromPond_HS"])
        hs_vigente = float(r["HSemAntesNAS"])
        pd_base = float(r["PctDirecto"])
        pi_base = float(r["PctIndirecto"])
        pn_base = float(r["PctNAS"])
        hrs_asig = float(r["TotalHrsAsignacion"]) if pd.notna(r["TotalHrsAsignacion"]) else 0.0
        min_dir = int(r["MinDirecta"]) if pd.notna(r["MinDirecta"]) else 30
        area = str(r["Area"]).strip()

        # Verificar que el tramo por PromPond_HS corresponde a la regla de tramos inclusivos
        tramo = tramo_inclusivo(hs_prom)
        if r["caso"] == "tramo3_<22h" or pid in (71269, 134744, 74158) or (pid == 115444 and int(r["IT"]) == 111):
            assert tramo == 3
        elif r["caso"] == "tramo2_22a40_sin_asig":
            assert tramo == 2
        else:
            assert tramo == 1

        # Caso 71269: contrato finalizado el 2026-02-28 (HSemAntesNAS = 0.0 en foto anual vigente)
        if pid == 71269:
            ate_fin = calcular_atenciones_semanales(
                horas=hs_vigente,
                pct_directo_final=0.0,
                pct_indirecto_final=0.0,
                min_directa=min_dir,
                min_indirecta=30,
            )
            assert ate_fin["ate_dir_sem"] == int(r["AteDirSem"]) == 0
            assert ate_fin["ate_ind_sem"] == int(r["AteIndSem"]) == 0
            continue

        # Para los 9 casos activos: verificar distribución final al detalle
        dist = calcular_distribucion_final(
            horas=hs_vigente,
            pct_directo_base=pd_base,
            pct_indirecto_base=pi_base,
            pct_nas_base=pn_base,
            horas_asignaciones=hrs_asig,
        )

        assert dist["pct_nas_total"] == pytest.approx(float(r["PctNASmasAsig"]), abs=1e-9)
        assert dist["pct_asistencial"] == pytest.approx(float(r["PctAsistencial"]), abs=1e-9)
        assert dist["pct_directo_final"] == pytest.approx(float(r["PctDirectoFinal"]), abs=1e-9)
        assert dist["pct_indirecto_final"] == pytest.approx(float(r["PctIndirectoFinal"]), abs=1e-9)
        assert (
            dist["pct_directo_final"]
            + dist["pct_indirecto_final"]
            + dist["pct_nas_total"]
        ) == pytest.approx(1.0, abs=1e-12)

        ate_sem = calcular_atenciones_semanales(
            horas=hs_vigente,
            pct_directo_final=dist["pct_directo_final"],
            pct_indirecto_final=dist["pct_indirecto_final"],
            min_directa=min_dir,
            min_indirecta=30,
        )

        # Nota documentada en README/test_motor: en 134744 la planilla Excel tiene 15 (14.5588 redondeado)
        # mientras el piso estricto da 14. En los otros 8 casos activos coincide exactamente al entero.
        if pid == 134744:
            assert ate_sem["ate_dir_sem"] == 14
            assert int(r["AteDirSem"]) == 15
        else:
            assert ate_sem["ate_dir_sem"] == int(r["AteDirSem"])

        assert ate_sem["ate_ind_sem"] == int(r["AteIndSem"])

        # Verificar factor grupal sobre el AteDirSem
        pct_grup = float(r["PctGrupal"]) if pd.notna(r["PctGrupal"]) else 0.0
        n_pac = float(r["NPacientes"]) if pd.notna(r["NPacientes"]) else 1.0

        ate_grup_sobre_excel = ajustar_atencion_grupal(
            ate_dir_sem=int(r["AteDirSem"]),
            cod_esp=area,
            pct_grupal=pct_grup,
            n_pacientes=n_pac,
        )
        assert ate_grup_sobre_excel == pytest.approx(float(r["AteSemDirGrupal"]), abs=1e-6)
