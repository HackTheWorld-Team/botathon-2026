#!/usr/bin/env python3
"""
Generador de SIC sintético — Botathon 2026 Teletón.

Genera `SIC_Atenciones_Reales.xlsx` (esquema §3.4 del README):
    Periodo | IT | PersonaId | Cod_Esp | Atenciones_Directas_Reales | Atenciones_Indirectas_Reales

Método:
  1. Lee los contratos reales de BUK (Dotacion_2026, ene–jul 2026, header fila 2).
  2. Calcula un PLAN SIMPLIFICADO por persona×mes (sin asignaciones especiales ni
     descuentos: los datos viven en la planilla, no en BUK):
       tramo (T1>=40h, T2 22-<40, T3 <22) -> %Dir/%Ind de Distribucion_NAC (cargo×tramo)
       AteDir_Sem = floor(H × %Dir × 60 / MinDir)
       AteInd_Sem = floor(H × %Ind × 60 / 30)
       factor grupal (solo AS/ED/UEDA/ULAB/UTAC, según Parámetros y zona San/Con)
       Plan_m = floor(AteSem × factor × SemHab_m)
  3. REAL = Plan × perfil_por_especialidad × jitter_fila × bias_persona (semilla fija).
  4. ~0,5% de persona-mes en 0 atenciones (simula licencia extensa).

Perfiles (--perfil):
  balanceado  : media ~95% del plan; FI/EN/UTAC en déficit 72-84%; TO/AS en superávit 104-108%.
  deficit     : la mayoría 80-95% del plan.
  superavit   : la mayoría 95-110% del plan.

Re-ejecutable: cuando exista el motor real, re-generar contra su plan cambiando
la fuente del paso 2. Semilla fija (default 42) => mismo output en cada corrida.

Requisitos: pandas + openpyxl. Uso (desde la raíz del repo):
    python3 tools/generar_sic.py [--seed 42] [--perfil balanceado] [--out SIC_Atenciones_Reales.xlsx]
"""
import argparse
import hashlib
import math
import random

import pandas as pd

BUK_XLSX = "Nac - Base contratos x mes.xlsx"
PLANIF_XLSX = "Nac - Planificación Asistencial x mes.xlsx"

SEMANAS_HABILES_2026 = {1: 4.2, 2: 4.0, 3: 4.4, 4: 4.2, 5: 3.8, 6: 4.2, 7: 4.4, 8: 4.2,
                        9: 4.2, 10: 4.2, 11: 4.2, 12: 4.2}
INSTITUTOS_SAN_CON = {81, 131}  # Concepción, Santiago (N° pacientes por grupo mayor)

PERFILES = {
    # cod_esp -> multiplicador base Real/Plan
    "balanceado": {"FI": 0.78, "EN": 0.82, "UTAC": 0.72,          # déficit visible
                   "TO": 1.06, "AS": 1.04,                          # superávit visible
                   "KI": 0.95, "ULAB": 0.93, "PC": 0.96, "FO": 0.97, "UEDA": 0.94},
    "deficit":   {"FI": 0.86, "EN": 0.88, "UTAC": 0.80, "TO": 0.92, "AS": 0.90,
                  "KI": 0.88, "ULAB": 0.86, "PC": 0.90, "FO": 0.90, "UEDA": 0.84},
    "superavit": {"FI": 1.02, "EN": 1.04, "UTAC": 0.98, "TO": 1.08, "AS": 1.06,
                  "KI": 1.02, "ULAB": 1.01, "PC": 1.03, "FO": 1.04, "UEDA": 1.00},
}


def tramo(horas: float) -> int:
    """T1 >= 40 h · T2 >= 22 y < 40 h · T3 < 22 h (límites inclusivos según Distribucion_NAC)."""
    if horas >= 40:
        return 1
    if horas >= 22:
        return 2
    return 3


def cargar_distribucion_nac() -> dict:
    """cargo -> {min_dir, min_ind, t1: (%dir,%ind,%nas), t2: ..., t3: ...}"""
    dn = pd.read_excel(PLANIF_XLSX, sheet_name="Distribucion_NAC", header=None)
    data = dn.iloc[6:]
    lookup = {}
    tramo_cols = {1: (5, 6, 7), 2: (8, 9, 10), 3: (11, 12, 13)}
    for _, row in data.iterrows():
        cargo = row[1]
        if not isinstance(cargo, str) or not cargo.strip():
            continue
        cargo = cargo.strip().upper()
        if cargo in lookup:
            continue
        entry = {"min_dir": row[3], "min_ind": row[4]}
        for t, (c_dir, c_ind, c_nas) in tramo_cols.items():
            entry[f"t{t}"] = (row[c_dir], row[c_ind], row[c_nas])
        lookup[cargo] = entry
    return lookup


def cargar_grupal() -> dict:
    """cod_esp -> (% grupal, N_pac San/Con, N_pac Otros IT). Solo AS/ED/UEDA/ULAB/UTAC."""
    par = pd.read_excel(PLANIF_XLSX, sheet_name="Parámetros", header=None)
    grupal = {}
    for i in range(3, 8):  # filas 3-7 de la subtabla "Factor grupal"
        cod = par.iloc[i, 5]
        if isinstance(cod, str):
            grupal[cod.strip()] = (float(par.iloc[i, 6]), float(par.iloc[i, 7]), float(par.iloc[i, 8]))
    return grupal


def plan_simplificado(contratos: pd.DataFrame, dnac: dict, grupal: dict) -> pd.DataFrame:
    """Plan Dir/Ind mensual por persona×mes (referencia; sin asignaciones ni descuentos)."""
    planes = []
    for _, r in contratos.iterrows():
        cargo = str(r["Cargo"]).strip().upper()
        horas = float(r["Horas Semanales"])
        t = tramo(horas)
        esp = r["Cod_Esp"]
        cfg = dnac.get(cargo)
        if cfg is None:  # fallback: mediana de la tabla por tramo
            medias = {f"t{k}": tuple(pd.Series([v[f"t{k}"][j] for v in dnac.values()
                                                if v.get(f"t{k}")[j] is not None]).median()
                      for j in range(3)) for k in (1, 2, 3)}
            cfg = {"min_dir": 40, "min_ind": 30, **medias}
        pdir, pind, _ = cfg[f"t{t}"]
        min_dir = cfg["min_dir"] or 40
        ate_dir_sem = math.floor(horas * float(pdir) * 60 / float(min_dir))
        ate_ind_sem = math.floor(horas * float(pind) * 60 / 30.0)

        factor = 1.0
        if esp in grupal:
            g, npac_sc, npac_ot = grupal[esp]
            npac = npac_sc if int(r["IT"]) in INSTITUTOS_SAN_CON else npac_ot
            factor = (1 - g) + (g * npac)

        mes = int(r["Periodo"].month)
        semhab = SEMANAS_HABILES_2026[mes]
        planes.append({
            "Periodo": r["Periodo"], "IT": int(r["IT"]), "PersonaId": r["PersonaId"],
            "Cod_Esp": esp, "Cargo": cargo, "H_Sem": horas, "Tramo": t,
            "PlanAteDir_m": math.floor(ate_dir_sem * factor * semhab),
            "PlanAteInd_m": math.floor(ate_ind_sem * semhab),
        })
    return pd.DataFrame(planes)


def generar_sic(plan: pd.DataFrame, perfil: dict, seed: int) -> pd.DataFrame:
    rng_master = random.Random(seed)
    # Bias por persona (estable entre meses): ±2%
    personas = plan["PersonaId"].unique().tolist()
    bias = {p: 1.0 + (rng_master.random() * 0.04 - 0.02) for p in personas}

    filas = []
    for _, r in plan.iterrows():
        # Jitter por fila determinista: hash(PersonaId|IT|Periodo|seed)
        key = f"{r['PersonaId']}|{r['IT']}|{r['Periodo'].strftime('%Y-%m')}|{seed}".encode()
        rng = random.Random(int(hashlib.sha256(key).hexdigest(), 16) % (2**32))
        mult = perfil.get(r["Cod_Esp"], 0.95) * bias[r["PersonaId"]] * rng.uniform(0.97, 1.03)
        licencia = rng.random() < 0.005  # 0,5% de persona-mes sin atenciones
        real_dir = 0 if licencia else max(0, round(r["PlanAteDir_m"] * mult))
        real_ind = 0 if licencia else max(0, round(r["PlanAteInd_m"] * mult * rng.uniform(0.98, 1.05)))
        filas.append({
            "Periodo": r["Periodo"], "IT": r["IT"], "PersonaId": r["PersonaId"],
            "Cod_Esp": r["Cod_Esp"],
            "Atenciones_Directas_Reales": real_dir,
            "Atenciones_Indirectas_Reales": real_ind,
        })
    return pd.DataFrame(filas)


def main():
    ap = argparse.ArgumentParser(description="Genera SIC sintético (atenciones reales simuladas).")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--perfil", choices=list(PERFILES), default="balanceado")
    ap.add_argument("--out", default="SIC_Atenciones_Reales.xlsx")
    ap.add_argument("--plan-out", default="tools/plan_simplificado_referencia.csv")
    args = ap.parse_args()

    contratos = pd.read_excel(BUK_XLSX, sheet_name="Dotacion_2026", header=1)  # header en fila 2
    contratos = contratos[contratos["Periodo"].dt.year == 2026].copy()
    dnac = cargar_distribucion_nac()
    grupal = cargar_grupal()

    plan = plan_simplificado(contratos, dnac, grupal)
    sic = generar_sic(plan, PERFILES[args.perfil], args.seed)

    plan.to_csv(args.plan_out, index=False)
    sic.to_excel(args.out, sheet_name="Atenciones_Reales", index=False)

    # ---- Resumen de verificación ----
    print(f"SIC generado: {len(sic)} filas -> {args.out}  (perfil={args.perfil}, seed={args.seed})")
    print(f"Plan de referencia: {len(plan)} filas -> {args.plan_out}")
    print("\nFilas por mes:")
    print(sic.groupby(sic["Periodo"].dt.strftime("%Y-%m")).size().to_string())
    sic["_ratio"] = sic["Atenciones_Directas_Reales"] / plan["PlanAteDir_m"].replace(0, pd.NA)
    merged = pd.concat([plan.reset_index(drop=True), sic["_ratio"]], axis=1)
    print("\nReal/Plan directo por especialidad (media):")
    print(merged.groupby("Cod_Esp")["_ratio"].mean().round(3).sort_values().to_string())
    zeros = (sic["Atenciones_Directas_Reales"] == 0).sum()
    print(f"\nPersona-mes con 0 atenciones (licencias simuladas): {zeros} "
          f"({zeros / len(sic):.1%})")
    multi = sic[sic["PersonaId"] == 125129][["Periodo", "IT", "Atenciones_Directas_Reales"]]
    print("\nMulti-sede 125129 (Ant/Cal) muestra:")
    print(multi.head(4).to_string(index=False))


if __name__ == "__main__":
    main()
