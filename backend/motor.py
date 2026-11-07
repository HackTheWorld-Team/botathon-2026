"""
backend/motor.py — Motor de cálculo asistencial (reglas §4 del README / Informe Técnico §3).

Pipeline completo:
1. Tramo inclusivo: T1 >= 40h · T2 >= 22h y < 40h · T3 < 22h.
2. Tope legal 42h: contratos > 42h se ajustan a 42h a partir de '2026-05-01' (no retroactivo).
3. Asignaciones especiales: se descuentan sumadas al % NAS base. Proporción Dir/Ind se mantiene.
4. Conversión a atenciones semanales con primer redondeo piso (floor).
5. Factor grupal (solo AS, ED, UTAC, UEDA, ULAB; Santiago/Concepción vs otras sedes).
6. Semanas efectivas = semanas hábiles - licencias - vacaciones - permisos.
7. Plan mensual y Meta de Gestión (MG 90%) con segundo redondeo piso (floor).
8. % FOJA y KPIs del modelo.
"""
from __future__ import annotations

import math
import sqlite3
from typing import Any, Dict, List, Optional, Tuple

ESPECIALIDADES_GRUPAL = {"AS", "ED", "UTAC", "UEDA", "ULAB"}
SEDES_SAN_CON = {81, 131}  # Concepción (81), Santiago (131)

SEMANAS_HABILES_2026_DEFAULT: Dict[int, float] = {
    1: 4.2, 2: 4.0, 3: 4.4, 4: 4.2, 5: 3.8, 6: 4.2,
    7: 4.4, 8: 4.2, 9: 4.2, 10: 4.2, 11: 4.2, 12: 4.2,
}


def tramo_inclusivo(horas: float) -> int:
    """
    Determina el tramo horario según límites inclusivos de Distribucion_NAC:
    - Tramo 1: >= 40 h
    - Tramo 2: >= 22 h y < 40 h
    - Tramo 3: < 22 h
    """
    if horas >= 40.0:
        return 1
    if horas >= 22.0:
        return 2
    return 3


def ajustar_tope_42h(horas: float, periodo: str) -> float:
    """
    Aplica tope legal de 42h desde el 1 de mayo de 2026 (transición legal 44h -> 42h).
    Ene-abr se mantienen si eran > 42h; may-dic se topan a 42h.
    """
    if periodo >= "2026-05-01" and horas > 42.0:
        return 42.0
    return float(horas)


def calcular_distribucion_final(
    horas: float,
    pct_directo_base: float,
    pct_indirecto_base: float,
    pct_nas_base: float,
    horas_asignaciones: float = 0.0,
) -> Dict[str, float]:
    """
    Aplica la Duda 1 validada:
    - Asignaciones se suman al % NAS base: NAS_tot% = NAS_base% + (horas_asig / horas)
    - % Asistencial = 1 - NAS_tot%
    - Se reparte el asistencial entre Directo e Indirecto manteniendo la proporción relativa.
    """
    if horas <= 0:
        return {
            "pct_nas_total": pct_nas_base,
            "pct_asistencial": 0.0,
            "pct_directo_final": 0.0,
            "pct_indirecto_final": 0.0,
        }

    pct_asig = horas_asignaciones / horas
    pct_nas_total = pct_nas_base + pct_asig
    pct_asistencial = max(0.0, 1.0 - pct_nas_total)

    base_total = pct_directo_base + pct_indirecto_base
    if base_total > 0:
        pct_directo_final = pct_asistencial * (pct_directo_base / base_total)
        pct_indirecto_final = pct_asistencial * (pct_indirecto_base / base_total)
    else:
        pct_directo_final = 0.0
        pct_indirecto_final = 0.0

    return {
        "pct_nas_total": pct_nas_total,
        "pct_asistencial": pct_asistencial,
        "pct_directo_final": pct_directo_final,
        "pct_indirecto_final": pct_indirecto_final,
    }


def calcular_atenciones_semanales(
    horas: float,
    pct_directo_final: float,
    pct_indirecto_final: float,
    min_directa: int = 30,
    min_indirecta: int = 30,
) -> Dict[str, int]:
    """
    Duda 3: Primer redondeo truncado hacia abajo (piso/floor) semanal individual.
    AteDir_Sem = floor((horas * %Dir_final * 60) / min_directa)
    AteInd_Sem = floor((horas * %Ind_final * 60) / min_indirecta)
    """
    if horas <= 0:
        return {"ate_dir_sem": 0, "ate_ind_sem": 0}

    min_dir = min_directa if min_directa > 0 else 30
    min_ind = min_indirecta if min_indirecta > 0 else 30

    # Usamos round sobre los minutos para evitar pequeñas imprecisiones binarias flotantes antes del floor
    minutos_dir = horas * pct_directo_final * 60.0
    minutos_ind = horas * pct_indirecto_final * 60.0

    ate_dir_sem = math.floor(round(minutos_dir, 9) / min_dir)
    ate_ind_sem = math.floor(round(minutos_ind, 9) / min_ind)

    return {
        "ate_dir_sem": int(ate_dir_sem),
        "ate_ind_sem": int(ate_ind_sem),
    }


def ajustar_atencion_grupal(
    ate_dir_sem: int,
    cod_esp: str,
    pct_grupal: float = 0.0,
    n_pacientes: float = 1.0,
) -> float:
    """
    Ajuste de capacidad semanal por atención grupal:
    Aplica a AS, ED, UTAC, UEDA, ULAB.
    AteDir_Total_Sem = AteDir_Sem * [ (1 - %Grupal) + (%Grupal * N_pac) ]
    """
    if cod_esp in ESPECIALIDADES_GRUPAL and pct_grupal > 0 and n_pacientes > 0:
        factor_grupal = (1.0 - pct_grupal) + (pct_grupal * n_pacientes)
        return float(ate_dir_sem * factor_grupal)
    return float(ate_dir_sem)


def calcular_semanas_efectivas(
    semanas_habiles: float,
    licencias: float = 0.0,
    vacaciones: float = 0.0,
    permisos: float = 0.0,
) -> float:
    """
    Semanas Efectivas = Semanas Hábiles - (Licencias + Vacaciones + Permisos)
    """
    descuentos = licencias + vacaciones + permisos
    return max(0.0, semanas_habiles - descuentos)


def calcular_plan_mensual(
    ate_dir_total_sem: float,
    ate_ind_sem: int,
    semanas_efectivas: float,
) -> Dict[str, int]:
    """
    Duda 3: Segundo redondeo truncado hacia abajo (piso/floor) mensual.
    PlanAteDir_m = floor(AteDir_Total_Sem * SemEfectivas_m)
    PlanAteInd_m = floor(AteInd_Sem * SemEfectivas_m)
    MG_Dir_m = floor(PlanAteDir_m * 0.90)
    """
    if semanas_efectivas <= 0:
        return {
            "plan_dir_m": 0,
            "plan_ind_m": 0,
            "plan_total_m": 0,
            "mg_dir_m": 0,
        }

    plan_dir_m = math.floor(round(ate_dir_total_sem * semanas_efectivas, 9))
    plan_ind_m = math.floor(round(ate_ind_sem * semanas_efectivas, 9))
    mg_dir_m = math.floor(round(plan_dir_m * 0.90, 9))

    return {
        "plan_dir_m": int(plan_dir_m),
        "plan_ind_m": int(plan_ind_m),
        "plan_total_m": int(plan_dir_m + plan_ind_m),
        "mg_dir_m": int(mg_dir_m),
    }


def calcular_foja(horas_disponibles_directa: float, horas_contratadas: float) -> float:
    """
    % FOJA = (Horas mensuales disponibles atención directa / Horas mensuales contratadas) * 100
    """
    if horas_contratadas <= 0:
        return 0.0
    return (horas_disponibles_directa / horas_contratadas) * 100.0


class CatalogosMotor:
    """Caché en memoria de parámetros de distribución, grupal y semanas para cálculo en lote."""

    def __init__(
        self,
        distribucion: Dict[Tuple[str, int], Dict[str, Any]],
        grupal: Dict[str, Dict[str, Any]],
        semanas: Dict[Tuple[int, int], float],
    ):
        self.distribucion = distribucion
        self.grupal = grupal
        self.semanas = semanas

    @classmethod
    def desde_db_con(cls, con: sqlite3.Connection) -> "CatalogosMotor":
        """Carga catálogos usando una conexión SQLite existente."""
        cur = con.cursor()

        dist = {}
        for r in cur.execute("SELECT * FROM parametros_distribucion"):
            cargo = str(r["cargo"]).strip().upper()
            tramo = int(r["tramo"])
            dist[(cargo, tramo)] = {
                "pct_directo": float(r["pct_directo"]),
                "pct_indirecto": float(r["pct_indirecto"]),
                "pct_nas": float(r["pct_nas"]),
                "min_directa": int(r["min_directa"]),
                "min_indirecta": int(r["min_indirecta"]),
            }

        grup = {}
        for r in cur.execute("SELECT * FROM parametros_grupal"):
            esp = str(r["cod_esp"]).strip().upper()
            grup[esp] = {
                "pct_grupal": float(r["pct_grupal"]),
                "n_pac_san_con": float(r["n_pac_san_con"]),
                "n_pac_otros": float(r["n_pac_otros"]),
            }

        sem = {}
        for r in cur.execute("SELECT anio, mes, semanas FROM semanas_habiles"):
            sem[(int(r["anio"]), int(r["mes"]))] = float(r["semanas"])

        return cls(distribucion=dist, grupal=grup, semanas=sem)

    @classmethod
    def desde_db(cls, db_path: str = "backend/db.sqlite") -> "CatalogosMotor":
        """Carga catálogos desde la base de datos SQLite."""
        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        try:
            return cls.desde_db_con(con)
        finally:
            con.close()


def calcular_contrato_mes(
    persona_id: int,
    it: int,
    periodo: str,
    cargo: str,
    cod_esp: str,
    horas_semanales: float,
    horas_asignaciones: float = 0.0,
    licencias: float = 0.0,
    vacaciones: float = 0.0,
    permisos: float = 0.0,
    catalogos: Optional[CatalogosMotor] = None,
) -> Dict[str, Any]:
    """
    Ejecuta el pipeline de cálculo completo para un registro de contrato en un periodo (YYYY-MM-01).
    """
    # 1. Ajuste legal 42h
    hs = ajustar_tope_42h(horas_semanales, periodo)
    tramo = tramo_inclusivo(hs)

    # 2. Búsqueda de parámetros base
    cargo_key = cargo.strip().upper() if cargo else ""
    esp_key = cod_esp.strip().upper() if cod_esp else ""

    pct_dir_base = 0.65
    pct_ind_base = 0.15
    pct_nas_base = 0.20
    min_dir = 30
    min_ind = 30

    if catalogos and (cargo_key, tramo) in catalogos.distribucion:
        p = catalogos.distribucion[(cargo_key, tramo)]
        pct_dir_base = p["pct_directo"]
        pct_ind_base = p["pct_indirecto"]
        pct_nas_base = p["pct_nas"]
        min_dir = p["min_directa"]
        min_ind = p["min_indirecta"]

    # 3. Distribución final (asignaciones)
    dist = calcular_distribucion_final(
        horas=hs,
        pct_directo_base=pct_dir_base,
        pct_indirecto_base=pct_ind_base,
        pct_nas_base=pct_nas_base,
        horas_asignaciones=horas_asignaciones,
    )

    # 4. Atenciones semanales
    ate_sem = calcular_atenciones_semanales(
        horas=hs,
        pct_directo_final=dist["pct_directo_final"],
        pct_indirecto_final=dist["pct_indirecto_final"],
        min_directa=min_dir,
        min_indirecta=min_ind,
    )

    # 5. Factor grupal
    pct_grup = 0.0
    n_pac = 1.0
    if catalogos and esp_key in catalogos.grupal:
        g = catalogos.grupal[esp_key]
        pct_grup = g["pct_grupal"]
        n_pac = g["n_pac_san_con"] if it in SEDES_SAN_CON else g["n_pac_otros"]

    ate_dir_total_sem = ajustar_atencion_grupal(
        ate_dir_sem=ate_sem["ate_dir_sem"],
        cod_esp=esp_key,
        pct_grupal=pct_grup,
        n_pacientes=n_pac,
    )

    # 6. Semanas hábiles y efectivas
    partes_fecha = periodo.split("-")
    anio = int(partes_fecha[0]) if len(partes_fecha) >= 1 else 2026
    mes = int(partes_fecha[1]) if len(partes_fecha) >= 2 else 1

    sem_habiles = SEMANAS_HABILES_2026_DEFAULT.get(mes, 4.2)
    if catalogos and (anio, mes) in catalogos.semanas:
        sem_habiles = catalogos.semanas[(anio, mes)]

    sem_efectivas = calcular_semanas_efectivas(
        semanas_habiles=sem_habiles,
        licencias=licencias,
        vacaciones=vacaciones,
        permisos=permisos,
    )

    # 7. Plan mensual y MG
    plan_m = calcular_plan_mensual(
        ate_dir_total_sem=ate_dir_total_sem,
        ate_ind_sem=ate_sem["ate_ind_sem"],
        semanas_efectivas=sem_efectivas,
    )

    # Horas disponibles semanales
    h_sem_disp_ate = hs * dist["pct_asistencial"]

    return {
        "persona_id": persona_id,
        "it": it,
        "periodo": periodo,
        "horas_efectivas_semanales": hs,
        "tramo": tramo,
        "pct_nas": dist["pct_nas_total"],
        "pct_asistencial": dist["pct_asistencial"],
        "pct_directo": dist["pct_directo_final"],
        "pct_indirecto": dist["pct_indirecto_final"],
        "h_sem_disp_ate": h_sem_disp_ate,
        "ate_dir_sem": ate_sem["ate_dir_sem"],
        "ate_ind_sem": ate_sem["ate_ind_sem"],
        "ate_dir_total_sem": ate_dir_total_sem,
        "sem_efectivas": sem_efectivas,
        "plan_dir_m": plan_m["plan_dir_m"],
        "plan_ind_m": plan_m["plan_ind_m"],
        "plan_total_m": plan_m["plan_total_m"],
        "mg_dir_m": plan_m["mg_dir_m"],
    }
