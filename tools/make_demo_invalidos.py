#!/usr/bin/env python3
"""
Genera el archivo BUK "corrupto" para el Paso 2 de la demo (issue #14):
copia del BUK real (ene 2026) con errores intencionales que el bot debe
detectar y rechazar SIN caerse:

  1. Jornada negativa        -> Horas Semanales = -44
  2. Texto donde va número   -> Horas Semanales = "Tres Cientos"
  3. IT inexistente          -> IT = 999 (fuera del catálogo)
  4. Duplicado de PK         -> segunda fila con [PersonaId+IT+Periodo] repetida
  5. Jornada > 44            -> Horas Semanales = 60
  6. Cod_Esp inexistente     -> "XX"

Uso (desde la raíz del repo):
    python3 tools/make_demo_invalidos.py [--salida bot/entrada/BUK_demo_invalidos.xlsx]

Requiere pandas + openpyxl. El archivo de salida queda en bot/entrada/ (gitignored).
"""
import argparse

import pandas as pd

FUENTE = "Nac - Base contratos x mes.xlsx"


def generar(ruta_salida: str) -> pd.DataFrame:
    df = pd.read_excel(FUENTE, sheet_name="Dotacion_2026", header=1)

    # Trabajar solo con enero (foto inicial de la demo)
    df = df[df["Periodo"] == "2026-01-01"].copy().reset_index(drop=True)

    # Permitir mezclar texto y números en Horas Semanales (errores de tipo)
    df["Horas Semanales"] = df["Horas Semanales"].astype(object)

    # 1) Jornada negativa: primer registro
    df.loc[0, "Horas Semanales"] = -44

    # 2) Texto donde va número
    df.loc[1, "Horas Semanales"] = "Tres Cientos"

    # 3) IT inexistente (fuera del catálogo 11..141)
    df.loc[2, "IT"] = 999

    # 4) Duplicado exacto de PK: clonar fila 3 y pegarla al final
    dup = df.iloc[[3]].copy()
    df = pd.concat([df, dup], ignore_index=True)

    # 5) Jornada > 44
    df.loc[4, "Horas Semanales"] = 60

    # 6) Cod_Esp inexistente
    df.loc[5, "Cod_Esp"] = "XX"

    df.to_excel(ruta_salida, sheet_name="Dotacion_2026", index=False, startrow=1)
    return df


def main():
    ap = argparse.ArgumentParser(description="Genera el BUK corrupto de demo (Paso 2).")
    ap.add_argument("--salida", default="bot/entrada/BUK_demo_invalidos.xlsx")
    args = ap.parse_args()

    df = generar(args.salida)
    filas = len(df)
    print(f"Archivo corrupto generado: {args.salida} ({filas} filas de enero 2026)")
    print("Errores inyectados en filas (0-based): #1 jornada -44 · #2 texto 'Tres Cientos' · "
          "#3 IT=999 · última=duplicado PK · #5 jornada 60 · #6 Cod_Esp=XX")


if __name__ == "__main__":
    main()
