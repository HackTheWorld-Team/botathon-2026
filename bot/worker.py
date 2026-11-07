#!/usr/bin/env python3
"""
bot/worker.py — Ingesta, validación, publicación a SQLite, detección de deltas y 42h no retroactivo (Issues #11, #15).

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
  4. Inserta o actualiza registros válidos en la tabla 'contratos'
  5. Detección de deltas (Issue #15):
     - Compara lote entrante con el estado previo (meses anteriores o contratos existentes):
       * ALTAS: PersonaId nuevo o primer registro del período.
       * BAJAS: Persona con Fecha Término informada en el período o ausente respecto al mes anterior.
       * CAMBIOS DE JORNADA: Variación de Horas Semanales (ej. 44h -> 42h por ley).
       * MULTI-SEDE: PersonaId asignado a >= 2 institutos (ITs) distintos en el período.
     - Guarda tabla 'deltas' en SQLite y genera resumen JSON con detalle por profesional e instituto.
  6. Recálculo no retroactivo de planes:
     - Invoca backend.motor para generar planes mensuales exclusivamente desde el período de vigencia
       de los contratos ingeridos, manteniendo intactos los meses anteriores.
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


def asegurar_tablas(con: sqlite3.Connection) -> None:
    """Asegura que existan las tablas necesarias, incluyendo la tabla deltas."""
    cur = con.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS deltas (
            delta_id INTEGER PRIMARY KEY AUTOINCREMENT,
            lote_id INTEGER NOT NULL REFERENCES lotes(lote_id),
            periodo TEXT NOT NULL,
            persona_id INTEGER NOT NULL,
            it INTEGER NOT NULL REFERENCES institutos(it),
            tipo_delta TEXT NOT NULL CHECK (tipo_delta IN ('ALTA', 'BAJA', 'CAMBIO_JORNADA', 'MULTI_SEDE')),
            valor_anterior TEXT,
            valor_nuevo TEXT,
            detalle TEXT
        )
        """
    )
    cur.execute("CREATE INDEX IF NOT EXISTS idx_deltas_lote ON deltas(lote_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_deltas_periodo ON deltas(periodo)")
    con.commit()


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


def mes_previo(periodo: str) -> str:
    """Dado 'YYYY-MM-01', retorna el período anterior 'YYYY-MM-01'."""
    dt = pd.to_datetime(periodo)
    prev = dt - pd.DateOffset(months=1)
    return prev.strftime("%Y-%m-01")


def detectar_deltas(
    con: sqlite3.Connection,
    lote_id: int,
    periodos_afectados: List[str]
) -> List[Dict[str, Any]]:
    """
    Detecta deltas para los períodos afectados comparando con el mes inmediatamente anterior:
      1. ALTAS: profesional que no existía en contratos previos.
      2. CAMBIOS DE JORNADA: profesional cuyas horas semanales difieren del mes previo (ej. 44 -> 42h).
      3. MULTI-SEDE: profesional que presta servicios en >1 IT en el mismo período.
      4. BAJAS: profesional con Fecha Término informada en el período o que desaparece del mes anterior.
    """
    cur = con.cursor()
    deltas: List[Dict[str, Any]] = []

    for periodo in sorted(periodos_afectados):
        prev_p = mes_previo(periodo)

        # Contratos del período actual en lote_id
        cur.execute(
            """
            SELECT it, persona_id, cargo, horas_semanales, fecha_ingreso, fecha_termino, cod_esp
            FROM contratos
            WHERE periodo = ? AND lote_id = ?
            """,
            (periodo, lote_id)
        )
        actuales = cur.fetchall()

        # Contratos del período previo (de cualquier lote previo)
        cur.execute(
            """
            SELECT it, persona_id, cargo, horas_semanales, fecha_ingreso, fecha_termino, cod_esp
            FROM contratos
            WHERE periodo = ?
            """,
            (prev_p,)
        )
        anteriores = cur.fetchall()
        dict_ant = {(r["persona_id"], r["it"]): dict(r) for r in anteriores}
        pids_ant_global = {r["persona_id"] for r in anteriores}

        # Conjunto de pids históricos en toda la BD antes de este período
        cur.execute("SELECT DISTINCT persona_id FROM contratos WHERE periodo < ?", (periodo,))
        pids_historicos = {r[0] for r in cur.fetchall()}

        # 1. Agrupación por PersonaId en período actual para detectar multi-sede
        pids_actuales: Dict[int, List[sqlite3.Row]] = {}
        for r in actuales:
            pids_actuales.setdefault(r["persona_id"], []).append(r)

        # Multi-sede
        for pid, rows in pids_actuales.items():
            if len(rows) > 1:
                its = [str(r["it"]) for r in rows]
                horas_por_it = [f"IT {r['it']}: {r['horas_semanales']}h" for r in rows]
                for r in rows:
                    deltas.append({
                        "lote_id": lote_id,
                        "periodo": periodo,
                        "persona_id": pid,
                        "it": r["it"],
                        "tipo_delta": "MULTI_SEDE",
                        "valor_anterior": None,
                        "valor_nuevo": f"ITs: {', '.join(its)}",
                        "detalle": f"Profesional multi-sede en {len(rows)} institutos ({'; '.join(horas_por_it)})"
                    })

        # 2. Altas, Cambios de jornada y Bajas por Fecha Término
        for r in actuales:
            pid = r["persona_id"]
            it = r["it"]
            hs = r["horas_semanales"]
            f_term = r["fecha_termino"]

            # ¿Es alta?
            if pid not in pids_historicos:
                deltas.append({
                    "lote_id": lote_id,
                    "periodo": periodo,
                    "persona_id": pid,
                    "it": it,
                    "tipo_delta": "ALTA",
                    "valor_anterior": None,
                    "valor_nuevo": f"{hs}h ({r['cargo']})",
                    "detalle": f"Alta nueva de profesional en IT {it} (Ingreso: {r['fecha_ingreso'] or 'N/A'})"
                })
            else:
                # Si existía en el mes previo para el mismo IT
                ant = dict_ant.get((pid, it))
                if ant:
                    if abs(ant["horas_semanales"] - hs) > 0.01:
                        deltas.append({
                            "lote_id": lote_id,
                            "periodo": periodo,
                            "persona_id": pid,
                            "it": it,
                            "tipo_delta": "CAMBIO_JORNADA",
                            "valor_anterior": f"{ant['horas_semanales']}h",
                            "valor_nuevo": f"{hs}h",
                            "detalle": f"Cambio de jornada de {ant['horas_semanales']}h a {hs}h a contar de {periodo}"
                        })
                elif pid in pids_ant_global:
                    # Persona trabajaba en otro IT el mes pasado
                    deltas.append({
                        "lote_id": lote_id,
                        "periodo": periodo,
                        "persona_id": pid,
                        "it": it,
                        "tipo_delta": "ALTA",
                        "valor_anterior": None,
                        "valor_nuevo": f"{hs}h en IT {it}",
                        "detalle": f"Nueva sede IT {it} asignada a profesional en {periodo}"
                    })

            # Baja explícita por Fecha Término en este mes
            if f_term and f_term.startswith(periodo[:7]):
                deltas.append({
                    "lote_id": lote_id,
                    "periodo": periodo,
                    "persona_id": pid,
                    "it": it,
                    "tipo_delta": "BAJA",
                    "valor_anterior": "Vigente",
                    "valor_nuevo": f"Finiquito {f_term}",
                    "detalle": f"Baja por fecha término estipulada al {f_term}"
                })

        # 3. Bajas por ausencia respecto al mes previo (si hay mes previo)
        if anteriores:
            actual_keys = {(r["persona_id"], r["it"]) for r in actuales}
            for (pid_ant, it_ant), r_ant in dict_ant.items():
                if (pid_ant, it_ant) not in actual_keys:
                    deltas.append({
                        "lote_id": lote_id,
                        "periodo": periodo,
                        "persona_id": pid_ant,
                        "it": it_ant,
                        "tipo_delta": "BAJA",
                        "valor_anterior": f"{r_ant['horas_semanales']}h (IT {it_ant})",
                        "valor_nuevo": "No figura en dotación",
                        "detalle": f"Baja / no renovación respecto al período {prev_p}"
                    })

    # Insertar deltas en BD
    for d in deltas:
        cur.execute(
            """
            INSERT INTO deltas (lote_id, periodo, persona_id, it, tipo_delta, valor_anterior, valor_nuevo, detalle)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                d["lote_id"], d["periodo"], d["persona_id"], d["it"],
                d["tipo_delta"], d["valor_anterior"], d["valor_nuevo"], d["detalle"]
            )
        )
    con.commit()
    return deltas


def recalcular_planes_vigentes(
    con: sqlite3.Connection,
    lote_id: int,
    periodos_afectados: List[str]
) -> int:
    """
    Calcula los planes asistenciales exclusivamente para los períodos afectados (no retroactivo).
    Usa el motor de cálculo importado.
    """
    try:
        from backend.motor import CatalogosMotor, calcular_contrato_mes
        catalogos = CatalogosMotor.desde_db_con(con)
    except Exception:
        # Si CatalogosMotor no tiene desde_db_con o falla, usar fallback con path
        try:
            from backend.motor import CatalogosMotor, calcular_contrato_mes
            catalogos = CatalogosMotor.desde_db()
        except Exception:
            return 0

    cur = con.cursor()
    total_calculados = 0

    for periodo in periodos_afectados:
        cur.execute(
            """
            SELECT persona_id, it, periodo, cargo, horas_semanales, cod_esp
            FROM contratos
            WHERE periodo = ? AND lote_id = ?
            """,
            (periodo, lote_id)
        )
        contratos = cur.fetchall()

        for c in contratos:
            calc = calcular_contrato_mes(
                persona_id=c["persona_id"],
                it=c["it"],
                periodo=c["periodo"],
                cargo=c["cargo"],
                horas_semanales=c["horas_semanales"],
                cod_esp=c["cod_esp"],
                catalogos=catalogos
            )

            cur.execute(
                """
                INSERT OR REPLACE INTO planes (
                    persona_id, it, periodo, pct_nas, pct_directo, pct_indirecto,
                    h_sem_disp_ate, ate_dir_sem, ate_ind_sem, sem_efectivas,
                    plan_dir_m, plan_ind_m, mg_dir_m, lote_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    calc["persona_id"], calc["it"], calc["periodo"],
                    calc["pct_nas"], calc["pct_directo"], calc["pct_indirecto"],
                    calc["h_sem_disp_ate"], calc["ate_dir_sem"], calc["ate_ind_sem"],
                    calc["sem_efectivas"], calc["plan_dir_m"], calc["plan_ind_m"],
                    calc["mg_dir_m"], lote_id
                )
            )
            total_calculados += 1

    con.commit()
    return total_calculados


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
        asegurar_tablas(con)
        institutos_validos = obtener_catalogo_it(con)

        # Leer archivo Excel - Dotacion_2026 o primera hoja
        try:
            df = pd.read_excel(ruta_archivo, sheet_name="Dotacion_2026", header=1)
        except Exception:
            df = pd.read_excel(ruta_archivo, header=1)

        validos: List[Dict[str, Any]] = []
        rechazados: List[Dict[str, Any]] = []
        pk_vistas: Set[Tuple[int, int, str]] = set()

        for idx, row in df.iterrows():
            fila_origen = int(idx) + 3
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

            # Validar Duplicado PK [PersonaId + IT + Periodo] dentro del mismo archivo entrante
            pk = (persona_id, it, periodo)
            if pk in pk_vistas:
                rechazados.append({
                    "fila_origen": fila_origen,
                    "motivo": "DUP_PK",
                    "detalle": f"Registro duplicado dentro del archivo para PK [PersonaId={persona_id}, IT={it}, Periodo={periodo}]",
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
        cur = con.cursor()
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

        # Identificar períodos afectados en esta corrida
        periodos_afectados = sorted(list({v["periodo"] for v in validos}))

        # Detectar deltas contra historial
        deltas = detectar_deltas(con, lote_id, periodos_afectados)

        # Recálculo de planes desde vigencia
        planes_calculados = recalcular_planes_vigentes(con, lote_id, periodos_afectados)

        # Generar Reporte de Rechazos en Excel
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
            df_vacio = pd.DataFrame(columns=["Fila Origen", "Motivo", "Descripción Error"])
            df_vacio.to_excel(reporte_excel_path, index=False)

        # Guardar resumen en JSON (incluyendo conteo de deltas)
        conteo_deltas = {
            "altas": sum(1 for d in deltas if d["tipo_delta"] == "ALTA"),
            "bajas": sum(1 for d in deltas if d["tipo_delta"] == "BAJA"),
            "cambios_jornada": sum(1 for d in deltas if d["tipo_delta"] == "CAMBIO_JORNADA"),
            "multi_sede": sum(1 for d in deltas if d["tipo_delta"] == "MULTI_SEDE"),
            "total_deltas": len(deltas)
        }

        resumen = {
            "lote_id": lote_id,
            "archivo": path_archivo.name,
            "tipo": "BUK",
            "fecha_corrida": fecha_corrida,
            "duracion_ms": duracion_ms,
            "total_filas": len(df),
            "validos": len(validos),
            "rechazados": len(rechazados),
            "periodos_afectados": periodos_afectados,
            "deltas": conteo_deltas,
            "planes_calculados": planes_calculados,
            "reporte_rechazos": str(reporte_excel_path)
        }
        resumen_json_path = Path(out_dir) / f"resumen_lote_{lote_id}.json"
        resumen_json_path.write_text(json.dumps(resumen, indent=2, ensure_ascii=False), encoding="utf-8")

        return resumen

    finally:
        con.close()


def main():
    parser = argparse.ArgumentParser(description="Worker CLI para ingesta, validación, deltas y publicación de BUK.")
    parser.add_argument("archivo", help="Ruta al archivo .xlsx de contratos BUK")
    parser.add_argument("--db", default="backend/db.sqlite", help="Ruta a la base de datos SQLite")
    parser.add_argument("--out-dir", default="bot/reportes", help="Directorio de salida para reportes")
    args = parser.parse_args()

    resumen = validar_y_procesar_buk(args.archivo, args.db, args.out_dir)
    print(f"Lote #{resumen['lote_id']} procesado:")
    print(f"  Archivo: {resumen['archivo']}")
    print(f"  Válidos: {resumen['validos']}")
    print(f"  Rechazados: {resumen['rechazados']}")
    print(f"  Deltas detectados: {resumen['deltas']['total_deltas']} (Altas: {resumen['deltas']['altas']}, Cambios 42h/jornada: {resumen['deltas']['cambios_jornada']}, Multi-sede: {resumen['deltas']['multi_sede']}, Bajas: {resumen['deltas']['bajas']})")
    print(f"  Planes calculados desde vigencia: {resumen['planes_calculados']}")
    print(f"  Duración: {resumen['duracion_ms']} ms")
    print(f"  Reporte generado: {resumen['reporte_rechazos']}")


if __name__ == "__main__":
    main()
