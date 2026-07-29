/**
 * Genera datos sintéticos masivos para probar el scheduler SPAH.
 * 10 carreras × 9 semestres × 6 materias = 540 materias
 * 60 docentes con disponibilidad variada
 * 30 espacios distribuidos entre 4 escuelas
 *
 * Uso: npx tsx scripts/seed-masivo.ts
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const GESTION = "2026-II";

// ═══ CARRERAS (10 carreras en 4 escuelas) ═══
const CARRERAS = [
  // Escuela 1: EIT (Ingeniería y Tecnología)
  { escuela: 1, nombre: "INGENIERIA DE SISTEMAS", turno: "Mañana" as const, grupo: "AM" },
  { escuela: 1, nombre: "INGENIERIA ELECTRONICA", turno: "Noche" as const, grupo: "AN" },
  { escuela: 1, nombre: "INGENIERIA INDUSTRIAL", turno: "Mañana" as const, grupo: "BM" },
  // Escuela 2: EI (Empresa e Innovación)
  { escuela: 2, nombre: "ADMINISTRACION DE EMPRESAS", turno: "Tarde" as const, grupo: "AT" },
  { escuela: 2, nombre: "CONTADURIA PUBLICA", turno: "Noche" as const, grupo: "AN" },
  { escuela: 2, nombre: "MARKETING Y PUBLICIDAD", turno: "Tarde" as const, grupo: "BT" },
  // Escuela 3: EGT (Diseño y Comunicación)
  { escuela: 3, nombre: "DISENO GRAFICO", turno: "Tarde" as const, grupo: "AT" },
  { escuela: 3, nombre: "COMUNICACION SOCIAL", turno: "Mañana" as const, grupo: "AM" },
  // Escuela 4: EAN (Arquitectura y Naturaleza)
  { escuela: 4, nombre: "ARQUITECTURA", turno: "Mañana" as const, grupo: "AM" },
  { escuela: 4, nombre: "INGENIERIA AMBIENTAL", turno: "Noche" as const, grupo: "BN" },
];

// ═══ MATERIAS POR SEMESTRE (plantilla genérica por escuela) ═══
const MATERIAS_TEMPLATE: Record<number, string[][]> = {
  1: [ // EIT
    ["MATEMATICA I","FISICA I","INTRODUCCION A LA PROGRAMACION","ALGEBRA LINEAL","QUIMICA GENERAL","INGLES TECNICO I"],
    ["MATEMATICA II","FISICA II","PROGRAMACION ORIENTADA A OBJETOS","ESTADISTICA","DIBUJO TECNICO","INGLES TECNICO II"],
    ["MATEMATICA III","ELECTRONICA BASICA","ESTRUCTURA DE DATOS","BASES DE DATOS I","REDES I","METODOLOGIA DE INVESTIGACION"],
    ["ECUACIONES DIFERENCIALES","SISTEMAS OPERATIVOS","BASES DE DATOS II","REDES II","INGENIERIA DE SOFTWARE I","ECONOMIA"],
    ["INVESTIGACION OPERATIVA","ARQUITECTURA DE COMPUTADORES","INGENIERIA DE SOFTWARE II","SEGURIDAD INFORMATICA","GESTION DE PROYECTOS","DERECHO INFORMATICO"],
    ["INTELIGENCIA ARTIFICIAL","COMPILADORES","DESARROLLO WEB","SISTEMAS DISTRIBUIDOS","AUDITORIA DE SISTEMAS","TALLER DE GRADO I"],
    ["MACHINE LEARNING","COMPUTACION EN LA NUBE","DESARROLLO MOVIL","IOT Y SISTEMAS EMBEBIDOS","GOBIERNO TI","TALLER DE GRADO II"],
    ["BIG DATA","BLOCKCHAIN","CIBERSEGURIDAD AVANZADA","DEVOPS","EMPRENDIMIENTO TECNOLOGICO","PRACTICA PROFESIONAL I"],
    ["PROYECTO FINAL","INNOVACION TECNOLOGICA","LIDERAZGO Y GESTION","ETICA PROFESIONAL","SEMINARIO DE TENDENCIAS","PRACTICA PROFESIONAL II"],
  ],
  2: [ // EI
    ["MATEMATICA FINANCIERA","MICROECONOMIA","CONTABILIDAD BASICA","ADMINISTRACION I","DERECHO COMERCIAL","COMUNICACION EMPRESARIAL"],
    ["ESTADISTICA EMPRESARIAL","MACROECONOMIA","CONTABILIDAD INTERMEDIA","ADMINISTRACION II","DERECHO LABORAL","INGLES DE NEGOCIOS I"],
    ["INVESTIGACION DE MERCADOS","FINANZAS I","COSTOS Y PRESUPUESTOS","RECURSOS HUMANOS","COMERCIO INTERNACIONAL","INGLES DE NEGOCIOS II"],
    ["MARKETING ESTRATEGICO","FINANZAS II","AUDITORIA I","GESTION DE OPERACIONES","LEGISLACION TRIBUTARIA","PLAN DE NEGOCIOS"],
    ["MARKETING DIGITAL","MERCADO DE VALORES","AUDITORIA II","LOGISTICA","TRIBUTACION AVANZADA","SEMINARIO I"],
    ["COMPORTAMIENTO ORGANIZACIONAL","BANCA Y SEGUROS","AUDITORIA FORENSE","CALIDAD TOTAL","COMERCIO ELECTRONICO","SEMINARIO II"],
    ["GESTION DEL TALENTO","EVALUACION DE PROYECTOS","CONTABILIDAD GUBERNAMENTAL","NEGOCIOS INTERNACIONALES","RESPONSABILIDAD SOCIAL","TALLER DE GRADO I"],
    ["CONSULTORIA EMPRESARIAL","FINANZAS CORPORATIVAS","NORMAS INTERNACIONALES","ESTRATEGIA EMPRESARIAL","INNOVACION","PRACTICA EMPRESARIAL I"],
    ["PROYECTO EMPRESARIAL","SIMULACION DE NEGOCIOS","GOBIERNO CORPORATIVO","LIDERAZGO","ETICA EMPRESARIAL","PRACTICA EMPRESARIAL II"],
  ],
  3: [ // EGT
    ["DIBUJO ARTISTICO I","TEORIA DEL COLOR","HISTORIA DEL ARTE","FOTOGRAFIA I","TIPOGRAFIA","SEMIOTICA"],
    ["DIBUJO ARTISTICO II","COMPOSICION VISUAL","HISTORIA DEL DISENO","FOTOGRAFIA II","DISENO EDITORIAL","REDACCION CREATIVA"],
    ["ILUSTRACION DIGITAL","DISENO DE IDENTIDAD","PRODUCCION AUDIOVISUAL","ANIMACION I","DISENO WEB I","INVESTIGACION EN DISENO"],
    ["PACKAGING","BRANDING","PRODUCCION MULTIMEDIA","ANIMACION II","DISENO WEB II","GESTION CULTURAL"],
    ["DISENO PUBLICITARIO","SENALETICA","POSTPRODUCCION","ANIMACION 3D","UX/UI DESIGN","MARKETING CREATIVO"],
    ["DISENO EDITORIAL AVANZADO","DISENO DE EXPERIENCIAS","PRODUCCION TV","MOTION GRAPHICS","APP DESIGN","TALLER CREATIVO I"],
    ["DIRECCION DE ARTE","DISENO SOCIAL","DOCUMENTAL","REALIDAD VIRTUAL","DISENO DE SERVICIOS","TALLER CREATIVO II"],
    ["PORTAFOLIO PROFESIONAL","GESTION DE DISENO","PERIODISMO DIGITAL","TRANSMEDIA","INNOVACION CREATIVA","PRACTICA CREATIVA I"],
    ["PROYECTO DE GRADO","EMPRENDIMIENTO CREATIVO","CRITICA DE MEDIOS","TENDENCIAS DIGITALES","ETICA EN COMUNICACION","PRACTICA CREATIVA II"],
  ],
  4: [ // EAN
    ["MATEMATICA PARA ARQUITECTURA","DIBUJO ARQUITECTONICO I","HISTORIA DE LA ARQUITECTURA I","GEOMETRIA DESCRIPTIVA","TALLER DE DISENO I","ECOLOGIA"],
    ["FISICA APLICADA","DIBUJO ARQUITECTONICO II","HISTORIA DE LA ARQUITECTURA II","TOPOGRAFIA","TALLER DE DISENO II","BIOLOGIA AMBIENTAL"],
    ["RESISTENCIA DE MATERIALES","AUTOCAD Y BIM","URBANISMO I","INSTALACIONES I","TALLER DE DISENO III","QUIMICA AMBIENTAL"],
    ["ESTRUCTURAS I","MODELADO 3D","URBANISMO II","INSTALACIONES II","TALLER DE DISENO IV","GESTION AMBIENTAL"],
    ["ESTRUCTURAS II","RENDER Y VISUALIZACION","PLANIFICACION TERRITORIAL","CONSTRUCCION I","TALLER DE DISENO V","IMPACTO AMBIENTAL"],
    ["PRESUPUESTO DE OBRA","PAISAJISMO","RESTAURACION","CONSTRUCCION II","TALLER DE DISENO VI","LEGISLACION AMBIENTAL"],
    ["GERENCIA DE PROYECTOS","DISENO SOSTENIBLE","PATRIMONIO","TECNOLOGIA DE MATERIALES","TALLER DE DISENO VII","ENERGIAS RENOVABLES"],
    ["GESTION INMOBILIARIA","DISENO PARAMETRICO","VIVIENDA SOCIAL","SUPERVISION DE OBRA","TALLER DE GRADO","PRACTICA AMBIENTAL I"],
    ["PROYECTO ARQUITECTONICO","INNOVACION CONSTRUCTIVA","CIUDAD Y TERRITORIO","PERITAJE","ETICA PROFESIONAL","PRACTICA AMBIENTAL II"],
  ],
};

// ═══ TIPOS DE AULA POR MATERIA (heurística por nombre) ═══
function getTipoAula(nombre: string, escuela: number): "AULA" | "LABORATORIO" | "TALLER" {
  const n = nombre.toUpperCase();
  if (n.includes("TALLER") || n.includes("DIBUJO") || n.includes("ILUSTRACION") || n.includes("PACKAGING")) return "TALLER";
  if (n.includes("PROGRAMACION") || n.includes("BASE") || n.includes("RED") || n.includes("WEB") ||
      n.includes("DESARROLLO") || n.includes("AUTOCAD") || n.includes("BIM") || n.includes("MODELADO") ||
      n.includes("RENDER") || n.includes("LABORATORIO") || n.includes("COMPUTADOR") || n.includes("ANIMACION") ||
      n.includes("DIGITAL") || n.includes("MOBILE") || n.includes("CLOUD") || n.includes("IOT") ||
      n.includes("MACHINE") || n.includes("BIG DATA") || n.includes("BLOCKCHAIN") || n.includes("DEVOPS") ||
      n.includes("FOTOGRAFIA") || n.includes("PRODUCCION") || n.includes("APP DESIGN") || n.includes("UX")) return "LABORATORIO";
  return "AULA";
}

function getHoras(nombre: string, tipo: string): number {
  if (nombre.includes("PRACTICA") || nombre.includes("PASANTIA")) return 3;
  if (tipo === "LABORATORIO") return 5;
  if (tipo === "TALLER") return 4;
  // Teóricas: variar entre 3 y 5
  const hash = nombre.length % 3;
  return hash === 0 ? 3 : hash === 1 ? 4 : 5;
}

// ═══ ESPACIOS (30 distribuidos entre 4 escuelas) ═══
function generarEspacios() {
  const espacios: Array<{ codigo: string; tipo: "AULA" | "LABORATORIO" | "TALLER"; aforo: number; escuela: number }> = [];
  for (let esc = 1; esc <= 4; esc++) {
    // 3 aulas por escuela
    for (let i = 1; i <= 3; i++) {
      espacios.push({ codigo: `A${esc}0${i}`, tipo: "AULA", aforo: 35 + (i * 5), escuela: esc });
    }
    // 2 laboratorios por escuela
    for (let i = 1; i <= 2; i++) {
      espacios.push({ codigo: `LAB${esc}0${i}`, tipo: "LABORATORIO", aforo: 25 + (i * 5), escuela: esc });
    }
    // 1-2 talleres por escuela
    espacios.push({ codigo: `TAL${esc}01`, tipo: "TALLER", aforo: 20, escuela: esc });
    if (esc === 3 || esc === 4) {
      espacios.push({ codigo: `TAL${esc}02`, tipo: "TALLER", aforo: 25, escuela: esc });
    }
  }
  return espacios;
}

// ═══ DOCENTES (60 docentes, ~6 por carrera) ═══
const NOMBRES = [
  "Garcia","Lopez","Martinez","Rodriguez","Hernandez","Gonzalez","Perez","Sanchez",
  "Ramirez","Torres","Flores","Rivera","Gomez","Diaz","Cruz","Morales",
  "Ortiz","Gutierrez","Chavez","Ramos","Reyes","Ruiz","Mendoza","Aguilar",
  "Medina","Castro","Vargas","Romero","Jimenez","Alvarez","Fernandez","Castillo",
  "Rojas","Herrera","Moreno","Munoz","Nunez","Soto","Vega","Campos",
  "Delgado","Espinoza","Guerrero","Cabrera","Rios","Contreras","Figueroa","Silva",
  "Sandoval","Cortez","Maldonado","Salazar","Navarro","Pena","Cardenas","Pacheco",
  "Fuentes","Valenzuela","Ibarra","Miranda",
];
const APELLIDOS2 = [
  "Quispe","Mamani","Condori","Choque","Huanca","Apaza","Limachi","Callisaya",
  "Ticona","Alanoca","Yujra","Poma","Copa","Nina","Flores","Ramos",
  "Gutierrez","Vargas","Lopez","Cruz","Torrez","Mendez","Rojas","Santos",
  "Molina","Vega","Luna","Siles","Duran","Quiroga","Suarez","Paz",
  "Arce","Belen","Coca","Daza","Echeverria","Franco","Gil","Hurtado",
  "Ibanez","Justiniano","Kuno","Lema","Mena","Navia","Ochoa","Paredes",
  "Quiroz","Rosales","Segovia","Tapia","Uribe","Valencia","Waldo","Zarate",
  "Acha","Borda","Calle","Doria",
];

const SLOTS_MANANA = ["07:45","08:30","09:15","10:00","10:45","11:30","12:15","13:00","13:45"];
const SLOTS_TARDE = ["13:45","14:30","15:15","16:00","16:45","17:30"];
const SLOTS_NOCHE = ["18:15","19:00","19:45","20:30","21:15","22:00"];
type DiaType = "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes";
const DIAS_HABILES: DiaType[] = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

// ═══ MAIN ═══
async function main() {
  console.log("=== SEED MASIVO SPAH ===\n");

  // 1. Espacios
  console.log("[1/4] Insertando espacios...");
  const espaciosData = generarEspacios();
  for (const e of espaciosData) {
    await db.insert(schema.espacios).values(e).onConflictDoNothing();
  }
  console.log(`  ${espaciosData.length} espacios insertados`);

  // 2. Docentes + disponibilidad + habilitaciones
  console.log("\n[2/4] Insertando docentes...");
  const docenteIds: number[] = [];
  const docentesPorEscuela: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [] };

  for (let i = 0; i < 60; i++) {
    const escuela = (i % 4) + 1;
    const ci = `${(5000000 + i * 1111).toString()}LP`;
    const nombre = `${NOMBRES[i]} ${APELLIDOS2[i]}`;

    const [doc] = await db.insert(schema.docentes).values({
      ci, nombre, profesion: "Licenciado/a", telefono: `7${(1000000 + i * 111).toString()}`, gestion: GESTION,
    }).onConflictDoNothing().returning();

    if (doc) {
      docenteIds.push(doc.id);
      docentesPorEscuela[escuela].push(doc.id);

      // Disponibilidad: cada docente tiene 3-4 días disponibles
      const numDias = 3 + (i % 2); // 3 o 4 días
      const diasDisp = DIAS_HABILES.slice(0, numDias);
      // Turno basado en escuela/posición
      const turnoSlots = i % 3 === 0 ? SLOTS_MANANA : i % 3 === 1 ? SLOTS_TARDE : SLOTS_NOCHE;

      for (const dia of diasDisp) {
        for (const slot of turnoSlots) {
          await db.insert(schema.disponibilidadDocente).values({
            docenteId: doc.id, dia: dia as any, slot, gestion: GESTION,
          }).onConflictDoNothing();
        }
      }
    } else {
      const existing = await db.select({ id: schema.docentes.id }).from(schema.docentes).where(eq(schema.docentes.ci, ci));
      if (existing[0]) {
        docenteIds.push(existing[0].id);
        docentesPorEscuela[escuela].push(existing[0].id);
      }
    }
  }
  console.log(`  ${docenteIds.length} docentes insertados`);

  // 3. Catálogo de materias
  console.log("\n[3/4] Insertando catálogo de materias...");
  let totalMaterias = 0;
  const habilitaciones: Array<{ docenteId: number; sigla: string; nombre: string; carrera: string }> = [];

  for (const carrera of CARRERAS) {
    const templateKey = carrera.escuela;
    const semestres = MATERIAS_TEMPLATE[templateKey];
    const semLabels = ["PRIMERO","SEGUNDO","TERCERO","CUARTO","QUINTO","SEXTO","SEPTIMO","OCTAVO","NOVENO"];

    for (let sem = 0; sem < 9; sem++) {
      const materias = semestres[sem];
      for (let m = 0; m < materias.length; m++) {
        const nombreMateria = materias[m];
        const tipoAula = getTipoAula(nombreMateria, carrera.escuela);
        const horas = getHoras(nombreMateria, tipoAula);
        const codigo = `${carrera.nombre.substring(0, 3).toUpperCase()}${(sem + 1)}${String(m + 1).padStart(2, "0")}`;
        const grupoCodigo = `${sem + 1}${carrera.grupo}`;
        const proyeccion = tipoAula === "AULA" ? 30 : tipoAula === "LABORATORIO" ? 22 : 18;

        await db.insert(schema.materiasCatalogo).values({
          escuela: carrera.escuela,
          carrera: carrera.nombre,
          nombreAsignatura: nombreMateria,
          codigo,
          grupoCodigo,
          turno: carrera.turno as any,
          proyeccionInscritos: proyeccion,
          horasPorSemana: horas,
          semestre: semLabels[sem],
          tipoAula: tipoAula as any,
          gestion: GESTION,
        }).onConflictDoNothing();

        totalMaterias++;

        // Asignar 1-2 docentes habilitados para esta materia (de la misma escuela)
        const docentesEsc = docentesPorEscuela[carrera.escuela];
        const docIdx = (sem * 6 + m) % docentesEsc.length;
        habilitaciones.push({
          docenteId: docentesEsc[docIdx],
          sigla: codigo,
          nombre: nombreMateria,
          carrera: carrera.nombre,
        });
        // Segundo docente habilitado (backup)
        if (docentesEsc.length > 1) {
          const docIdx2 = (docIdx + 1) % docentesEsc.length;
          habilitaciones.push({
            docenteId: docentesEsc[docIdx2],
            sigla: codigo,
            nombre: nombreMateria,
            carrera: carrera.nombre,
          });
        }
      }
    }
  }
  console.log(`  ${totalMaterias} materias insertadas`);

  // 4. Habilitaciones
  console.log("\n[4/4] Insertando habilitaciones...");
  for (const h of habilitaciones) {
    await db.insert(schema.materiasHabilitadas).values({
      docenteId: h.docenteId,
      sigla: h.sigla,
      nombreMateria: h.nombre,
      carrera: h.carrera,
    }).onConflictDoNothing();
  }
  console.log(`  ${habilitaciones.length} habilitaciones insertadas`);

  // Resumen
  console.log(`
=== SEED MASIVO COMPLETADO ===
  Carreras:       ${CARRERAS.length}
  Semestres:      9 por carrera
  Materias:       ${totalMaterias} (${CARRERAS.length} × 9 × 6)
  Docentes:       60 (15 por escuela)
  Espacios:       ${espaciosData.length}
  Habilitaciones: ${habilitaciones.length}
  Gestión:        ${GESTION}

  Escuela 1 (EIT): ${CARRERAS.filter(c => c.escuela === 1).map(c => c.nombre).join(", ")}
  Escuela 2 (EI):  ${CARRERAS.filter(c => c.escuela === 2).map(c => c.nombre).join(", ")}
  Escuela 3 (EGT): ${CARRERAS.filter(c => c.escuela === 3).map(c => c.nombre).join(", ")}
  Escuela 4 (EAN): ${CARRERAS.filter(c => c.escuela === 4).map(c => c.nombre).join(", ")}
`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
