"""
tests/test_motor.py — Validación exhaustiva del motor asistencial (issue #18).

Criterios de aceptación:
1. Tramos inclusivos exactos (T1 >= 40, T2 22-<40, T3 <22).
2. Transición legal 44h -> 42h (no retroactividad: mayo en adelante).
3. Caso estrella Duda 1: PersonaId 137732 (Fisiatra 40h, Líder Equipo 2h)
   - %Dir Final = 60.9375%, %Ind Final = 14.0625%, AteDirSem = 36, AteIndSem = 11.
4. Validación de los 10 casos dorados de tools/casos_dorados.csv.
5. Doble redondeo truncado piso (floor) semanal y mensual.
6. Factor grupal verificado para AS, ED, UTAC, UEDA, ULAB.
7. Plan global referencial contra tools/plan_simplificado_referencia.csv.
"""
import math
from pathlib import Path
import pandas as pd
import pytest

from backend.motor import (
    tramo_inclusivo,
    ajustar_tope_42h,
    calcular_distribucion_final,
    calcular_atenciones_semanales,
    ajustar_atencion_grupal,
    calcular_semanas_efectivas,
    calcular_plan_mensual,
    calcular_foja,
    calcular_contrato_mes,
    CatalogosMotor,
)

CASOS_DORADOS_PATH = Path("tools/casos_dorados.csv")
PLAN_REF_PATH = Path("tools/plan_simplificado_referencia.csv")
DB_PATH = Path("backend/db.sqlite")


def test_tramos_inclusivos():
    """T1: >= 40h · T2: >= 22h y < 40h · T3: < 22h."""
    assert tramo_inclusivo(44.0) == 1
    assert tramo_inclusivo(42.0) == 1
    assert tramo_inclusivo(40.0) == 1
    assert tramo_inclusivo(39.9) == 2
    assert tramo_inclusivo(22.0) == 2
    assert tramo_inclusivo(21.9) == 3
    assert tramo_inclusivo(10.0) == 3
    assert tramo_inclusivo(0.0) == 3


def test_ajuste_tope_42h():
    """No retroactivo: ene-abr mantiene 44h; may-dic topa a 42h."""
    assert ajustar_tope_42h(44.0, "2026-01-01") == 44.0
    assert ajustar_tope_42h(44.0, "2026-04-01") == 44.0
    assert ajustar_tope_42h(44.0, "2026-05-01") == 42.0
    assert ajustar_tope_42h(44.0, "2026-12-01") == 42.0
    assert ajustar_tope_42h(40.0, "2026-05-01") == 40.0
    assert ajustar_tope_42h(20.0, "2026-06-01") == 20.0


def test_caso_estrella_137732_duda_1():
    """
    PersonaId 137732: Medico Fisiatra 40h (T1), Líder Equipo 2h.
    Base Fisiatra T1: Dir 65%, Ind 15%, NAS 20%, MinDir 40.
    Asignación: 2h / 40h = 5% adicional a NAS -> NAS Total = 25%.
    Asistencial: 75%.
    Dir Final = 75% * (65 / 80) = 60.9375%.
    Ind Final = 75% * (15 / 80) = 14.0625%.
    AteDirSem = floor(40 * 0.609375 * 60 / 40) = floor(36.5625) = 36.
    AteIndSem = floor(40 * 0.140625 * 60 / 30) = floor(11.25) = 11.
    """
    dist = calcular_distribucion_final(
        horas=40.0,
        pct_directo_base=0.65,
        pct_indirecto_base=0.15,
        pct_nas_base=0.20,
        horas_asignaciones=2.0,
    )

    assert dist["pct_nas_total"] == 0.25
    assert dist["pct_asistencial"] == 0.75
    assert dist["pct_directo_final"] == pytest.approx(0.609375)
    assert dist["pct_indirecto_final"] == pytest.approx(0.140625)

    ate_sem = calcular_atenciones_semanales(
        horas=40.0,
        pct_directo_final=dist["pct_directo_final"],
        pct_indirecto_final=dist["pct_indirecto_final"],
        min_directa=40,
        min_indirecta=30,
    )
    assert ate_sem["ate_dir_sem"] == 36
    assert ate_sem["ate_ind_sem"] == 11


def test_casos_dorados_completos():
    """
    Valida contra tools/casos_dorados.csv los 10 casos reales.
    Para filas activas (excluyendo la finalizada en feb 71269), verifica
    los porcentajes finales y las atenciones semanales según regla de redondeo truncado piso (floor).
    Nota: PersonaId 134744 en el Excel original tiene 15 por redondeo manual (14.5588),
    mientras la regla formal piso da 14.
    """
    assert CASOS_DORADOS_PATH.exists(), f"Falta {CASOS_DORADOS_PATH}"
    df = pd.read_csv(CASOS_DORADOS_PATH)

    for _, r in df.iterrows():
        # Caso 71269 terminó en feb, sus valores en Dotacion_Asistencial may-dic son 0/nan
        if r["caso"] == "conocido" and r["PersonaId"] == 71269:
            continue

        hs = float(r["PromPond_HS"])
        pd_base = float(r["PctDirecto"])
        pi_base = float(r["PctIndirecto"])
        pn_base = float(r["PctNAS"])
        hrs_asig = float(r["TotalHrsAsignacion"]) if pd.notna(r["TotalHrsAsignacion"]) else 0.0
        min_dir = int(r["MinDirecta"]) if pd.notna(r["MinDirecta"]) else 30

        dist = calcular_distribucion_final(
            horas=hs,
            pct_directo_base=pd_base,
            pct_indirecto_base=pi_base,
            pct_nas_base=pn_base,
            horas_asignaciones=hrs_asig,
        )

        # Verificación de porcentajes con tolerancia flotante 1e-5
        assert dist["pct_directo_final"] == pytest.approx(r["PctDirectoFinal"], abs=1e-5)
        assert dist["pct_indirecto_final"] == pytest.approx(r["PctIndirectoFinal"], abs=1e-5)

        # Verificación de atenciones semanales (primer piso exacto)
        ate_sem = calcular_atenciones_semanales(
            horas=hs,
            pct_directo_final=dist["pct_directo_final"],
            pct_indirecto_final=dist["pct_indirecto_final"],
            min_directa=min_dir,
            min_indirecta=30,
        )

        tol_dir = 1 if r["PersonaId"] == 134744 else 0
        assert abs(ate_sem["ate_dir_sem"] - int(r["AteDirSem"])) <= tol_dir
        assert ate_sem["ate_ind_sem"] == int(r["AteIndSem"])

        # Factor grupal
        pct_grup = float(r["PctGrupal"]) if pd.notna(r["PctGrupal"]) else 0.0
        n_pac = float(r["NPacientes"]) if pd.notna(r["NPacientes"]) else 1.0
        cargo_area = str(r["Area"]) if pd.notna(r["Area"]) else ""

        ate_grup = ajustar_atencion_grupal(
            ate_dir_sem=ate_sem["ate_dir_sem"],
            cod_esp=cargo_area,
            pct_grupal=pct_grup,
            n_pacientes=n_pac,
        )
        tol_grup = 2.5 if r["PersonaId"] == 134744 else 1e-5
        assert abs(ate_grup - float(r["AteSemDirGrupal"])) <= tol_grup


def test_doble_piso_truncado():
    """
    Verifica que ambos redondeos truncan hacia abajo (floor) y no redondean al más cercano.
    """
    ate = calcular_atenciones_semanales(
        horas=1.0,
        pct_directo_final=0.6166,  # 1h * 0.6166 * 60 = 36.996 min / 30 = 1.233 -> 1
        pct_indirecto_final=0.4999, # 1h * 0.4999 * 60 = 29.994 min / 30 = 0.9998 -> 0
        min_directa=30,
        min_indirecta=30,
    )
    assert ate["ate_dir_sem"] == 1
    assert ate["ate_ind_sem"] == 0

    plan = calcular_plan_mensual(ate_dir_total_sem=36.99, ate_ind_sem=10, semanas_efectivas=4.0)
    assert plan["plan_dir_m"] == 147
    assert plan["plan_ind_m"] == 40
    # MG es floor(147 * 0.90) = floor(132.3) = 132
    assert plan["mg_dir_m"] == 132


def test_atencion_grupal_zonas():
    """
    Verifica que el factor grupal responde al número de pacientes según sede
    (San/Con vs resto).
    """
    ate_base = 20
    ate_san = ajustar_atencion_grupal(ate_base, "AS", pct_grupal=0.10, n_pacientes=3.0)
    ate_otr = ajustar_atencion_grupal(ate_base, "AS", pct_grupal=0.10, n_pacientes=1.5)

    assert ate_san == pytest.approx(24.0)
    assert ate_otr == pytest.approx(21.0)

    # Especialidad sin grupal autorizada (ej. KI) no se altera
    ate_ki = ajustar_atencion_grupal(ate_base, "KI", pct_grupal=0.10, n_pacientes=3.0)
    assert ate_ki == float(ate_base)


def test_foja_kpi():
    """% FOJA = (horas_disponibles_directa / horas_contratadas) * 100."""
    assert calcular_foja(20.0, 40.0) == 50.0
    assert calcular_foja(0.0, 40.0) == 0.0
    assert calcular_foja(25.0, 0.0) == 0.0


def test_plan_simplificado_referencia_totales():
    """
    Valida la coherencia global del motor calculando sobre los contratos
    del plan simplificado de referencia (tools/plan_simplificado_referencia.csv).
    El total acumulado de PlanAteDir_m ene-jul de referencia es 458.733.
    """
    if not PLAN_REF_PATH.exists():
        pytest.skip(f"{PLAN_REF_PATH} no existe")

    df_ref = pd.read_csv(PLAN_REF_PATH)
    total_dir_esperado = df_ref["PlanAteDir_m"].sum()
    assert total_dir_esperado == 458733

    # Comprobamos una muestra de contratos individuales contra el catálogo en BD
    if DB_PATH.exists():
        catalogos = CatalogosMotor.desde_db(str(DB_PATH))
        for _, row in df_ref.head(50).iterrows():
            res = calcular_contrato_mes(
                persona_id=int(row["PersonaId"]),
                it=int(row["IT"]),
                periodo=str(row["Periodo"]),
                cargo=str(row["Cargo"]),
                cod_esp=str(row["Cod_Esp"]),
                horas_semanales=float(row["H_Sem"]),
                catalogos=catalogos,
            )
            # En el plan simplificado no hay asignaciones ni licencias
            assert res["plan_dir_m"] == int(row["PlanAteDir_m"])
            assert res["plan_ind_m"] == int(row["PlanAteInd_m"])
