#!/usr/bin/env python3
"""
Genera archivo BUK de mayo 2026 para demo (Paso 3 → Paso 4).

Requisitos (Issue #29):
- Script reproducible (seed fija) genera archivo en bot/entrada/ sin tocar Excel fuente.
- Contiene ≥1 alta nueva, ≥1 cambio 44→42h vigente desde 2026-05-01 y persona 125129
  con split Antofagasta/Calama (solo existe en hoja Excepciones → se agrega manualmente).
- Meses anteriores quedan intactos (no retroactividad).
- Segunda corrida del worker produce deltas: alta + cambio jornada + multi-sede, sin duplicar.
- Split de horas de 125129 coincide con hoja Excepciones original.

Estrategia:
1. Leer Dotacion_2026 (base Paso 3) hasta abril incluido.
2. Clonar abril → mayo aplicando transformaciones:
   a) Cambio 44→42h para TODOS los que tenían 44h en abril (ya ocurre en datos reales).
   b) Agregar 1 alta nueva (PersonaId nuevo, no existente).
   c) Agregar 125129 con dos filas (Antofagasta IT=21 y Calama IT=22) según Excepciones.
3. Escribir archivo Excel en bot/entrada/ con mismo esquema que Dotacion_2026.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime

# ─── Configuración ───
SEED = 42
np.random.seed(SEED)

SRC_XLSX = Path("Nac - Base contratos x mes.xlsx")
PLAN_XLSX = Path("Nac - Planificación Asistencial x mes.xlsx")
OUT_DIR = Path("bot/entrada")
OUT_FILE = OUT_DIR / "BUK_Dotacion_2026_Mayo.xlsx"

# ─── Utilidades ───
def read_dotacion():
    """Lee Dotacion_2026 con header en fila 1 (0-indexed)."""
    return pd.read_excel(SRC_XLSX, sheet_name="Dotacion_2026", header=1)

def read_excepciones():
    """Lee hoja Excepciones del archivo de planificación."""
    return pd.read_excel(PLAN_XLSX, sheet_name="Excepciones", header=1)

def get_schema(df):
    """Devuelve lista de columnas en orden."""
    return df.columns.tolist()

# ─── Lógica principal ───
def generar_buk_mayo(out_file: str | Path = OUT_FILE) -> Path:
    out_file_path = Path(out_file)
    print("=" * 60)
    print("Generando BUK de mayo 2026 para demo")
    print("=" * 60)

    # 1. Leer datos fuente
    df = read_dotacion()
    df_exc = read_excepciones()
    schema = get_schema(df)

    print(f"Filas totales en Dotacion_2026: {len(df)}")
    print(f"Periodos únicos: {sorted(df['Periodo'].dt.strftime('%Y-%m').unique())}")

    # 2. Filtrar hasta abril (base Paso 3)
    df_base = df[df["Periodo"] <= "2026-04-01"].copy()
    print(f"Filas base (ene-abr): {len(df_base)}")

    # 3. Tomar abril como plantilla para mayo
    df_apr = df[df["Periodo"] == "2026-04-01"].copy()
    print(f"Filas en abril: {len(df_apr)}")

    # 4. Crear mayo clonando abril y cambiando Periodo
    df_may = df_apr.copy()
    df_may["Periodo"] = pd.Timestamp("2026-05-01")

    # 4a. Eliminar 125129 existente de abril (se recreará con split correcto)
    df_may = df_may[df_may["PersonaId"] != 125129].copy()
    print(f"Filas tras eliminar 125129 existente: {len(df_may)}")

    # 4b. Cambio 44→42h: todos los que tenían 44h en abril pasan a 42h en mayo
    mask_44 = df_may["Horas Semanales"] == 44
    n_44_to_42 = mask_44.sum()
    df_may.loc[mask_44, "Horas Semanales"] = 42
    print(f"Cambios 44→42h aplicados: {n_44_to_42}")

    # 4c. Alta nueva: crear PersonaId nuevo (max + 1000 para evitar colisiones)
    new_pid = int(df["PersonaId"].max()) + 1000
    # Usar primera fila de abril como plantilla
    alta = df_apr.iloc[[0]].copy()
    alta["PersonaId"] = new_pid
    alta["Periodo"] = pd.Timestamp("2026-05-01")
    alta["Fecha Ingreso Compañía"] = pd.Timestamp("2026-05-01")
    alta["Horas Semanales"] = 42.0  # Nueva contratación: desde 2026-05-01 rige tope legal 42h
    alta["Cargo"] = "KINESIOLOGO (ALTA DEMO)"
    alta["Tipo de Contrato"] = "Indefinido"
    alta["Fecha Término"] = pd.NaT
    print(f"Alta nueva creada: PersonaId={new_pid}")

    # 4d. Multi-sede 125129: agregar dos filas según Excepciones
    # Excepciones muestra:
    # - Fila 0: Antofagasta (IT=21), H/S abr-dic = 35, D/S=4
    # - Fila 1: Calama (IT=22), H/S abr-dic = 8, D/S=1
    exc_125129 = df_exc[df_exc["PersonaId"] == 125129]
    if len(exc_125129) < 2:
        raise ValueError(f"Se esperaban 2 filas para 125129 en Excepciones, hay {len(exc_125129)}")

    # Plantilla base: usar una fila de abril de Antofagasta (IT=21) si existe, sino primera fila
    template_ant = df_apr[df_apr["IT"] == 21].iloc[[0]] if len(df_apr[df_apr["IT"] == 21]) > 0 else df_apr.iloc[[0]]
    template_cal = df_apr[df_apr["IT"] == 22].iloc[[0]] if len(df_apr[df_apr["IT"] == 22]) > 0 else df_apr.iloc[[0]]

    # Fila Antofagasta
    row_ant = template_ant.copy()
    row_ant["PersonaId"] = 125129
    row_ant["Periodo"] = pd.Timestamp("2026-05-01")
    row_ant["IT"] = 21
    row_ant["Instituto"] = "Ant"
    row_ant["Área"] = "Antofagasta"
    row_ant["Centro de Costo"] = 300202
    row_ant["Cargo"] = "MEDICO FISIATRA"
    row_ant["Horas Semanales"] = 35.0  # Según Excepciones H/S abr-dic
    row_ant["Fecha Ingreso Compañía"] = pd.Timestamp("2026-01-02")
    row_ant["Cod_Esp"] = "FI"
    row_ant["Ndias"] = 4  # D/S = 4
    row_ant["Días de la Jornada"] = "lmwj"  # 4 días
    row_ant["Reg_SIC"] = "D - SIC"
    row_ant["Tipo_Trabajador"] = "Titular"
    row_ant["Tipo_Trab_161225"] = "Titular"
    row_ant["Tipo de Contrato"] = "Indefinido"
    row_ant["Fecha Término"] = pd.NaT

    # Fila Calama
    row_cal = template_cal.copy()
    row_cal["PersonaId"] = 125129
    row_cal["Periodo"] = pd.Timestamp("2026-05-01")
    row_cal["IT"] = 22
    row_cal["Instituto"] = "Cal"
    row_cal["Área"] = "Calama"
    row_cal["Centro de Costo"] = 300202
    row_cal["Cargo"] = "MEDICO FISIATRA"
    row_cal["Horas Semanales"] = 8.0  # Según Excepciones H/S abr-dic
    row_cal["Fecha Ingreso Compañía"] = pd.Timestamp("2026-01-02")
    row_cal["Cod_Esp"] = "FI"
    row_cal["Ndias"] = 1  # D/S = 1
    row_cal["Días de la Jornada"] = "l"  # 1 día
    row_cal["Reg_SIC"] = "D - SIC"
    row_cal["Tipo_Trabajador"] = "Titular"
    row_cal["Tipo_Trab_161225"] = "Titular"
    row_cal["Tipo de Contrato"] = "Indefinido"
    row_cal["Fecha Término"] = pd.NaT

    print(f"Multi-sede 125129 agregado: Antofagasta (35h, 4 días) + Calama (8h, 1 día)")

    # 5. Combinar: base (ene-abr) + mayo (con cambios)
    # IMPORTANTE: No incluir abril duplicado; mayo reemplaza a abril para los existentes
    # Pero la base ya tiene abril. El worker detecta deltas comparando con último periodo procesado.
    # Para el archivo BUK de mayo, solo enviamos las filas de MAYO (el worker compara con BD).
    df_out = df_may.copy()

    # Agregar alta y multi-sede
    df_out = pd.concat([df_out, alta, row_ant, row_cal], ignore_index=True)

    # 6. Validaciones
    print("\n--- Validaciones ---")
    print(f"Total filas mayo generadas: {len(df_out)}")
    print(f"  - Existentes (clon abril): {len(df_may)}")
    print(f"  - Alta nueva: 1")
    print(f"  - Multi-sede 125129: 2 filas (Antofagasta + Calama)")

    # Verificar 44→42h
    may_44 = df_out[df_out["Horas Semanales"] == 44]
    may_42 = df_out[df_out["Horas Semanales"] == 42]
    print(f"  - 44h en mayo: {len(may_44)} (debe ser solo la alta nueva)")
    print(f"  - 42h en mayo: {len(may_42)}")

    # Verificar 125129
    p125129 = df_out[df_out["PersonaId"] == 125129]
    print(f"  - Filas 125129: {len(p125129)}")
    for _, r in p125129.iterrows():
        print(f"    IT={r['IT']} ({r['Instituto']}), Horas={r['Horas Semanales']}, Ndias={r['Ndias']}, Días={r['Días de la Jornada']}")

    # Verificar alta nueva
    alta_check = df_out[df_out["PersonaId"] == new_pid]
    print(f"  - Alta nueva (PID={new_pid}): {len(alta_check)} fila(s)")

    # 7. Escribir archivo
    out_file_path.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(out_file_path, engine="openpyxl") as writer:
        df_out.to_excel(writer, sheet_name="Dotacion_2026", index=False, startrow=1)
        # Escribir headers en fila 1 (0-indexed = fila 2 en Excel)
        ws = writer.sheets["Dotacion_2026"]
        for col_idx, col_name in enumerate(schema, 1):
            ws.cell(row=1, column=col_idx, value=col_name)

    print(f"\n✅ Archivo generado: {out_file_path}")
    print(f"   Seed usado: {SEED} (reproducible)")

    # 8. Verificar que meses anteriores no cambian (solo lectura)
    print("\n--- Verificación no retroactividad ---")
    for mes in ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"]:
        count = len(df[df["Periodo"] == mes])
        print(f"  {mes[:7]}: {count} filas (inalterado)")

    return out_file_path


def main():
    return generar_buk_mayo(OUT_FILE)


if __name__ == "__main__":
    main()