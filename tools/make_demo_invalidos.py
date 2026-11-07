#!/usr/bin/env python3
"""
Generador de archivo BUK corrupto para demo Paso 2 — Botathon 2026 Teletón.

Genera una copia del archivo BUK (Dotacion_2026) con 4 defectos intencionales
en filas distintas y rastreables:
  1. Jornada -44 (Horas Semanales negativa)
  2. Texto 'Tres Cientos' en Horas Semanales (tipo incorrecto)
  3. IT inexistente (IT 999 que no existe en catálogo)
  4. Duplicado PK sobre [PersonaId + IT + Periodo]

El script es determinista (seed fija) y NO modifica el Excel fuente.
"""
import pandas as pd
import numpy as np
from pathlib import Path

SOURCE = "Nac - Base contratos x mes.xlsx"
SHEET = "Dotacion_2026"
HEADER_ROW = 1  # 0-based: fila 2 del Excel
OUT_DIR = Path("bot/entrada")
OUT_FILE = OUT_DIR / "BUK_Demo_Paso2_Corrupto.xlsx"

# Seed fija para determinismo
SEED = 42
np.random.seed(SEED)


def ensure_object_dtype(df, col):
    """Convierte columna a object para permitir valores mixtos (num + texto)."""
    if df[col].dtype != object:
        df[col] = df[col].astype(object)


def main():
    # Leer archivo fuente (sin modificarlo)
    df = pd.read_excel(SOURCE, sheet_name=SHEET, header=HEADER_ROW)
    print(f"Fuente: {SOURCE} | Hoja: {SHEET} | Filas: {len(df)} | Columnas: {len(df.columns)}")

    # Crear copia de trabajo
    df_corrupto = df.copy()
    # Convertir columnas clave a object para permitir inyección de defectos de tipo
    ensure_object_dtype(df_corrupto, "Horas Semanales")
    ensure_object_dtype(df_corrupto, "IT")
    ensure_object_dtype(df_corrupto, "Instituto")

    # Obtener valores válidos de referencia
    valid_its = sorted(df["IT"].unique())
    valid_personas = df["PersonaId"].unique()
    valid_periodos = sorted(df["Periodo"].unique())

    print(f"ITs válidos: {valid_its[:5]}... (total {len(valid_its)})")
    print(f"Periodos: {valid_periodos}")

    # ============================================================
    # DEFECTO 1: Jornada -44 (Horas Semanales negativa)
    # ============================================================
    # Tomar la primera fila y modificar Horas Semanales a -44
    idx_defecto1 = 0
    df_corrupto.loc[idx_defecto1, "Horas Semanales"] = -44
    df_corrupto.loc[idx_defecto1, "_defecto"] = "DEFECTO_1_JORNADA_NEGATIVA_-44"
    print(f"Defecto 1 aplicado en fila {idx_defecto1}: Horas Semanales = -44")

    # ============================================================
    # DEFECTO 2: Texto 'Tres Cientos' en Horas Semanales
    # ============================================================
    # Tomar la segunda fila y poner texto en campo numérico
    idx_defecto2 = 1
    df_corrupto.loc[idx_defecto2, "Horas Semanales"] = "Tres Cientos"
    df_corrupto.loc[idx_defecto2, "_defecto"] = "DEFECTO_2_TEXTO_EN_NUMERICO_Tres_Cientos"
    print(f"Defecto 2 aplicado en fila {idx_defecto2}: Horas Semanales = 'Tres Cientos'")

    # ============================================================
    # DEFECTO 3: IT inexistente (999)
    # ============================================================
    # Tomar la tercera fila y cambiar IT a 999 (no existe en catálogo)
    idx_defecto3 = 2
    df_corrupto.loc[idx_defecto3, "IT"] = 999
    df_corrupto.loc[idx_defecto3, "Instituto"] = "INEXISTENTE"
    df_corrupto.loc[idx_defecto3, "_defecto"] = "DEFECTO_3_IT_INEXISTENTE_999"
    print(f"Defecto 3 aplicado en fila {idx_defecto3}: IT = 999 (inexistente)")

    # ============================================================
    # DEFECTO 4: Duplicado PK sobre [PersonaId + IT + Periodo]
    # ============================================================
    # Tomar la cuarta fila y duplicar los valores PK de la fila 0
    idx_defecto4 = 3
    pk_persona = df_corrupto.loc[0, "PersonaId"]
    pk_it = df_corrupto.loc[0, "IT"]
    pk_periodo = df_corrupto.loc[0, "Periodo"]

    df_corrupto.loc[idx_defecto4, "PersonaId"] = pk_persona
    df_corrupto.loc[idx_defecto4, "IT"] = pk_it
    df_corrupto.loc[idx_defecto4, "Periodo"] = pk_periodo
    df_corrupto.loc[idx_defecto4, "_defecto"] = f"DEFECTO_4_DUPLICADO_PK_PersonaId{pk_persona}_IT{pk_it}_Periodo{pk_periodo}"
    print(f"Defecto 4 aplicado en fila {idx_defecto4}: Duplicado PK PersonaId={pk_persona}, IT={pk_it}, Periodo={pk_periodo}")

    # Verificar que los 4 defectos están en filas distintas
    defect_rows = [idx_defecto1, idx_defecto2, idx_defecto3, idx_defecto4]
    assert len(set(defect_rows)) == 4, "Los defectos deben estar en filas distintas"

    # Verificar que el duplicado PK coincide con la validación del worker
    # PK = [PersonaId, IT, Periodo]
    pk_cols = ["PersonaId", "IT", "Periodo"]
    duplicated = df_corrupto.duplicated(subset=pk_cols, keep=False)
    dup_count = duplicated.sum()
    print(f"\nVerificación PK duplicado: {dup_count} filas comparten PK (esperado: 2)")

    # Asegurar directorio de salida
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Guardar archivo corrupto
    with pd.ExcelWriter(OUT_FILE, engine="openpyxl") as writer:
        df_corrupto.to_excel(writer, sheet_name=SHEET, index=False)

    print(f"\n✅ Archivo corrupto generado: {OUT_FILE}")
    print(f"   Filas totales: {len(df_corrupto)}")
    print(f"   Defectos inyectados: 4 (filas {defect_rows})")

    # Resumen de defectos para trazabilidad
    print("\n--- RESUMEN DE DEFECTOS (trazables) ---")
    for idx in defect_rows:
        row = df_corrupto.loc[idx]
        print(f"  Fila {idx}: {row['_defecto']} | PersonaId={row['PersonaId']} | IT={row['IT']} | Periodo={row['Periodo']} | Horas Semanales={row['Horas Semanales']}")

    return 0


if __name__ == "__main__":
    exit(main())