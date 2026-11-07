-- SQLite DDL normalizado con versionado por lote
-- Tablas: institutos, contratos, parametros_distribucion, parametros_grupal, asignaciones, planes, lotes, rechazados, sic_real
-- Trazabilidad: toda fila lleva lote_id

-- Tabla de lotes (control de versionado e ingesta)
CREATE TABLE lotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp_ingesta TEXT NOT NULL DEFAULT (datetime('now')),
    duracion_ms INTEGER NOT NULL DEFAULT 0,
    total_registros INTEGER NOT NULL DEFAULT 0,
    validos INTEGER NOT NULL DEFAULT 0,
    rechazados INTEGER NOT NULL DEFAULT 0,
    archivo_origen TEXT,
    hash_archivo TEXT,
    observaciones TEXT
);

-- Catálogo de institutos
CREATE TABLE institutos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_it INTEGER NOT NULL UNIQUE,
    sigla TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    zona TEXT, -- Arica, Ñuble, Aysén, etc.
    activo INTEGER NOT NULL DEFAULT 1,
    lote_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (lote_id) REFERENCES lotes(id)
);

-- Contratos (con PK compuesta que evita duplicados: PersonaId + IT + Periodo + lote_id)
CREATE TABLE contratos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id REAL NOT NULL,
    it INTEGER NOT NULL,
    instituto_sigla TEXT NOT NULL,
    area TEXT,
    sub_area TEXT,
    centro_costo TEXT,
    fecha_nacimiento TEXT,
    periodo TEXT NOT NULL, -- YYYY-MM-DD (primer día del mes)
    tipo_contrato TEXT,
    tipo_trabajador TEXT,
    fecha_ingreso_compania TEXT,
    fecha_termino TEXT, -- NULL = vigente
    horas_semanales REAL NOT NULL,
    cargo TEXT,
    dias_jornada TEXT, -- ej: 'lmwj'
    reg_sic TEXT,
    cod_esp TEXT,
    n_dias INTEGER,
    vacante_nuevo TEXT, -- 'Vacante', 'Nuevo', o vacío
    lote_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (lote_id) REFERENCES lotes(id),
    UNIQUE (persona_id, it, periodo, lote_id)
);

-- Parámetros de distribución (NAS, Directo, Indirecto, etc.)
CREATE TABLE parametros_distribucion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tramo TEXT NOT NULL, -- 'tramo1_44h', 'tramo2_22a40', 'tramo3_<22h'
    cargo TEXT,
    cod_esp TEXT,
    pct_nas REAL NOT NULL,
    pct_directo REAL NOT NULL,
    pct_indirecto REAL NOT NULL,
    pausa_saludable_horas REAL DEFAULT 0,
    colacion_15_min INTEGER DEFAULT 0,
    otras_nas_horas REAL DEFAULT 0,
    lote_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (lote_id) REFERENCES lotes(id),
    UNIQUE (tramo, cargo, cod_esp, lote_id)
);

-- Parámetros grupales (PctGrupal, NPacientes, etc.)
CREATE TABLE parametros_grupal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cargo TEXT NOT NULL,
    cod_esp TEXT,
    pct_grupal REAL NOT NULL DEFAULT 0,
    n_pacientes REAL NOT NULL DEFAULT 0,
    ate_sem_dir_grupal REAL NOT NULL DEFAULT 0,
    lote_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (lote_id) REFERENCES lotes(id),
    UNIQUE (cargo, cod_esp, lote_id)
);

-- Asignaciones especiales (Líder Equipo, Tutor, etc.)
CREATE TABLE asignaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL, -- 'Líder Equipo', 'Tutor docente', 'Responsable técnico', etc.
    horas REAL NOT NULL,
    cargo TEXT,
    cod_esp TEXT,
    it INTEGER, -- NULL = aplica a todos los institutos
    lote_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (lote_id) REFERENCES lotes(id),
    UNIQUE (nombre, cargo, cod_esp, it, lote_id)
);

-- Planes calculados (resultado del motor de cálculo)
CREATE TABLE planes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id REAL NOT NULL,
    it INTEGER NOT NULL,
    periodo TEXT NOT NULL, -- YYYY-MM-DD
    cargo TEXT,
    cod_esp TEXT,
    h_sem REAL NOT NULL,
    tramo TEXT NOT NULL,
    plan_ate_dir_m INTEGER NOT NULL,
    plan_ate_ind_m INTEGER NOT NULL,
    pct_nas REAL,
    pct_directo REAL,
    pct_indirecto REAL,
    pct_asistencial REAL,
    h_sem_disp_ate TEXT, -- timedelta as string
    min_directa REAL,
    ate_dir_sem REAL,
    ate_ind_sem REAL,
    pct_grupal REAL,
    n_pacientes REAL,
    ate_sem_dir_grupal REAL,
    plan_dir_anual INTEGER,
    total_plan_dir REAL,
    total_mg_directa REAL,
    lote_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (lote_id) REFERENCES lotes(id),
    UNIQUE (persona_id, it, periodo, lote_id)
);

-- Registros rechazados durante la ingesta
CREATE TABLE rechazados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fila_original INTEGER NOT NULL,
    datos_json TEXT NOT NULL, -- JSON con todos los campos originales
    motivo TEXT NOT NULL,
    severidad TEXT NOT NULL DEFAULT 'ERROR', -- 'ERROR', 'WARNING'
    lote_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (lote_id) REFERENCES lotes(id)
);

-- SIC real (atenciones ejecutadas)
CREATE TABLE sic_real (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id REAL NOT NULL,
    it INTEGER NOT NULL,
    periodo TEXT NOT NULL, -- YYYY-MM-DD
    atenciones_directas INTEGER NOT NULL DEFAULT 0,
    atenciones_indirectas INTEGER NOT NULL DEFAULT 0,
    atenciones_grupales INTEGER NOT NULL DEFAULT 0,
    lote_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (lote_id) REFERENCES lotes(id),
    UNIQUE (persona_id, it, periodo, lote_id)
);

-- Índices para performance en queries típicas (#20: kpis/plan/plan-vs-real/lotes)
CREATE INDEX idx_contratos_lote ON contratos(lote_id);
CREATE INDEX idx_contratos_persona_periodo ON contratos(persona_id, periodo);
CREATE INDEX idx_contratos_it_periodo ON contratos(it, periodo);
CREATE INDEX idx_planes_lote ON planes(lote_id);
CREATE INDEX idx_planes_persona_periodo ON planes(persona_id, periodo);
CREATE INDEX idx_planes_it_periodo ON planes(it, periodo);
CREATE INDEX idx_sic_real_lote ON sic_real(lote_id);
CREATE INDEX idx_sic_real_persona_periodo ON sic_real(persona_id, periodo);
CREATE INDEX idx_rechazados_lote ON rechazados(lote_id);
CREATE INDEX idx_parametros_dist_lote ON parametros_distribucion(lote_id);
CREATE INDEX idx_parametros_grupal_lote ON parametros_grupal(lote_id);
CREATE INDEX idx_asignaciones_lote ON asignaciones(lote_id);
CREATE INDEX idx_institutos_lote ON institutos(lote_id);