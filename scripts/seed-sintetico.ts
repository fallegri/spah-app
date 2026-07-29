/**
 * Script para generar datos sintéticos realistas para probar el scheduler SPAH.
 * 
 * Genera:
 * - 8 docentes con disponibilidad variada
 * - 15 materias distribuidas en 3 semestres de 2 carreras
 * - 6 espacios (3 aulas, 2 laboratorios, 1 taller)
 * - Habilitaciones docente-materia realistas
 * 
 * Uso: npx tsx scripts/seed-sintetico.ts
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connection = neon(process.env.DATABASE_URL!);
const db = drizzle(connection, { schema });

const GESTION = "2026-II";

// ─── DATOS SINTÉTICOS ───────────────────────────────────────────────────────

const DOCENTES = [
  { ci: "1001001LP", nombre: "Garcia Mendez Juan Carlos", profesion: "Ingeniero de Sistemas", telefono: "71100001" },
  { ci: "1001002LP", nombre: "Lopez Quispe Maria Elena", profesion: "Licenciada en Informatica", telefono: "71100002" },
  { ci: "1001003LP", nombre: "Mamani Rojas Pedro", profesion: "Ingeniero de Sistemas", telefono: "71100003" },
  { ci: "1001004LP", nombre: "Condori Flores Ana", profesion: "Ingeniera Industrial", telefono: "71100004" },
  { ci: "1001005LP", nombre: "Quisbert Huanca Roberto", profesion: "Licenciado en Matematicas", telefono: "71100005" },
  { ci: "1001006LP", nombre: "Fernandez Camacho Lucia", profesion: "Ingeniera de Sistemas", telefono: "71100006" },
  { ci: "1001007LP", nombre: "Choque Vargas Daniel", profesion: "Licenciado en Fisica", telefono: "71100007" },
  { ci: "1001008LP", nombre: "Torrez Gutierrez Sandra", profesion: "Ingeniera Electronica", telefono: "71100008" },
];

const ESPACIOS = [
  { codigo: "A101", tipo: "AULA" as const, aforo: 40, escuela: 1 },
  { codigo: "A102", tipo: "AULA" as const, aforo: 35, escuela: 1 },
  { codigo: "A103", tipo: "AULA" as const, aforo: 45, escuela: 1 },
  { codigo: "LAB301", tipo: "LABORATORIO" as const, aforo: 25, escuela: 1 },
  { codigo: "LAB302", tipo: "LABORATORIO" as const, aforo: 30, escuela: 1 },
  { codigo: "TALLER01", tipo: "TALLER" as const, aforo: 20, escuela: 1 },
];

// Catálogo: 2 carreras, 3 semestres cada una, materias con grupos paralelos
const CATALOGO: Array<{
  escuela: number; carrera: string; nombreAsignatura: string; codigo: string;
  grupoCodigo: string; turno: "Mañana" | "Tarde" | "Noche";
  proyeccionInscritos: number; horasPorSemana: number; semestre: string;
  tipoAula: "AULA" | "LABORATORIO" | "TALLER";
}> = [
  // ═══ INGENIERIA DE SISTEMAS ═══
  // PRIMER semestre - Grupo 1AM
  { escuela: 1, carrera: "INGENIERIA DE SISTEMAS", nombreAsignatura: "MATEMATICA I", codigo: "MAT100",
    grupoCodigo: "1AM", turno: "Mañana", proyeccionInscritos: 30, horasPorSemana: 5, semestre: "PRIMERO", tipoAula: "AULA" },
  { escuela: 1, carrera: "INGENIERIA DE SISTEMAS", nombreAsignatura: "INTRODUCCION A LA PROGRAMACION", codigo: "PRG100",
    grupoCodigo: "1AM", turno: "Mañana", proyeccionInscritos: 30, horasPorSemana: 4, semestre: "PRIMERO", tipoAula: "LABORATORIO" },
  { escuela: 1, carrera: "INGENIERIA DE SISTEMAS", nombreAsignatura: "FISICA I", codigo: "FIS100",
    grupoCodigo: "1AM", turno: "Mañana", proyeccionInscritos: 30, horasPorSemana: 4, semestre: "PRIMERO", tipoAula: "AULA" },
  { escuela: 1, carrera: "INGENIERIA DE SISTEMAS", nombreAsignatura: "INGLES BASICO", codigo: "ING100",
    grupoCodigo: "1AM", turno: "Mañana", proyeccionInscritos: 30, horasPorSemana: 3, semestre: "PRIMERO", tipoAula: "AULA" },

  // SEGUNDO semestre - Grupo 2AM
  { escuela: 1, carrera: "INGENIERIA DE SISTEMAS", nombreAsignatura: "MATEMATICA II", codigo: "MAT200",
    grupoCodigo: "2AM", turno: "Mañana", proyeccionInscritos: 25, horasPorSemana: 5, semestre: "SEGUNDO", tipoAula: "AULA" },
  { escuela: 1, carrera: "INGENIERIA DE SISTEMAS", nombreAsignatura: "PROGRAMACION ORIENTADA A OBJETOS", codigo: "PRG200",
    grupoCodigo: "2AM", turno: "Mañana", proyeccionInscritos: 25, horasPorSemana: 5, semestre: "SEGUNDO", tipoAula: "LABORATORIO" },
  { escuela: 1, carrera: "INGENIERIA DE SISTEMAS", nombreAsignatura: "BASES DE DATOS I", codigo: "BDD200",
    grupoCodigo: "2AM", turno: "Mañana", proyeccionInscritos: 25, horasPorSemana: 4, semestre: "SEGUNDO", tipoAula: "LABORATORIO" },
  { escuela: 1, carrera: "INGENIERIA DE SISTEMAS", nombreAsignatura: "ESTADISTICA", codigo: "EST200",
    grupoCodigo: "2AM", turno: "Mañana", proyeccionInscritos: 25, horasPorSemana: 3, semestre: "SEGUNDO", tipoAula: "AULA" },

  // TERCER semestre - Grupo 3AM
  { escuela: 1, carrera: "INGENIERIA DE SISTEMAS", nombreAsignatura: "ESTRUCTURA DE DATOS", codigo: "EDD300",
    grupoCodigo: "3AM", turno: "Mañana", proyeccionInscritos: 20, horasPorSemana: 5, semestre: "TERCERO", tipoAula: "LABORATORIO" },
  { escuela: 1, carrera: "INGENIERIA DE SISTEMAS", nombreAsignatura: "REDES DE COMPUTADORAS", codigo: "RED300",
    grupoCodigo: "3AM", turno: "Mañana", proyeccionInscritos: 20, horasPorSemana: 4, semestre: "TERCERO", tipoAula: "LABORATORIO" },
  { escuela: 1, carrera: "INGENIERIA DE SISTEMAS", nombreAsignatura: "INGENIERIA DE SOFTWARE I", codigo: "ISW300",
    grupoCodigo: "3AM", turno: "Mañana", proyeccionInscritos: 20, horasPorSemana: 4, semestre: "TERCERO", tipoAula: "AULA" },

  // ═══ DISEÑO GRAFICO ═══
  // PRIMER semestre - Grupo 1AT
  { escuela: 1, carrera: "DISENO GRAFICO", nombreAsignatura: "DIBUJO TECNICO", codigo: "DIB100",
    grupoCodigo: "1AT", turno: "Tarde", proyeccionInscritos: 18, horasPorSemana: 4, semestre: "PRIMERO", tipoAula: "TALLER" },
  { escuela: 1, carrera: "DISENO GRAFICO", nombreAsignatura: "TEORIA DEL COLOR", codigo: "COL100",
    grupoCodigo: "1AT", turno: "Tarde", proyeccionInscritos: 18, horasPorSemana: 3, semestre: "PRIMERO", tipoAula: "AULA" },
  { escuela: 1, carrera: "DISENO GRAFICO", nombreAsignatura: "FOTOGRAFIA DIGITAL", codigo: "FOT100",
    grupoCodigo: "1AT", turno: "Tarde", proyeccionInscritos: 18, horasPorSemana: 4, semestre: "PRIMERO", tipoAula: "LABORATORIO" },
  { escuela: 1, carrera: "DISENO GRAFICO", nombreAsignatura: "HISTORIA DEL ARTE", codigo: "ART100",
    grupoCodigo: "1AT", turno: "Tarde", proyeccionInscritos: 18, horasPorSemana: 2, semestre: "PRIMERO", tipoAula: "AULA" },
];

// Habilitaciones: qué docente puede dictar qué materia
const HABILITACIONES: Array<{ docenteIdx: number; sigla: string; nombre: string; carrera: string }> = [
  // Garcia - Matemáticas y Estadística
  { docenteIdx: 0, sigla: "MAT100", nombre: "MATEMATICA I", carrera: "INGENIERIA DE SISTEMAS" },
  { docenteIdx: 0, sigla: "MAT200", nombre: "MATEMATICA II", carrera: "INGENIERIA DE SISTEMAS" },
  { docenteIdx: 0, sigla: "EST200", nombre: "ESTADISTICA", carrera: "INGENIERIA DE SISTEMAS" },
  // Lopez - Programación
  { docenteIdx: 1, sigla: "PRG100", nombre: "INTRODUCCION A LA PROGRAMACION", carrera: "INGENIERIA DE SISTEMAS" },
  { docenteIdx: 1, sigla: "PRG200", nombre: "PROGRAMACION ORIENTADA A OBJETOS", carrera: "INGENIERIA DE SISTEMAS" },
  { docenteIdx: 1, sigla: "EDD300", nombre: "ESTRUCTURA DE DATOS", carrera: "INGENIERIA DE SISTEMAS" },
  // Mamani - Bases de datos y Redes
  { docenteIdx: 2, sigla: "BDD200", nombre: "BASES DE DATOS I", carrera: "INGENIERIA DE SISTEMAS" },
  { docenteIdx: 2, sigla: "RED300", nombre: "REDES DE COMPUTADORAS", carrera: "INGENIERIA DE SISTEMAS" },
  // Condori - Ingeniería de Software
  { docenteIdx: 3, sigla: "ISW300", nombre: "INGENIERIA DE SOFTWARE I", carrera: "INGENIERIA DE SISTEMAS" },
  { docenteIdx: 3, sigla: "ING100", nombre: "INGLES BASICO", carrera: "INGENIERIA DE SISTEMAS" },
  // Quisbert - Física y Matemáticas (respaldo)
  { docenteIdx: 4, sigla: "FIS100", nombre: "FISICA I", carrera: "INGENIERIA DE SISTEMAS" },
  { docenteIdx: 4, sigla: "MAT100", nombre: "MATEMATICA I", carrera: "INGENIERIA DE SISTEMAS" },
  // Fernandez - Diseño Gráfico
  { docenteIdx: 5, sigla: "DIB100", nombre: "DIBUJO TECNICO", carrera: "DISENO GRAFICO" },
  { docenteIdx: 5, sigla: "COL100", nombre: "TEORIA DEL COLOR", carrera: "DISENO GRAFICO" },
  // Choque - Fotografía y Arte
  { docenteIdx: 6, sigla: "FOT100", nombre: "FOTOGRAFIA DIGITAL", carrera: "DISENO GRAFICO" },
  { docenteIdx: 6, sigla: "ART100", nombre: "HISTORIA DEL ARTE", carrera: "DISENO GRAFICO" },
  // Torrez - Respaldo Programación/Redes
  { docenteIdx: 7, sigla: "PRG100", nombre: "INTRODUCCION A LA PROGRAMACION", carrera: "INGENIERIA DE SISTEMAS" },
  { docenteIdx: 7, sigla: "RED300", nombre: "REDES DE COMPUTADORAS", carrera: "INGENIERIA DE SISTEMAS" },
];

// Disponibilidad por docente (índice → slots disponibles)
// Cada docente tiene diferentes patrones para forzar complejidad al scheduler
type DiaType = "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes";
const DIAS_HABILES: DiaType[] = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

const SLOTS_MANANA = ["07:45", "08:30", "09:15", "10:00", "10:45", "11:30", "12:15", "13:00", "13:45"];
const SLOTS_TARDE = ["13:00", "13:45", "14:30", "15:15", "16:00", "16:45", "17:30"];

// Disponibilidad patterns: which days and slots each docente has
const DISPONIBILIDAD_PATTERNS: Array<{ dias: DiaType[]; slots: string[] }> = [
  // Garcia: L-M-Mi-J mañana completa
  { dias: ["Lunes", "Martes", "Miércoles", "Jueves"], slots: SLOTS_MANANA },
  // Lopez: L-Mi-V mañana completa
  { dias: ["Lunes", "Miércoles", "Viernes"], slots: SLOTS_MANANA },
  // Mamani: L-Ma-Mi-J-V mañana parcial (primeras 6h)
  { dias: DIAS_HABILES, slots: SLOTS_MANANA.slice(0, 7) },
  // Condori: L-Ma-Mi-J mañana
  { dias: ["Lunes", "Martes", "Miércoles", "Jueves"], slots: SLOTS_MANANA.slice(0, 7) },
  // Quisbert: L-Mi-V mañana completa
  { dias: ["Lunes", "Miércoles", "Viernes"], slots: SLOTS_MANANA },
  // Fernandez: L-Ma-Mi-J-V tarde completa
  { dias: DIAS_HABILES, slots: SLOTS_TARDE },
  // Choque: Ma-J-V tarde
  { dias: ["Martes", "Jueves", "Viernes"], slots: SLOTS_TARDE },
  // Torrez: L-Ma-Mi mañana
  { dias: ["Lunes", "Martes", "Miércoles"], slots: SLOTS_MANANA.slice(0, 7) },
];

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== SEED DATOS SINTETICOS SPAH ===\n");
  console.log(`Gestión: ${GESTION}\n`);

  // 1. Insertar docentes
  console.log("[1/5] Insertando docentes...");
  const docenteIds: number[] = [];
  for (const d of DOCENTES) {
    const [inserted] = await db.insert(schema.docentes).values({
      ci: d.ci,
      nombre: d.nombre,
      profesion: d.profesion,
      telefono: d.telefono,
      gestion: GESTION,
    }).onConflictDoNothing().returning();
    if (inserted) {
      docenteIds.push(inserted.id);
      console.log(`  + ${d.nombre} (id: ${inserted.id})`);
    } else {
      // If already exists, find the ID
      const existing = await db.select({ id: schema.docentes.id })
        .from(schema.docentes)
        .where(eq(schema.docentes.ci, d.ci));
      docenteIds.push(existing[0]?.id ?? 0);
      console.log(`  ~ ${d.nombre} (ya existía)`);
    }
  }

  // 2. Insertar disponibilidad
  console.log("\n[2/5] Insertando disponibilidad...");
  let totalSlots = 0;
  for (let i = 0; i < docenteIds.length; i++) {
    const docenteId = docenteIds[i];
    if (!docenteId) continue;
    const pattern = DISPONIBILIDAD_PATTERNS[i];
    for (const dia of pattern.dias) {
      for (const slot of pattern.slots) {
        await db.insert(schema.disponibilidadDocente).values({
          docenteId,
          dia: dia as any,
          slot,
          gestion: GESTION,
        }).onConflictDoNothing();
        totalSlots++;
      }
    }
  }
  console.log(`  ${totalSlots} slots de disponibilidad insertados`);

  // 3. Insertar habilitaciones
  console.log("\n[3/5] Insertando habilitaciones docente-materia...");
  for (const h of HABILITACIONES) {
    const docenteId = docenteIds[h.docenteIdx];
    if (!docenteId) continue;
    await db.insert(schema.materiasHabilitadas).values({
      docenteId,
      sigla: h.sigla,
      nombreMateria: h.nombre,
      carrera: h.carrera,
    }).onConflictDoNothing();
  }
  console.log(`  ${HABILITACIONES.length} habilitaciones insertadas`);

  // 4. Insertar espacios
  console.log("\n[4/5] Insertando espacios...");
  for (const e of ESPACIOS) {
    await db.insert(schema.espacios).values(e).onConflictDoNothing();
    console.log(`  + ${e.codigo} (${e.tipo}, aforo: ${e.aforo})`);
  }

  // 5. Insertar catálogo de materias
  console.log("\n[5/5] Insertando catálogo de materias...");
  for (const m of CATALOGO) {
    await db.insert(schema.materiasCatalogo).values({
      ...m,
      gestion: GESTION,
    }).onConflictDoNothing();
    console.log(`  + ${m.codigo} ${m.nombreAsignatura} (${m.grupoCodigo}, ${m.turno}, ${m.horasPorSemana}h/sem)`);
  }

  // Resumen
  console.log("\n=== SEED COMPLETADO ===");
  console.log(`
Resumen:
  Docentes:        ${DOCENTES.length}
  Espacios:        ${ESPACIOS.length} (${ESPACIOS.filter(e=>e.tipo==="AULA").length} aulas, ${ESPACIOS.filter(e=>e.tipo==="LABORATORIO").length} labs, ${ESPACIOS.filter(e=>e.tipo==="TALLER").length} talleres)
  Materias:        ${CATALOGO.length}
  Habilitaciones:  ${HABILITACIONES.length}
  Gestión:         ${GESTION}

Carreras:
  - INGENIERIA DE SISTEMAS (3 semestres: PRIMERO 1AM, SEGUNDO 2AM, TERCERO 3AM)
  - DISENO GRAFICO (1 semestre: PRIMERO 1AT, turno Tarde)

Horas semanales totales:
  - 1AM (Sist. Primero):  ${CATALOGO.filter(m=>m.grupoCodigo==="1AM").reduce((s,m)=>s+m.horasPorSemana,0)}h
  - 2AM (Sist. Segundo):  ${CATALOGO.filter(m=>m.grupoCodigo==="2AM").reduce((s,m)=>s+m.horasPorSemana,0)}h
  - 3AM (Sist. Tercero):  ${CATALOGO.filter(m=>m.grupoCodigo==="3AM").reduce((s,m)=>s+m.horasPorSemana,0)}h
  - 1AT (Diseño Primero): ${CATALOGO.filter(m=>m.grupoCodigo==="1AT").reduce((s,m)=>s+m.horasPorSemana,0)}h

Para ejecutar el scheduler, use la interfaz web o:
  curl -X POST http://localhost:3000/api/scheduler/run \\
    -H "Content-Type: application/json" \\
    -d '{"gestion":"${GESTION}","config":{}}'
`);
}

main().catch((err) => {
  console.error("Error durante el seed:", err);
  process.exit(1);
});
