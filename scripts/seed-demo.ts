/**
 * Script to seed demo data for testing.
 * Run: npx tsx scripts/seed-demo.ts
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import bcrypt from "bcryptjs";
import * as schema from "../src/db/schema";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
  console.log("Seeding demo data...\n");

  // 1. Create admin user
  const passwordHash = await bcrypt.hash("admin123", 12);
  await db.insert(schema.usuarios).values({
    email: "admin@spah.edu",
    nombre: "Administrador SPAH",
    passwordHash,
    rol: "administrador",
    activo: true,
  }).onConflictDoNothing();
  console.log("Admin user created: admin@spah.edu / admin123");

  // 2. Create a demo docente
  const [docente] = await db.insert(schema.docentes).values({
    ci: "6362294SC",
    nombre: "Abuawad Lorite Oscar Javier",
    profesion: "Ingeniero de Sistemas",
    telefono: "70012345",
    gestion: "2026-II",
  }).onConflictDoNothing().returning();

  if (docente) {
    // Create docente user
    const docentePwHash = await bcrypt.hash("docente123", 12);
    await db.insert(schema.usuarios).values({
      email: "abuawad@spah.edu",
      nombre: "Abuawad Lorite Oscar Javier",
      passwordHash: docentePwHash,
      rol: "docente",
      docenteId: docente.id,
      activo: true,
    }).onConflictDoNothing();
    console.log("Docente user created: abuawad@spah.edu / docente123");

    // Add some habilitaciones
    const materias = [
      { sigla: "DES210", nombre: "PROGRAMACION ORIENTADA A OBJETOS", carrera: "INGENIERIA DE SISTEMAS" },
      { sigla: "DES421", nombre: "DESARROLLO DE APLICACIONES WEB I", carrera: "INGENIERIA DE SISTEMAS" },
      { sigla: "ITEL200", nombre: "SEGURIDAD INFORMATICA", carrera: "INGENIERIA DE SISTEMAS" },
      { sigla: "PWD2011", nombre: "PROTOTIPADO WEB", carrera: "DISENO GRAFICO" },
      { sigla: "TPD4011", nombre: "TALLER PRODUCCION DIGITAL", carrera: "DISENO GRAFICO" },
    ];

    for (const m of materias) {
      await db.insert(schema.materiasHabilitadas).values({
        docenteId: docente.id,
        sigla: m.sigla,
        nombreMateria: m.nombre,
        carrera: m.carrera,
      }).onConflictDoNothing();
    }
    console.log(`  ${materias.length} materias habilitadas`);

    // Add availability (morning Mon-Fri)
    const dias: ("Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes")[] = [
      "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"
    ];
    const slotsManana = ["07:45", "08:30", "09:15", "10:00", "10:45", "11:30", "12:15"];

    for (const dia of dias) {
      for (const slot of slotsManana) {
        await db.insert(schema.disponibilidadDocente).values({
          docenteId: docente.id,
          dia: dia as any,
          slot,
          gestion: "2026-II",
        }).onConflictDoNothing();
      }
    }
    console.log("  Disponibilidad manana L-V agregada");
  }

  // 3. Add some spaces
  const demoEspacios = [
    { codigo: "LAB202", tipo: "LABORATORIO" as const, aforo: 30, escuela: 1 },
    { codigo: "LAB203", tipo: "LABORATORIO" as const, aforo: 40, escuela: 1 },
    { codigo: "B201", tipo: "AULA" as const, aforo: 46, escuela: 1 },
    { codigo: "B202", tipo: "AULA" as const, aforo: 46, escuela: 1 },
    { codigo: "TALLER 1 DG B206", tipo: "TALLER" as const, aforo: 28, escuela: 1 },
  ];

  for (const e of demoEspacios) {
    await db.insert(schema.espacios).values(e).onConflictDoNothing();
  }
  console.log(`${demoEspacios.length} espacios creados`);

  // 4. Add some catalog entries
  const demoCatalogo = [
    {
      escuela: 1, carrera: "INGENIERIA DE SISTEMAS", resolucionMinisterial: "2570/2017",
      nombreAsignatura: "PROGRAMACION ORIENTADA A OBJETOS", codigo: "DES210",
      grupoCodigo: "2AM", turno: "Mañana" as const, proyeccionInscritos: 22,
      horasPorSemana: 5, semestre: "SEGUNDO", tipoAula: "LABORATORIO" as const, gestion: "2026-II",
    },
    {
      escuela: 1, carrera: "INGENIERIA DE SISTEMAS", resolucionMinisterial: "2570/2017",
      nombreAsignatura: "DESARROLLO DE APLICACIONES WEB I", codigo: "DES421",
      grupoCodigo: "4AM", turno: "Mañana" as const, proyeccionInscritos: 8,
      horasPorSemana: 5, semestre: "CUARTO", tipoAula: "LABORATORIO" as const, gestion: "2026-II",
    },
    {
      escuela: 1, carrera: "INGENIERIA DE SISTEMAS", resolucionMinisterial: "2570/2017",
      nombreAsignatura: "SEGURIDAD INFORMATICA", codigo: "ITEL200",
      grupoCodigo: "6AN", turno: "Noche" as const, proyeccionInscritos: 8,
      horasPorSemana: 5, semestre: "SEXTO", tipoAula: "LABORATORIO" as const, gestion: "2026-II",
    },
  ];

  for (const m of demoCatalogo) {
    await db.insert(schema.materiasCatalogo).values(m).onConflictDoNothing();
  }
  console.log(`${demoCatalogo.length} materias de catalogo creadas`);

  console.log("\n=== Seed completado ===");
}

main().catch(console.error);
