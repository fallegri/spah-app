// ─── CORE TYPES ─────────────────────────────────────────────────────────────

export type TipoEspacio = "AULA" | "TALLER" | "LABORATORIO";
export type Turno = "Mañana" | "Tarde" | "Noche";
export type Dia = "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado";
export type Rol = "administrador" | "docente" | "asistente";

// ─── SLOTS ──────────────────────────────────────────────────────────────────

export const SLOTS: string[] = [
  "07:45", "08:30", "09:15", "10:00", "10:45", "11:30", "12:15",
  "13:00", "13:45", "14:30", "15:15", "16:00", "16:45", "17:30",
  "18:15", "19:00", "19:45", "20:30", "21:15", "22:00", "22:45",
];

// SRS Sección 2.3: Turnos y Slots Horarios
// Mañana: 07:45 – 14:30 → 9 bloques de 45 min
// Tarde:  13:00 – 18:15 → 7 bloques (solapamiento con Mañana en 13:00-14:30)
// Noche:  18:15 – 22:45 → 6 bloques
// NOTA: El solapamiento Mañana/Tarde (13:00, 13:45) permite que docentes con
// disponibilidad en ambos turnos puedan dictar en ese rango.
export const TURNOS_SLOTS: Record<Turno, string[]> = {
  "Mañana": ["07:45", "08:30", "09:15", "10:00", "10:45", "11:30", "12:15", "13:00", "13:45"],
  "Tarde": ["13:00", "13:45", "14:30", "15:15", "16:00", "16:45", "17:30"],
  "Noche": ["18:15", "19:00", "19:45", "20:30", "21:15", "22:00"],
};

export const DIAS: Dia[] = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export const ESCUELAS: Record<number, string> = {
  1: "EIT",
  2: "EI",
  3: "EGT",
  4: "EAN",
};

// ─── DATA MODELS ────────────────────────────────────────────────────────────

export interface Docente {
  id: number;
  ci: string;
  nombre: string;
  profesion?: string;
  telefono?: string;
  disponibilidad: DisponibilidadSlot[];
  materiasHabilitadas: MateriaHabilitada[];
}

export interface DisponibilidadSlot {
  dia: Dia;
  slot: string;
}

export interface MateriaHabilitada {
  sigla: string;
  nombreMateria?: string;
  carrera?: string;
}

export interface MateriaCatalogo {
  id: number;
  escuela: number;
  carrera: string;
  resolucionMinisterial?: string;
  nombreAsignatura: string;
  codigo: string;
  grupoCodigo: string;
  turno: Turno;
  proyeccionInscritos: number;
  horasPorSemana: number;
  semestre: string;
  tipoAula: TipoEspacio | null;
  gestion?: string;
}

export interface Espacio {
  id: number;
  codigo: string;
  tipo: TipoEspacio;
  aforo: number;
  escuela: number;
}

export interface ReservaExterna {
  espacioId: number;
  espacioCodigo: string;
  dia: Dia;
  slot: string;
}

// ─── SCHEDULER TYPES ────────────────────────────────────────────────────────

export interface SchedulerConfig {
  maxPerSesionTaller: number;      // 4-8 periodos
  maxPerSesionLab: number;         // 4-8 periodos
  maxBacktrack: number;            // max permutations total
  permitirAIR: boolean;
  permitirSinDocente: boolean;
  sabadoManana: boolean;
  sabadoTarde: boolean;
  sabadoNoche: boolean;
  docentesPrioritarios: string[];  // CIs
  carrerasAProgramar: string[];    // empty = all
  distribucionNoContigua: boolean;
}

export const DEFAULT_CONFIG: SchedulerConfig = {
  maxPerSesionTaller: 6,
  maxPerSesionLab: 6,
  maxBacktrack: 200,
  permitirAIR: true,
  permitirSinDocente: true,
  sabadoManana: false,
  sabadoTarde: false,
  sabadoNoche: false,
  docentesPrioritarios: [],
  carrerasAProgramar: [],
  distribucionNoContigua: true,
};

export interface UnidadTrabajo {
  materia: MateriaCatalogo;
  sesiones: number[];           // Array of block counts per session [3,2]
  dificultad: number;
  esPrioritaria: boolean;
  grupoKey: string;             // carrera|semestre|codigo|grupo unique key
}

export interface Ventana {
  slots: string[];              // Consecutive slot strings
  inicio: number;               // Start index in SLOTS array
}

export interface Asignacion {
  materiaCodigo: string;
  materiaNombre: string;
  grupoCodigo: string;
  carrera: string;
  semestre: string;
  docenteId: number | null;
  docenteNombre: string;
  espacioId: number | null;
  espacioCodigo: string;
  dia: Dia;
  slots: string[];
  turno: Turno;
  tipoEspacio: TipoEspacio | null;
  esAIR: boolean;
  esSinDocente: boolean;
  sesionIndex: number;
}

export interface Conflicto {
  materiaCodigo: string;
  materiaNombre: string;
  grupoCodigo: string;
  carrera?: string;
  semestre?: string;
  sesionIndex: number;
  motivo: string;
}

export interface SchedulerResult {
  asignaciones: Asignacion[];
  conflictos: Conflicto[];
  totalAsignadas: number;
  totalConflictos: number;
  totalAIR: number;
  totalSinDocente: number;
  duracionMs: number;
  log: string[];
}

// ─── AI TYPES ───────────────────────────────────────────────────────────────

export type AIProvider = "nvidia" | "openai" | "ollama";

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  model: string;
  tokensUsed?: number;
}
