-- ═══════════════════════════════════════════════════════════════════════════════
-- SPAH v2.0 — Schema PostgreSQL para Neon
-- Ejecutar completo en el SQL Editor de console.neon.tech
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── ENUMS ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE rol AS ENUM ('administrador', 'docente', 'asistente');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_espacio AS ENUM ('AULA', 'TALLER', 'LABORATORIO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE turno AS ENUM ('Mañana', 'Tarde', 'Noche');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dia AS ENUM ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 1. DOCENTES ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docentes (
  id            SERIAL PRIMARY KEY,
  ci            VARCHAR(30) NOT NULL UNIQUE,
  nombre        VARCHAR(200) NOT NULL,
  profesion     VARCHAR(200),
  telefono      VARCHAR(50),
  gestion       VARCHAR(10),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── 2. USUARIOS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,
  nombre        VARCHAR(200) NOT NULL,
  rol           rol NOT NULL DEFAULT 'docente',
  docente_id    INTEGER REFERENCES docentes(id),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── 3. DISPONIBILIDAD DOCENTE ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS disponibilidad_docente (
  id            SERIAL PRIMARY KEY,
  docente_id    INTEGER NOT NULL REFERENCES docentes(id) ON DELETE CASCADE,
  dia           dia NOT NULL,
  slot          VARCHAR(10) NOT NULL,  -- "07:45", "08:30", etc.
  gestion       VARCHAR(10) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS disp_docente_dia_slot_gestion_idx
  ON disponibilidad_docente (docente_id, dia, slot, gestion);

-- ─── 4. MATERIAS HABILITADAS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS materias_habilitadas (
  id              SERIAL PRIMARY KEY,
  docente_id      INTEGER NOT NULL REFERENCES docentes(id) ON DELETE CASCADE,
  sigla           VARCHAR(30) NOT NULL,
  nombre_materia  VARCHAR(200),
  carrera         VARCHAR(200),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mat_hab_docente_sigla_idx
  ON materias_habilitadas (docente_id, sigla);

-- ─── 5. MATERIAS CATÁLOGO ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS materias_catalogo (
  id                      SERIAL PRIMARY KEY,
  escuela                 INTEGER NOT NULL,  -- 1=EIT, 2=EI, 3=EGT, 4=EAN
  carrera                 VARCHAR(200) NOT NULL,
  resolucion_ministerial  VARCHAR(50),
  nombre_asignatura       VARCHAR(200) NOT NULL,
  codigo                  VARCHAR(30) NOT NULL,
  grupo_codigo            VARCHAR(20) NOT NULL,
  turno                   turno NOT NULL,
  proyeccion_inscritos    INTEGER DEFAULT 0,
  horas_por_semana        INTEGER NOT NULL,
  semestre                VARCHAR(20) NOT NULL,
  tipo_aula               tipo_espacio,
  gestion                 VARCHAR(10) NOT NULL,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS cat_codigo_grupo_gestion_idx
  ON materias_catalogo (codigo, grupo_codigo, gestion);

-- ─── 6. ESPACIOS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS espacios (
  id          SERIAL PRIMARY KEY,
  codigo      VARCHAR(100) NOT NULL UNIQUE,
  tipo        tipo_espacio NOT NULL,
  aforo       INTEGER NOT NULL,
  escuela     INTEGER NOT NULL,  -- 1=EIT, 2=EI, 3=EGT, 4=EAN
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── 7. RESERVAS EXTERNAS DE ESPACIOS ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS reservas_espacios (
  id          SERIAL PRIMARY KEY,
  espacio_id  INTEGER NOT NULL REFERENCES espacios(id) ON DELETE CASCADE,
  dia         dia NOT NULL,
  slot        VARCHAR(10) NOT NULL,
  motivo      VARCHAR(200),
  gestion     VARCHAR(10) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS res_espacio_dia_slot_gestion_idx
  ON reservas_espacios (espacio_id, dia, slot, gestion);

-- ─── 8. EJECUCIONES ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ejecuciones (
  id                SERIAL PRIMARY KEY,
  usuario_id        INTEGER NOT NULL REFERENCES usuarios(id),
  gestion           VARCHAR(10) NOT NULL,
  configuracion     JSONB NOT NULL,
  total_asignadas   INTEGER DEFAULT 0,
  total_conflictos  INTEGER DEFAULT 0,
  total_air         INTEGER DEFAULT 0,
  total_sin_docente INTEGER DEFAULT 0,
  duracion_ms       INTEGER,
  activa            BOOLEAN NOT NULL DEFAULT FALSE,
  log               TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── 9. ASIGNACIONES ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS asignaciones (
  id              SERIAL PRIMARY KEY,
  ejecucion_id    INTEGER NOT NULL REFERENCES ejecuciones(id) ON DELETE CASCADE,
  materia_codigo  VARCHAR(30) NOT NULL,
  materia_nombre  VARCHAR(200) NOT NULL,
  grupo_codigo    VARCHAR(20) NOT NULL,
  carrera         VARCHAR(200) NOT NULL,
  semestre        VARCHAR(20) NOT NULL,
  docente_id      INTEGER REFERENCES docentes(id),
  docente_nombre  VARCHAR(200),
  espacio_id      INTEGER REFERENCES espacios(id),
  espacio_codigo  VARCHAR(100),
  dia             dia NOT NULL,
  slots           JSONB NOT NULL,  -- ["07:45","08:30","09:15"]
  turno           turno NOT NULL,
  tipo_espacio    tipo_espacio,
  es_air          BOOLEAN NOT NULL DEFAULT FALSE,
  es_sin_docente  BOOLEAN NOT NULL DEFAULT FALSE,
  sesion_index    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS asig_ejecucion_idx ON asignaciones (ejecucion_id);

-- ─── 10. CONFLICTOS ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conflictos (
  id              SERIAL PRIMARY KEY,
  ejecucion_id    INTEGER NOT NULL REFERENCES ejecuciones(id) ON DELETE CASCADE,
  materia_codigo  VARCHAR(30) NOT NULL,
  materia_nombre  VARCHAR(200) NOT NULL,
  grupo_codigo    VARCHAR(20) NOT NULL,
  carrera         VARCHAR(200),
  semestre        VARCHAR(20),
  sesion_index    INTEGER DEFAULT 0,
  motivo          TEXT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── 11. AI CONFIG ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_config (
  id          SERIAL PRIMARY KEY,
  provider    VARCHAR(20) NOT NULL,  -- nvidia, openai, ollama
  api_key     VARCHAR(500),
  base_url    VARCHAR(500),
  model       VARCHAR(100) NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── VERIFICACIÓN ───────────────────────────────────────────────────────────
-- Ejecuta esto al final para confirmar que todo se creó correctamente:

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Debe mostrar 11 tablas:
-- ai_config, asignaciones, conflictos, disponibilidad_docente, docentes,
-- ejecuciones, espacios, materias_catalogo, materias_habilitadas,
-- reservas_espacios, usuarios
