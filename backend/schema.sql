-- Esquema SQLite del MVP Botathon 2026 (issue #19).
-- Contrato de datos compartido: bot/worker.py escribe; FastAPI lee; cambios solo vía PR.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS institutos (
    it          INTEGER PRIMARY KEY,          -- código IT (11..141)
    sigla       TEXT NOT NULL UNIQUE,         -- Ari, San, ...
    nombre      TEXT
);

CREATE TABLE IF NOT EXISTS lotes (
    lote_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    archivo     TEXT NOT NULL,                -- nombre del archivo ingerido
    tipo        TEXT NOT NULL CHECK (tipo IN ('BUK', 'SIC')),
    fecha_corrida TEXT NOT NULL,              -- ISO timestamp de ingesta
    duracion_ms INTEGER,
    validos     INTEGER NOT NULL DEFAULT 0,
    rechazados  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contratos (
    contrato_id INTEGER PRIMARY KEY AUTOINCREMENT,
    lote_id     INTEGER NOT NULL REFERENCES lotes(lote_id),
    it          INTEGER NOT NULL REFERENCES institutos(it),
    persona_id  INTEGER NOT NULL,
    periodo     TEXT NOT NULL,                -- YYYY-MM-01
    cargo       TEXT NOT NULL,
    area        TEXT,
    centro_costo TEXT,
    tipo_contrato TEXT,
    fecha_ingreso TEXT,
    fecha_termino TEXT,                       -- NULL = vigente
    horas_semanales REAL NOT NULL CHECK (horas_semanales BETWEEN 0 AND 42
                                          OR (horas_semanales > 42 AND horas_semanales <= 44
                                              AND periodo < '2026-05-01')),
    cod_esp     TEXT NOT NULL,
    ndias       INTEGER,
    reg_sic     TEXT,
    vigente_desde TEXT,                       -- segmentación de vigencia (no retroactivo)
    UNIQUE (persona_id, it, periodo)          -- PK de negocio; duplicado = rechazo previo
);
CREATE INDEX IF NOT EXISTS idx_contratos_periodo ON contratos(periodo);
CREATE INDEX IF NOT EXISTS idx_contratos_persona ON contratos(persona_id);

CREATE TABLE IF NOT EXISTS parametros_distribucion (
    cargo       TEXT NOT NULL,                -- cargo homologado (uppercase)
    tramo       INTEGER NOT NULL CHECK (tramo IN (1, 2, 3)),  -- 1:>=40 · 2:22-<40 · 3:<22
    pct_directo REAL NOT NULL,
    pct_indirecto REAL NOT NULL,
    pct_nas     REAL NOT NULL,
    min_directa INTEGER NOT NULL DEFAULT 30,
    min_indirecta INTEGER NOT NULL DEFAULT 30,
    PRIMARY KEY (cargo, tramo)
);

CREATE TABLE IF NOT EXISTS parametros_grupal (
    cod_esp     TEXT PRIMARY KEY,             -- AS, ED, UEDA, ULAB, UTAC
    pct_grupal  REAL NOT NULL,
    n_pac_san_con REAL NOT NULL,              -- Santiago (131) / Concepción (81)
    n_pac_otros REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS asignaciones (
    asignacion_id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT NOT NULL UNIQUE,         -- 'Líder Equipo', 'Tutor docente', ...
    horas_semana REAL NOT NULL,
    requiere_vb_dmn INTEGER NOT NULL DEFAULT 0 CHECK (requiere_vb_dmn IN (0, 1))
);

CREATE TABLE IF NOT EXISTS semanas_habiles (
    anio        INTEGER NOT NULL,
    mes         INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    semanas     REAL NOT NULL,                -- 4.2, 4.0, 3.8 (mayo)...
    PRIMARY KEY (anio, mes)
);

CREATE TABLE IF NOT EXISTS planes (
    plan_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id  INTEGER NOT NULL,
    it          INTEGER NOT NULL REFERENCES institutos(it),
    periodo     TEXT NOT NULL,
    pct_nas     REAL, pct_directo REAL, pct_indirecto REAL,
    h_sem_disp_ate REAL,
    ate_dir_sem INTEGER, ate_ind_sem INTEGER,
    sem_efectivas REAL,
    plan_dir_m  INTEGER, plan_ind_m INTEGER,
    mg_dir_m    INTEGER,                      -- ⌊plan_dir_m × 0.90⌋
    lote_id     INTEGER NOT NULL REFERENCES lotes(lote_id),
    UNIQUE (persona_id, it, periodo)
);

CREATE TABLE IF NOT EXISTS rechazados (
    rechazo_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    lote_id     INTEGER NOT NULL REFERENCES lotes(lote_id),
    fila_origen INTEGER,
    motivo      TEXT NOT NULL,                -- código: NEGATIVE_HS | TEXT_HS | BAD_IT | DUP_PK | HS_OVER | BAD_ESP | OTHER
    detalle     TEXT,                         -- explicación legible para el reporte
    payload     TEXT                          -- fila original en JSON
);

CREATE TABLE IF NOT EXISTS sic_real (
    sic_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    lote_id     INTEGER NOT NULL REFERENCES lotes(lote_id),
    periodo     TEXT NOT NULL,
    it          INTEGER NOT NULL REFERENCES institutos(it),
    persona_id  INTEGER NOT NULL,
    cod_esp     TEXT NOT NULL,
    ate_dir_reales INTEGER NOT NULL CHECK (ate_dir_reales >= 0),
    ate_ind_reales INTEGER NOT NULL CHECK (ate_ind_reales >= 0),
    UNIQUE (persona_id, it, periodo)
);
