#!/usr/bin/env python3
"""
tools/generar_sic.py — Generador y recalibrador de SIC sintético contra el motor real (Issue #28).

Genera `SIC_Atenciones_Reales.xlsx` (esquema §3.4 del README):
    Periodo | IT | PersonaId | Cod_Esp | Atenciones_Directas_Reales | Atenciones_Indirectas_Reales

Método:
  1. Lee los contratos reales de BUK (Dotacion_2026, ene–jul 2026, header fila 2).
  2. Calcula el PLAN REAL mediante backend.motor.calcular_contrato_mes (reglas oficiales §4).
  3. REAL = Plan × perfil_por_especialidad × jitter_fila × bias_persona (semilla fija).
  4. ~0,5% de persona-mes en 0 atenciones (simula licencias médicas).
  5. Asegura coherencia exacta entre planes calculados por el motor y atenciones reales en SIC.

Perfiles (--perfil):
  balanceado  : media ~95% del plan; FI/EN/UTAC en déficit 72-84%; TO/AS en superávit 104-108%.
  deficit     : la mayoría 80-95% del plan.
  superavit   : la mayoría 95-110% del plan.
"""
import argparse
import hashlib
import os
import random
from pathlib import Path

import pandas as pd

from backend.motor import CatalogosMotor, calcular_contrato_mes

BUK_XLSX = "Nac - Base contratos x mes.xlsx"
DB_PATH = "backend/db.sqlite"

PERFILES = {
    "balanceado": {
        "FI": 0.78, "EN": 0.82, "UTAC": 0.72,
        "TO": 1.06, "AS": 1.04,
        "KI": 0.95, "ULAB": 0.93, "PC": 0.96, "FO": 0.97, "UEDA": 0.94
    },
    "deficit": {
        "FI": 0.86, "EN": 0.88, "UTAC": 0.80, "TO": 0.92, "AS": 0.90,
        "KI": 0.88, "ULAB": 0.86, "PC": 0.90, "FO": 0.90, "UEDA": 0.84
    },
    "superavit": {
        "FI": 1.02, "EN": 1.04, "UTAC": 0.98, "TO": 1.08, "AS": 1.06,
        "KI": 1.02, "ULAB": 1.01, "PC": 1.03, "FO": 1.04, "UEDA": 1.00
    },
}


def calcular_plan_motor(contratos: pd.DataFrame, db_path: str = DB_PATH) -> pd.DataFrame:
    """Calcula plan por contrato usando el motor asistencial oficial (backend.motor)."""
    catalogos = CatalogosMotor.desde_db(db_path)
    planes = []
    for _, r in contratos.iterrows():
        p_str = r["Periodo"].strftime("%Y-%m-%d") if isinstance(r["Periodo"], pd.Timestamp) else str(r["Periodo"])[:10]
        calc = calcular_contrato_mes(
            persona_id=int(r["PersonaId"]),
            it=int(r["IT"]),
            periodo=p_str,
            cargo=str(r["Cargo"]),
            horas_semanales=float(r["Horas Semanales"]),
            cod_esp=str(r["Cod_Esp"]),
            catalogos=catalogos
        )
        planes.append({
            "Periodo": r["Periodo"],
            "IT": int(r["IT"]),
            "PersonaId": int(r["PersonaId"]),
            "Cod_Esp": str(r["Cod_Esp"]).strip(),
            "Cargo": str(r["Cargo"]).strip().upper(),
            "H_Sem": float(r["Horas Semanales"]),
            "PlanAteDir_m": calc["plan_dir_m"],
            "PlanAteInd_m": calc["plan_ind_m"],
            "MG_Dir_m": calc["mg_dir_m"]
        })
    return pd.DataFrame(planes)


def generar_sic(plan: pd.DataFrame, perfil: dict, seed: int) -> pd.DataFrame:
    rng_master = random.Random(seed)
    personas = plan["PersonaId"].unique().tolist()
    bias = {p: 1.0 + (rng_master.random() * 0.04 - 0.02) for p in personas}

    filas = []
    for _, r in plan.iterrows():
        key = f"{r['PersonaId']}|{r['IT']}|{r['Periodo'].strftime('%Y-%m')}|{seed}".encode()
        rng = random.Random(int(hashlib.sha256(key).hexdigest(), 16) % (2**32))
        mult = perfil.get(r["Cod_Esp"], 0.95) * bias[r["PersonaId"]] * rng.uniform(0.97, 1.03)
        licencia = rng.random() < 0.005
        real_dir = 0 if licencia else max(0, round(r["PlanAteDir_m"] * mult))
        real_ind = 0 if licencia else max(0, round(r["PlanAteInd_m"] * mult * rng.uniform(0.98, 1.05)))
        filas.append({
            "Periodo": r["Periodo"],
            "IT": r["IT"],
            "PersonaId": r["PersonaId"],
            "Cod_Esp": r["Cod_Esp"],
            "Atenciones_Directas_Reales": int(real_dir),
            "Atenciones_Indirectas_Reales": int(real_ind),
        })
    return pd.DataFrame(filas)


def recalibrar_y_generar(
    buk_path: str = BUK_XLSX,
    db_path: str = DB_PATH,
    out_path: str = "SIC_Atenciones_Reales.xlsx",
    plan_out: str = "tools/plan_simplificado_referencia.csv",
    perfil: str = "balanceado",
    seed: int = 42
) -> pd.DataFrame:
    contratos = pd.read_excel(buk_path, sheet_name="Dotacion_2026", header=1)
    contratos = contratos[contratos["Periodo"].dt.year == 2026].copy()

    plan = calcular_plan_motor(contratos, db_path=db_path)
    sic = generar_sic(plan, PERFILES[perfil], seed)

    Path(plan_out).parent.mkdir(parents=True, exist_ok=True)
    plan.to_csv(plan_out, index=False)
    sic.to_excel(out_path, sheet_name="Atenciones_Reales", index=False)
    return sic


def main():
    ap = argparse.ArgumentParser(description="Genera y recalibra SIC sintético contra el motor asistencial.")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--perfil", choices=list(PERFILES), default="balanceado")
    ap.add_argument("--db", default="backend/db.sqlite")
    ap.add_argument("--out", default="SIC_Atenciones_Reales.xlsx")
    ap.add_argument("--plan-out", default="tools/plan_simplificado_referencia.csv")
    args = ap.parse_args()

    sic = recalibrar_y_generar(
        buk_path=BUK_XLSX,
        db_path=args.db,
        out_path=args.out,
        plan_out=args.plan_out,
        perfil=args.perfil,
        seed=args.seed
    )
    print(f"SIC recalibrado generado: {len(sic)} filas -> {args.out}")


if __name__ == "__main__":
    main()
