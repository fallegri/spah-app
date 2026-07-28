import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const rolEnum = pgEnum("rol", ["administrador", "docente", "asistente"]);
export const tipoEspacioEnum = pgEnum("tipo_espacio", [
  "AULA",
  "TALLER",
  "LABORATORIO",
]);
export const turnoEnum = pgEnum("turno", ["Mañana", "Tarde", "Noche"]);
export const diaEnum = pgEnum("dia", [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
]);

// ─── DOCENTES ───────────────────────────────────────────────────────────────
export const docentes = pgTable("docentes", {
  id: serial("id").primaryKey(),
  ci: varchar("ci", { length: 30 }).notNull().unique(),
  nombre: varchar("nombre", { length: 200 }).notNull(),
  profesion: varchar("profesion", { length: 200 }),
  telefono: varchar("telefono", { length: 50 }),
  gestion: varchar("gestion", { length: 10 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── USUARIOS ───────────────────────────────────────────────────────────────
export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 200 }).notNull(),
  nombre: varchar("nombre", { length: 200 }).notNull(),
  rol: rolEnum("rol").notNull().default("docente"),
  docenteId: integer("docente_id").references(() => docentes.id),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── DISPONIBILIDAD DOCENTE ─────────────────────────────────────────────────
export const disponibilidadDocente = pgTable(
  "disponibilidad_docente",
  {
    id: serial("id").primaryKey(),
    docenteId: integer("docente_id")
      .references(() => docentes.id, { onDelete: "cascade" })
      .notNull(),
    dia: diaEnum("dia").notNull(),
    slot: varchar("slot", { length: 10 }).notNull(), // "07:45", "08:30", etc.
    gestion: varchar("gestion", { length: 10 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    docenteDiaSlotIdx: uniqueIndex("disp_docente_dia_slot_gestion_idx").on(
      table.docenteId,
      table.dia,
      table.slot,
      table.gestion
    ),
  })
);

// ─── MATERIAS HABILITADAS ───────────────────────────────────────────────────
export const materiasHabilitadas = pgTable(
  "materias_habilitadas",
  {
    id: serial("id").primaryKey(),
    docenteId: integer("docente_id")
      .references(() => docentes.id, { onDelete: "cascade" })
      .notNull(),
    sigla: varchar("sigla", { length: 30 }).notNull(),
    nombreMateria: varchar("nombre_materia", { length: 200 }),
    carrera: varchar("carrera", { length: 200 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    docenteSiglaIdx: index("mat_hab_docente_sigla_idx").on(
      table.docenteId,
      table.sigla
    ),
  })
);

// ─── MATERIAS CATÁLOGO ──────────────────────────────────────────────────────
export const materiasCatalogo = pgTable(
  "materias_catalogo",
  {
    id: serial("id").primaryKey(),
    escuela: integer("escuela").notNull(), // 1=EIT, 2=EI, 3=EGT, 4=EAN
    carrera: varchar("carrera", { length: 200 }).notNull(),
    resolucionMinisterial: varchar("resolucion_ministerial", { length: 50 }),
    nombreAsignatura: varchar("nombre_asignatura", { length: 200 }).notNull(),
    codigo: varchar("codigo", { length: 30 }).notNull(),
    grupoCodigo: varchar("grupo_codigo", { length: 20 }).notNull(),
    turno: turnoEnum("turno").notNull(),
    proyeccionInscritos: integer("proyeccion_inscritos").default(0),
    horasPorSemana: integer("horas_por_semana").notNull(),
    semestre: varchar("semestre", { length: 20 }).notNull(),
    tipoAula: tipoEspacioEnum("tipo_aula"),
    gestion: varchar("gestion", { length: 10 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    codigoGrupoGestionIdx: uniqueIndex("cat_codigo_grupo_gestion_idx").on(
      table.codigo,
      table.grupoCodigo,
      table.gestion
    ),
  })
);

// ─── ESPACIOS ───────────────────────────────────────────────────────────────
export const espacios = pgTable("espacios", {
  id: serial("id").primaryKey(),
  codigo: varchar("codigo", { length: 100 }).notNull().unique(),
  tipo: tipoEspacioEnum("tipo").notNull(),
  aforo: integer("aforo").notNull(),
  escuela: integer("escuela").notNull(), // 1=EIT, 2=EI, 3=EGT, 4=EAN
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── RESERVAS EXTERNAS ──────────────────────────────────────────────────────
export const reservasEspacios = pgTable(
  "reservas_espacios",
  {
    id: serial("id").primaryKey(),
    espacioId: integer("espacio_id")
      .references(() => espacios.id, { onDelete: "cascade" })
      .notNull(),
    dia: diaEnum("dia").notNull(),
    slot: varchar("slot", { length: 10 }).notNull(),
    motivo: varchar("motivo", { length: 200 }),
    gestion: varchar("gestion", { length: 10 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    espacioDiaSlotIdx: uniqueIndex("res_espacio_dia_slot_gestion_idx").on(
      table.espacioId,
      table.dia,
      table.slot,
      table.gestion
    ),
  })
);

// ─── EJECUCIONES ────────────────────────────────────────────────────────────
export const ejecuciones = pgTable("ejecuciones", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id")
    .references(() => usuarios.id)
    .notNull(),
  gestion: varchar("gestion", { length: 10 }).notNull(),
  configuracion: jsonb("configuracion").notNull(), // All scheduler params
  totalAsignadas: integer("total_asignadas").default(0),
  totalConflictos: integer("total_conflictos").default(0),
  totalAIR: integer("total_air").default(0),
  totalSinDocente: integer("total_sin_docente").default(0),
  duracionMs: integer("duracion_ms"),
  activa: boolean("activa").default(false).notNull(),
  log: text("log"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── ASIGNACIONES ───────────────────────────────────────────────────────────
export const asignaciones = pgTable(
  "asignaciones",
  {
    id: serial("id").primaryKey(),
    ejecucionId: integer("ejecucion_id")
      .references(() => ejecuciones.id, { onDelete: "cascade" })
      .notNull(),
    materiaCodigo: varchar("materia_codigo", { length: 30 }).notNull(),
    materiaNombre: varchar("materia_nombre", { length: 200 }).notNull(),
    grupoCodigo: varchar("grupo_codigo", { length: 20 }).notNull(),
    carrera: varchar("carrera", { length: 200 }).notNull(),
    semestre: varchar("semestre", { length: 20 }).notNull(),
    docenteId: integer("docente_id").references(() => docentes.id),
    docenteNombre: varchar("docente_nombre", { length: 200 }),
    espacioId: integer("espacio_id").references(() => espacios.id),
    espacioCodigo: varchar("espacio_codigo", { length: 100 }),
    dia: diaEnum("dia").notNull(),
    slots: jsonb("slots").notNull(), // Array of slot strings ["07:45","08:30","09:15"]
    turno: turnoEnum("turno").notNull(),
    tipoEspacio: tipoEspacioEnum("tipo_espacio"),
    esAIR: boolean("es_air").default(false).notNull(),
    esSinDocente: boolean("es_sin_docente").default(false).notNull(),
    sesionIndex: integer("sesion_index").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    ejecucionIdx: index("asig_ejecucion_idx").on(table.ejecucionId),
  })
);

// ─── CONFLICTOS ─────────────────────────────────────────────────────────────
export const conflictos = pgTable("conflictos", {
  id: serial("id").primaryKey(),
  ejecucionId: integer("ejecucion_id")
    .references(() => ejecuciones.id, { onDelete: "cascade" })
    .notNull(),
  materiaCodigo: varchar("materia_codigo", { length: 30 }).notNull(),
  materiaNombre: varchar("materia_nombre", { length: 200 }).notNull(),
  grupoCodigo: varchar("grupo_codigo", { length: 20 }).notNull(),
  carrera: varchar("carrera", { length: 200 }),
  semestre: varchar("semestre", { length: 20 }),
  sesionIndex: integer("sesion_index").default(0),
  motivo: text("motivo").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── AI CONFIG ──────────────────────────────────────────────────────────────
export const aiConfig = pgTable("ai_config", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 20 }).notNull(), // nvidia, openai, ollama
  apiKey: varchar("api_key", { length: 500 }),
  baseUrl: varchar("base_url", { length: 500 }),
  model: varchar("model", { length: 100 }).notNull(),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── RELATIONS ──────────────────────────────────────────────────────────────
export const docentesRelations = relations(docentes, ({ many, one }) => ({
  usuario: one(usuarios, {
    fields: [docentes.id],
    references: [usuarios.docenteId],
  }),
  disponibilidad: many(disponibilidadDocente),
  materiasHabilitadas: many(materiasHabilitadas),
  asignaciones: many(asignaciones),
}));

export const usuariosRelations = relations(usuarios, ({ one }) => ({
  docente: one(docentes, {
    fields: [usuarios.docenteId],
    references: [docentes.id],
  }),
}));

export const ejecucionesRelations = relations(ejecuciones, ({ one, many }) => ({
  usuario: one(usuarios, {
    fields: [ejecuciones.usuarioId],
    references: [usuarios.id],
  }),
  asignaciones: many(asignaciones),
  conflictos: many(conflictos),
}));

export const asignacionesRelations = relations(asignaciones, ({ one }) => ({
  ejecucion: one(ejecuciones, {
    fields: [asignaciones.ejecucionId],
    references: [ejecuciones.id],
  }),
  docente: one(docentes, {
    fields: [asignaciones.docenteId],
    references: [docentes.id],
  }),
  espacio: one(espacios, {
    fields: [asignaciones.espacioId],
    references: [espacios.id],
  }),
}));
