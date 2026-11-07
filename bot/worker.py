#!/usr/bin/env python3
"""
bot/worker.py — Ingesta, validación, publicación a SQLite y aislamiento de registros sucios (Issue #11).

Parte del MVP Botathon 2026.
Procesa archivos BUK (.xlsx):
  1. Normaliza tipos y encabezados (header en fila 2 / índice 1).
  2. Valida reglas de negocio:
     - IT válido (en catálogo de institutos)
     - Cod_Esp válido (no vacío / formato esperado)
     - Horas Semanales numéricas >= 0 y <= 44 (o <= 42 a partir de 2026-05-01)
     - Unicidad de clave primaria de negocio [PersonaId + IT + Periodo]
  3. Aísla filas sucias sin caerse:
     - Guarda registros rechazados en la tabla 'rechazados'
     - Genera archivo 'Rejected_Records_Report.xlsx'
  4. Inserta registros válidos en la tabla 'contratos'
  5. Registra lote en la tabla 'lotes' y genera resumen JSON

Uso:
    python3 bot/worker.py <ruta_archivo.xlsx> [--db backend/db.sqlite] [--out-dir bot/reportes]
"""

import argparse
import json
import os
import sqlite3
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import pandas as pd


MOTIVOS = {
    "NEGATIVE_HS": "Horas semanales negativas (< 0)",
    "TEXT_HS": "Horas semanales contiene texto o valor no numérico",
    "HS_OVER": "Horas semanales excede límite permitido (> 44 h o > 42 h post 2026-05-01)",
    "BAD_IT": "Código IT no existe en catálogo de institutos",
    "BAD_ESP": "Código de especialidad Cod_Esp inválido o vacío",
    "DUP_PK": "Clave de negocio duplicada [PersonaId + IT + Periodo]",
    "OTHER": "Error de estructura o formato"
}


def obtener_catalogo_it(con: sqlite3.Connection) -> Set[int]:
    cur = con.cursor()
    cur.execute("SELECT it FROM institutos")
    return {row[0] for row in cur.fetchall()}


def normalizar_fecha(val: Any) -> Optional[str]:
    if pd.isna(val):
        return None
    if isinstance(val, (datetime, pd.Timestamp)):
        return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    if not s or s.lower() == "nat":
        return None
    try:
        dt = pd.to_datetime(s)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return s[:10]


def validar_y_procesar_buk(
    ruta_archivo: str,
    db_path: str = "backend/db.sqlite",
    out_dir: str = "bot/reportes"
) -> Dict[str, Any]:
    inicio_ms = int(time.time() * 1000)
    path_archivo = Path(ruta_archivo)
    if not path_archivo.exists():
        raise FileNotFoundError(f"Archivo no encontrado: {ruta_archivo}")

    Path(out_dir).mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row

    try:
        institutos_validos = obtener_catalogo_it(con)

        # Leer archivo Excel - Dotacion_2026 o primera hoja
        try:
            df = pd.read_excel(ruta_archivo, sheet_name="Dotacion_2026", header=1)
        except Exception:
            df = pd.read_excel(ruta_archivo, header=1)

        validos: List[Dict[str, Any]] = []
        rechazados: List[Dict[str, Any]] = []
        pk_vistas: Set[Tuple[int, int, str]] = set()

        # Consultar PKs ya existentes en BD para evitar duplicados si ya existen
        cur = con.cursor()
        cur.execute("SELECT persona_id, it, periodo FROM contratos")
        pks_en_bd = {(r["persona_id"], r["it"], r["periodo"]) for r in cur.fetchall()}

        for idx, row in df.iterrows():
            fila_origen = int(idx) + 3  # Fila 1 = título/vacía, Fila 2 = header, Fila 3 = primera fila datos
            row_dict = row.to_dict()
            payload_json = json.dumps(
                {k: (None if pd.isna(v) else str(v) if isinstance(v, (datetime, pd.Timestamp)) else v)
                 for k, v in row_dict.items()},
                ensure_ascii=False
            )

            # Validar IT
            it_raw = row.get("IT")
            try:
                it = int(it_raw)
                if it not in institutos_validos:
                    rechazados.append({
                        "fila_origen": fila_origen,
                        "motivo": "BAD_IT",
                        "detalle": f"IT {it} no existe en catálogo de institutos",
                        "payload": payload_json,
                        "row_data": row_dict
                    })
                    continue
            except (ValueError, TypeError):
                rechazados.append({
                    "fila_origen": fila_origen,
                    "motivo": "BAD_IT",
                    "detalle": f"IT inválido: '{it_raw}'",
                    "payload": payload_json,
                    "row_data": row_dict
                })
                continue

            # Validar PersonaId
            p_id_raw = row.get("PersonaId")
            try:
                persona_id = int(p_id_raw)
            except (ValueError, TypeError):
                rechazados.append({
                    "fila_origen": fila_origen,
                    "motivo": "OTHER",
                    "detalle": f"PersonaId inválido: '{p_id_raw}'",
                    "payload": payload_json,
                    "row_data": row_dict
                })
                continue

            # Validar Periodo
            periodo_raw = row.get("Periodo")
            periodo = normalizar_fecha(periodo_raw)
            if not periodo:
                rechazados.append({
                    "fila_origen": fila_origen,
                    "motivo": "OTHER",
                    "detalle": f"Periodo nulo o inválido: '{periodo_raw}'",
                    "payload": payload_json,
                    "row_data": row_dict
                })
                continue

            # Validar Cod_Esp
            cod_esp = row.get("Cod_Esp")
            if pd.isna(cod_esp) or not str(cod_esp).strip() or str(cod_esp).strip().upper() == "XX":
                rechazados.append({
                    "fila_origen": fila_origen,
                    "motivo": "BAD_ESP",
                    "detalle": f"Cod_Esp inválido o fuera de catálogo: '{cod_esp}'",
                    "payload": payload_json,
                    "row_data": row_dict
                })
                continue
            cod_esp = str(cod_esp).strip()

            # Validar Horas Semanales
            hs_raw = row.get("Horas Semanales")
            try:
                if isinstance(hs_raw, str):
                    # Intentar convertir texto numérico
                    hs = float(hs_raw.replace(",", "."))
                else:
                    hs = float(hs_raw)
            except (ValueError, TypeError):
                rechazados.append({
                    "fila_origen": fila_origen,
                    "motivo": "TEXT_HS",
                    "detalle": f"Horas Semanales contiene texto o valor no convertible: '{hs_raw}'",
                    "payload": payload_json,
                    "row_data": row_dict
                })
                continue

            if hs < 0:
                rechazados.append({
                    "fila_origen": fila_origen,
                    "motivo": "NEGATIVE_HS",
                    "detalle": f"Horas Semanales no puede ser negativo: {hs}",
                    "payload": payload_json,
                    "row_data": row_dict
                })
                continue

            # Tope 44h siempre; 42h a partir de 2026-05-01
            tope = 42.0 if periodo >= "2026-05-01" else 44.0
            if hs > tope:
                rechazados.append({
                    "fila_origen": fila_origen,
                    "motivo": "HS_OVER",
                    "detalle": f"Horas Semanales ({hs}h) excede el tope legal permitido ({tope}h para período {periodo})",
                    "payload": payload_json,
                    "row_data": row_dict
                })
                continue

            # Validar Duplicado PK [PersonaId + IT + Periodo]
            pk = (persona_id, it, periodo)
            if pk in pk_vistas or pk in pks_en_bd:
                rechazados.append({
                    "fila_origen": fila_origen,
                    "motivo": "DUP_PK",
                    "detalle": f"Registro duplicado para PK [PersonaId={persona_id}, IT={it}, Periodo={periodo}]",
                    "payload": payload_json,
                    "row_data": row_dict
                })
                continue
            pk_vistas.add(pk)

            # Registro válido
            validos.append({
                "it": it,
                "persona_id": persona_id,
                "periodo": periodo,
                "cargo": str(row.get("Cargo", "")).strip().upper(),
                "area": str(row.get("Área", "")) if pd.notna(row.get("Área")) else None,
                "centro_costo": str(row.get("Centro de Costo", "")) if pd.notna(row.get("Centro de Costo")) else None,
                "tipo_contrato": str(row.get("Tipo de Contrato", "")) if pd.notna(row.get("Tipo de Contrato")) else None,
                "fecha_ingreso": normalizar_fecha(row.get("Fecha Ingreso Compañía")),
                "fecha_termino": normalizar_fecha(row.get("Fecha Término")),
                "horas_semanales": hs,
                "cod_esp": cod_esp,
                "ndias": int(row.get("Ndias")) if pd.notna(row.get("Ndias")) else None,
                "reg_sic": str(row.get("Reg_SIC", "")) if pd.notna(row.get("Reg_SIC")) else None,
                "vigente_desde": periodo
            })

        duracion_ms = int(time.time() * 1000) - inicio_ms
        fecha_corrida = datetime.now().isoformat()

        # Registrar Lote
        cur.execute(
            """
            INSERT INTO lotes (archivo, tipo, fecha_corrida, duracion_ms, validos, rechazados)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (path_archivo.name, "BUK", fecha_corrida, duracion_ms, len(validos), len(rechazados))
        )
        lote_id = cur.lastrowid

        # Insertar contratos válidos
        for v in validos:
            cur.execute(
                """
                INSERT OR REPLACE INTO contratos (
                    lote_id, it, persona_id, periodo, cargo, area, centro_costo,
                    tipo_contrato, fecha_ingreso, fecha_termino, horas_semanales,
                    cod_esp, ndias, reg_sic, vigente_desde
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    lote_id, v["it"], v["persona_id"], v["periodo"], v["cargo"],
                    v["area"], v["centro_costo"], v["tipo_contrato"], v["fecha_ingreso"],
                    v["fecha_termino"], v["horas_semanales"], v["cod_esp"], v["ndias"],
                    v["reg_sic"], v["vigente_desde"]
                )
            )

        # Insertar registros rechazados en BD
        for r in rechazados:
            cur.execute(
                """
                INSERT INTO rechazados (lote_id, fila_origen, motivo, detalle, payload)
                VALUES (?, ?, ?, ?, ?)
                """,
                (lote_id, r["fila_origen"], r["motivo"], r["detalle"], r["payload"])
            )

        con.commit()

        # Generar Reporte de Rechazos en Excel si hay rechazados
        reporte_excel_path = Path(out_dir) / "Rejected_Records_Report.xlsx"
        if rechazados:
            filas_reporte = []
            for r in rechazados:
                d = {
                    "Fila Origen": r["fila_origen"],
                    "Motivo": r["motivo"],
                    "Descripción Error": r["detalle"]
                }
                d.update(r["row_data"])
                filas_reporte.append(d)
            df_rech = pd.DataFrame(filas_reporte)
            df_rech.to_excel(reporte_excel_path, index=False)
        else:
            # Crear reporte vacío con estructura
            df_vacio = pd.DataFrame(columns=["Fila Origen", "Motivo", "Descripción Error"])
            df_vacio.to_excel(reporte_excel_path, index=False)

        # Guardar resumen en JSON
        resumen = {
            "lote_id": lote_id,
            "archivo": path_archivo.name,
            "tipo": "BUK",
            "fecha_corrida": fecha_corrida,
            "duracion_ms": duracion_ms,
            "total_filas": len(df),
            "validos": len(validos),
            "rechazados": len(rechazados),
            "reporte_rechazos": str(reporte_excel_path)
        }
        resumen_json_path = Path(out_dir) / f"resumen_lote_{lote_id}.json"
        resumen_json_path.write_text(json.dumps(resumen, indent=2, ensure_ascii=False), encoding="utf-8")

        return resumen

    finally:
        con.close()


def main():
    parser = argparse.ArgumentParser(description="Worker CLI para ingesta y validación de BUK.")
    parser.add_argument("archivo", help="Ruta al archivo .xlsx de contratos BUK")
    parser.add_argument("--db", default="backend/db.sqlite", help="Ruta a la base de datos SQLite")
    parser.add_argument("--out-dir", default="bot/reportes", help="Directorio de salida para reportes")
    args = parser.parse_args()

    resumen = validar_y_procesar_buk(args.archivo, args.db, args.out_dir)
    print(f"Lote #{resumen['lote_id']} procesado:")
    print(f"  Archivo: {resumen['archivo']}")
    print(f"  Válidos: {resumen['validos']}")
    print(f"  Rechazados: {resumen['rechazados']}")
    print(f"  Duración: {resumen['duracion_ms']} ms")
    print(f"  Reporte generado: {resumen['reporte_rechazos']}")


if __name__ == "__main__":
    main()
