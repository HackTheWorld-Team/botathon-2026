#!/usr/bin/env python3
"""
Extrae casos dorados de Dotacion_Asistencial (fila 4 = headers) para validar
el motor de cálculo contra el Excel real ("Cálculo correcto" — obligatorio).

Salida: tools/casos_dorados.csv (~10 filas representativas con columnas clave
de entrada y de resultado esperado). Re-ejecutable sin parámetros.
"""
import pandas as pd

PLANIF = "Nac - Planificación Asistencial x mes.xlsx"
OUT = "tools/casos_dorados.csv"

# Posiciones 0-based de columnas (verificadas contra header fila índice 3)
COLS = {
    "IT": 1, "Instituto": 2, "VacanteNuevo": 4, "PersonaId": 10, "Cargo": 12,
    "Area": 13, "TipoContrato": 16, "PeriodoInicioJornada": 19, "PeriodoFinJornada": 20,
    "PromPond_HS": 23, "HSemAntesNAS": 29, "PausaSaludable": 30, "Colacion15": 31,
    "OtrasNAS": 32, "NASTotal": 33, "PctNAS": 34, "PctDirecto": 35, "PctIndirecto": 36,
    "Asignacion1": 37, "HrsAsig1": 38, "Asignacion2": 39, "HrsAsig2": 40,
    "TotalHrsAsignacion": 44, "PctNASmasAsig": 45, "PctDirectoFinal": 46,
    "PctIndirectoFinal": 47, "PctAsistencial": 48, "HSemDispAte": 49,
    "MinDirecta": 50, "AteDirSem": 52, "AteIndSem": 53, "PctGrupal": 54,
    "NPacientes": 56, "AteSemDirGrupal": 57, "PlanDirAnual": 195,
    "TotalPlanDir": 155, "TotalMGDirecta": 181,
}


def fila(idx: int) -> dict:
    r = df.iloc[idx]
    return {k: r.iloc[i] for k, i in COLS.items()}


df = pd.read_excel(PLANIF, sheet_name="Dotacion_Asistencial", header=3)
df = df[df["PersonaId"].notna()]  # solo filas de profesionales
df = df.reset_index(drop=True)
print(f"Profesionales en Dotacion_Asistencial: {len(df)}")

casos = []
usados = set()

# 1-3) Casos conocidos y validados
for pid in (137732, 71269, 71580):
    m = df[df["PersonaId"] == pid]
    if len(m):
        casos.append(("conocido", fila(m.index[0])))
        usados.add(m.index[0])

def primero(mask, nombre):
    m = df[mask & ~df.index.isin(usados)]
    if len(m):
        casos.append((nombre, fila(m.index[0])))
        usados.add(m.index[0])

# 4) Tramo 3 (<22 h)
primero((df["Prom_Pond Horas Semanales"] < 22) & (df["Prom_Pond Horas Semanales"] > 0), "tramo3_<22h")

# 5) Tramo 2 (22-40) sin asignaciones (asign total 0 o nulo)
sin_asig = df["Total Hrs. Asignación"].fillna(0) == 0
primero((df["Prom_Pond Horas Semanales"] >= 22) & (df["Prom_Pond Horas Semanales"] < 40) & sin_asig, "tramo2_22a40_sin_asig")

# 6) AS (asistente social, atención grupal)
primero((df["Area"] == "AS") & (df["Prom_Pond Horas Semanales"] >= 30), "AS_grupal_30h+")

# 7) ED (educador, grupal)
primero(df["Area"] == "ED", "ED_grupal")

# 8) Dos asignaciones simultáneas
primero(df["Asignación 1 (seleccionar de lista desplegable)"].notna()
        & df["Asignación 2 (seleccionar de lista desplegable)"].notna(), "dos_asignaciones")

# 9) Multi-sede (Excepciones)
primero(df["Excepción"].notna(), "multi_sede_excepciones")

# 10) UTAC (grupal 55%)
primero(df["Area"] == "UTAC", "UTAC_grupal")

out = pd.DataFrame([{"caso": n, **d} for n, d in casos])
out.to_csv(OUT, index=False)
print(f"Casos dorados extraídos: {len(out)} -> {OUT}")
print(out[["caso", "PersonaId", "Cargo", "PromPond_HS", "PctNAS", "PctDirecto",
           "PctDirectoFinal", "AteDirSem"]].to_string(index=False))

# Verificación del caso validado de la Duda 1 (137732: Dir 60.9375 / Ind 14.0625)
r = out[out["PersonaId"] == 137732].iloc[0]
print("\nValidación Duda 1 (137732):")
print(f"  %Directo Final={r['PctDirectoFinal']} (esperado 0.609375) · "
      f"%Indirecto Final={r['PctIndirectoFinal']} (esperado 0.140625)")
