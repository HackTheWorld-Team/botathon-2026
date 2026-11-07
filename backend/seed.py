#!/usr/bin/env python3
"""
Seed de SQLite (issue #16): crea la BD con backend/schema.sql y carga los
parámetros reales desde las hojas Parámetros y Distribucion_NAC del Excel
de planificación (coordenadas verificadas en README §3.2).

Uso (desde la raíz del repo):
    python3 backend/seed.py [--db backend/db.sqlite]

Carga:
  - institutos (16 códigos IT con siglas, incluye San/Cas=131/102)
  - parametros_distribucion (cargo × tramo → % Dir/Ind/NAS + minutos)
  - parametros_grupal (AS/ED/UEDA/ULAB/UTAC)
  - asignaciones (catálogo hoja Distribucion_NAC cols 17-19)
  - semanas_habiles 2026 (ene 4.2 ... dic 4.2)

Requiere pandas + openpyxl.
"""
import argparse
import sqlite3
from pathlib import Path

import pandas as pd

PLANIF = "Nac - Planificación Asistencial x mes.xlsx"
SEMANAS_2026 = {1: 4.2, 2: 4.0, 3: 4.4, 4: 4.2, 5: 3.8, 6: 4.2,
                7: 4.4, 8: 4.2, 9: 4.2, 10: 4.2, 11: 4.2, 12: 4.2}
INSTITUTOS = [(11, "Ari"), (12, "Iqu"), (21, "Ant"), (22, "Cal"), (31, "Cop"),
              (41, "Coq"), (51, "Val"), (61, "OHi"), (71, "Tal"), (81, "Con"),
              (91, "Tem"), (101, "PMo"), (111, "Coy"), (131, "San"), (141, "Vdv"),
              (102, "Cas")]


def crear_bd(db_path: str) -> sqlite3.Connection:
    schema = (Path(__file__).parent / "schema.sql").read_text(encoding="utf-8")
    con = sqlite3.connect(db_path)
    con.executescript(schema)
    return con


def cargar_distribucion(con: sqlite3.Connection) -> int:
    dn = pd.read_excel(PLANIF, sheet_name="Distribucion_NAC", header=None)
    tramo_cols = {1: (5, 6, 7), 2: (8, 9, 10), 3: (11, 12, 13)}
    n = 0
    vistos = set()
    for _, row in dn.iloc[6:].iterrows():
        cargo = row[1]
        if not isinstance(cargo, str) or not cargo.strip():
            continue
        cargo = cargo.strip().upper()
        if cargo in vistos:
            continue
        min_dir = row[3] if pd.notna(row[3]) else 30
        min_ind = row[4] if pd.notna(row[4]) else 30
        for t, (c_d, c_i, c_n) in tramo_cols.items():
            pd_, pi_, pn = row[c_d], row[c_i], row[c_n]
            if pd.isna(pd_) or pd.isna(pi_) or pd.isna(pn):
                continue
            con.execute(
                "INSERT OR REPLACE INTO parametros_distribucion VALUES (?,?,?,?,?,?,?)",
                (cargo, t, float(pd_), float(pi_), float(pn), int(min_dir), int(min_ind)))
            n += 1
        vistos.add(cargo)

        # Catálogo de asignaciones (cols 17-19): nombre · horas · autorización
        nom, hrs, desc = row[17], row[18], row[19]
        if isinstance(nom, str) and nom.strip() and pd.notna(hrs):
            vb = 1 if isinstance(desc, str) and "DMN" in desc.upper() else 0
            con.execute(
                "INSERT OR IGNORE INTO asignaciones (nombre, horas_semana, requiere_vb_dmn) VALUES (?,?,?)",
                (nom.strip(), float(hrs), vb))
    return n


def cargar_grupal(con: sqlite3.Connection) -> int:
    par = pd.read_excel(PLANIF, sheet_name="Parámetros", header=None)
    n = 0
    for i in range(3, 8):  # filas 3-7 de la subtabla "Factor grupal"
        cod = par.iloc[i, 5]
        if isinstance(cod, str) and cod.strip():
            con.execute(
                "INSERT OR REPLACE INTO parametros_grupal VALUES (?,?,?,?)",
                (cod.strip(), float(par.iloc[i, 6]), float(par.iloc[i, 7]), float(par.iloc[i, 8])))
            n += 1
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="backend/db.sqlite")
    args = ap.parse_args()

    con = crear_bd(args.db)
    con.executemany("INSERT OR REPLACE INTO institutos (it, sigla, nombre) VALUES (?,?,?)",
                    [(it, sig, sig) for it, sig in INSTITUTOS])
    con.executemany("INSERT OR REPLACE INTO semanas_habiles VALUES (?,?,?)",
                    [(2026, m, s) for m, s in SEMANAS_2026.items()])
    n_dist = cargar_distribucion(con)
    n_grup = cargar_grupal(con)
    n_asig = con.execute("SELECT COUNT(*) FROM asignaciones").fetchone()[0]
    con.commit()

    print(f"BD creada: {args.db}")
    print(f"  institutos: {len(INSTITUTOS)} · semanas hábiles 2026: 12")
    print(f"  parametros_distribucion: {n_dist} filas (cargo×tramo)")
    print(f"  parametros_grupal: {n_grup} especialidades")
    print(f"  asignaciones: {n_asig} del catálogo")
    con.close()


if __name__ == "__main__":
    main()
