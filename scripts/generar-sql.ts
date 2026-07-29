/**
 * Genera archivo SQL masivo para SPAH.
 * Uso: npx tsx scripts/generar-sql.ts
 * Output: scripts/seed-masivo.sql
 */
import * as fs from "fs";
import * as path from "path";

const GESTION = "2026-II";
const lines: string[] = [];

function q(s: string) { return s.replace(/'/g, "''"); }

lines.push("-- SEED MASIVO SPAH: 10 carreras, 9 semestres, 6 materias = 540 materias");
lines.push("-- Ejecutar en Neon SQL Editor");
lines.push("");

// ═══ ESPACIOS ═══
lines.push("-- ESPACIOS (30)");
for (let esc = 1; esc <= 4; esc++) {
  for (let i = 1; i <= 3; i++) {
    lines.push(`INSERT INTO espacios (codigo, tipo, aforo, escuela, activo) VALUES ('A${esc}0${i}', 'AULA', ${35 + i*5}, ${esc}, true) ON CONFLICT DO NOTHING;`);
  }
  for (let i = 1; i <= 2; i++) {
    lines.push(`INSERT INTO espacios (codigo, tipo, aforo, escuela, activo) VALUES ('LAB${esc}0${i}', 'LABORATORIO', ${25 + i*5}, ${esc}, true) ON CONFLICT DO NOTHING;`);
  }
  lines.push(`INSERT INTO espacios (codigo, tipo, aforo, escuela, activo) VALUES ('TAL${esc}01', 'TALLER', 20, ${esc}, true) ON CONFLICT DO NOTHING;`);
  if (esc === 3 || esc === 4) {
    lines.push(`INSERT INTO espacios (codigo, tipo, aforo, escuela, activo) VALUES ('TAL${esc}02', 'TALLER', 25, ${esc}, true) ON CONFLICT DO NOTHING;`);
  }
}
lines.push("");

// ═══ DOCENTES ═══
const NOMBRES = ["Garcia","Lopez","Martinez","Rodriguez","Hernandez","Gonzalez","Perez","Sanchez","Ramirez","Torres","Flores","Rivera","Gomez","Diaz","Cruz","Morales","Ortiz","Gutierrez","Chavez","Ramos","Reyes","Ruiz","Mendoza","Aguilar","Medina","Castro","Vargas","Romero","Jimenez","Alvarez","Fernandez","Castillo","Rojas","Herrera","Moreno","Munoz","Nunez","Soto","Vega","Campos","Delgado","Espinoza","Guerrero","Cabrera","Rios","Contreras","Figueroa","Silva","Sandoval","Cortez","Maldonado","Salazar","Navarro","Pena","Cardenas","Pacheco","Fuentes","Valenzuela","Ibarra","Miranda"];
const APELLIDOS2 = ["Quispe","Mamani","Condori","Choque","Huanca","Apaza","Limachi","Callisaya","Ticona","Alanoca","Yujra","Poma","Copa","Nina","Flores","Ramos","Gutierrez","Vargas","Lopez","Cruz","Torrez","Mendez","Rojas","Santos","Molina","Vega","Luna","Siles","Duran","Quiroga","Suarez","Paz","Arce","Belen","Coca","Daza","Echeverria","Franco","Gil","Hurtado","Ibanez","Justiniano","Kuno","Lema","Mena","Navia","Ochoa","Paredes","Quiroz","Rosales","Segovia","Tapia","Uribe","Valencia","Waldo","Zarate","Acha","Borda","Calle","Doria"];

lines.push("-- DOCENTES (60)");
for (let i = 0; i < 60; i++) {
  const ci = `${5000000 + i * 1111}LP`;
  const nombre = `${NOMBRES[i]} ${APELLIDOS2[i]}`;
  lines.push(`INSERT INTO docentes (ci, nombre, profesion, telefono, gestion) VALUES ('${ci}', '${q(nombre)}', 'Licenciado/a', '7${1000000+i*111}', '${GESTION}') ON CONFLICT DO NOTHING;`);
}
lines.push("");

// ═══ DISPONIBILIDAD ═══
const SLOTS_M = ["07:45","08:30","09:15","10:00","10:45","11:30","12:15","13:00","13:45"];
const SLOTS_T = ["13:45","14:30","15:15","16:00","16:45","17:30"];
const SLOTS_N = ["18:15","19:00","19:45","20:30","21:15","22:00"];
const DIAS: string[] = ["Lunes","Martes","Miércoles","Jueves","Viernes"];

lines.push("-- DISPONIBILIDAD DOCENTE");
lines.push("-- (usando subquery para obtener docente_id por CI)");
for (let i = 0; i < 60; i++) {
  const ci = `${5000000 + i * 1111}LP`;
  const numDias = 3 + (i % 2);
  const diasDisp = DIAS.slice(0, numDias);
  const turnoSlots = i % 3 === 0 ? SLOTS_M : i % 3 === 1 ? SLOTS_T : SLOTS_N;
  
  for (const dia of diasDisp) {
    for (const slot of turnoSlots) {
      lines.push(`INSERT INTO disponibilidad_docente (docente_id, dia, slot, gestion) SELECT id, '${dia}', '${slot}', '${GESTION}' FROM docentes WHERE ci='${ci}' ON CONFLICT DO NOTHING;`);
    }
  }
}
lines.push("");

// ═══ CATÁLOGO DE MATERIAS ═══
const CARRERAS = [
  { escuela: 1, nombre: "INGENIERIA DE SISTEMAS", turno: "Mañana", grupo: "AM" },
  { escuela: 1, nombre: "INGENIERIA ELECTRONICA", turno: "Noche", grupo: "AN" },
  { escuela: 1, nombre: "INGENIERIA INDUSTRIAL", turno: "Mañana", grupo: "BM" },
  { escuela: 2, nombre: "ADMINISTRACION DE EMPRESAS", turno: "Tarde", grupo: "AT" },
  { escuela: 2, nombre: "CONTADURIA PUBLICA", turno: "Noche", grupo: "AN" },
  { escuela: 2, nombre: "MARKETING Y PUBLICIDAD", turno: "Tarde", grupo: "BT" },
  { escuela: 3, nombre: "DISENO GRAFICO", turno: "Tarde", grupo: "AT" },
  { escuela: 3, nombre: "COMUNICACION SOCIAL", turno: "Mañana", grupo: "AM" },
  { escuela: 4, nombre: "ARQUITECTURA", turno: "Mañana", grupo: "AM" },
  { escuela: 4, nombre: "INGENIERIA AMBIENTAL", turno: "Noche", grupo: "BN" },
];

const MATERIAS: Record<number, string[][]> = {
  1: [
    ["MATEMATICA I","FISICA I","INTRO PROGRAMACION","ALGEBRA LINEAL","QUIMICA GENERAL","INGLES TECNICO I"],
    ["MATEMATICA II","FISICA II","PROG ORIENTADA OBJETOS","ESTADISTICA","DIBUJO TECNICO","INGLES TECNICO II"],
    ["MATEMATICA III","ELECTRONICA BASICA","ESTRUCTURA DE DATOS","BASES DE DATOS I","REDES I","METODOLOGIA INVEST"],
    ["ECUACIONES DIFERENCIALES","SISTEMAS OPERATIVOS","BASES DE DATOS II","REDES II","ING SOFTWARE I","ECONOMIA"],
    ["INVEST OPERATIVA","ARQ COMPUTADORES","ING SOFTWARE II","SEGURIDAD INFORMATICA","GESTION PROYECTOS","DERECHO INFORMATICO"],
    ["INTELIGENCIA ARTIFICIAL","COMPILADORES","DESARROLLO WEB","SISTEMAS DISTRIBUIDOS","AUDITORIA SISTEMAS","TALLER GRADO I"],
    ["MACHINE LEARNING","COMPUTACION NUBE","DESARROLLO MOVIL","IOT SISTEMAS EMBEBIDOS","GOBIERNO TI","TALLER GRADO II"],
    ["BIG DATA","BLOCKCHAIN","CIBERSEGURIDAD AVANZADA","DEVOPS","EMPRENDIMIENTO TEC","PRACTICA PROFESIONAL I"],
    ["PROYECTO FINAL","INNOVACION TEC","LIDERAZGO GESTION","ETICA PROFESIONAL","SEMINARIO TENDENCIAS","PRACTICA PROFESIONAL II"],
  ],
  2: [
    ["MATEMATICA FINANCIERA","MICROECONOMIA","CONTABILIDAD BASICA","ADMINISTRACION I","DERECHO COMERCIAL","COMUNICACION EMPR"],
    ["ESTADISTICA EMPRESARIAL","MACROECONOMIA","CONTABILIDAD INTERMEDIA","ADMINISTRACION II","DERECHO LABORAL","INGLES NEGOCIOS I"],
    ["INVEST MERCADOS","FINANZAS I","COSTOS PRESUPUESTOS","RECURSOS HUMANOS","COMERCIO INTERNAC","INGLES NEGOCIOS II"],
    ["MARKETING ESTRATEGICO","FINANZAS II","AUDITORIA I","GESTION OPERACIONES","LEGISLACION TRIBUTARIA","PLAN DE NEGOCIOS"],
    ["MARKETING DIGITAL","MERCADO VALORES","AUDITORIA II","LOGISTICA","TRIBUTACION AVANZADA","SEMINARIO I"],
    ["COMP ORGANIZACIONAL","BANCA SEGUROS","AUDITORIA FORENSE","CALIDAD TOTAL","COMERCIO ELECTRONICO","SEMINARIO II"],
    ["GESTION TALENTO","EVAL PROYECTOS","CONT GUBERNAMENTAL","NEGOCIOS INTERNAC","RESP SOCIAL","TALLER GRADO I"],
    ["CONSULTORIA EMPR","FINANZAS CORPORATIVAS","NORMAS INTERNAC","ESTRATEGIA EMPR","INNOVACION","PRACTICA EMPR I"],
    ["PROYECTO EMPRESARIAL","SIMULACION NEGOCIOS","GOBIERNO CORPORATIVO","LIDERAZGO","ETICA EMPRESARIAL","PRACTICA EMPR II"],
  ],
  3: [
    ["DIBUJO ARTISTICO I","TEORIA DEL COLOR","HISTORIA DEL ARTE","FOTOGRAFIA I","TIPOGRAFIA","SEMIOTICA"],
    ["DIBUJO ARTISTICO II","COMPOSICION VISUAL","HISTORIA DISENO","FOTOGRAFIA II","DISENO EDITORIAL","REDACCION CREATIVA"],
    ["ILUSTRACION DIGITAL","DISENO IDENTIDAD","PRODUCCION AUDIOVISUAL","ANIMACION I","DISENO WEB I","INVEST DISENO"],
    ["PACKAGING","BRANDING","PRODUCCION MULTIMEDIA","ANIMACION II","DISENO WEB II","GESTION CULTURAL"],
    ["DISENO PUBLICITARIO","SENALETICA","POSTPRODUCCION","ANIMACION 3D","UX UI DESIGN","MARKETING CREATIVO"],
    ["DISENO EDITORIAL AVZ","DISENO EXPERIENCIAS","PRODUCCION TV","MOTION GRAPHICS","APP DESIGN","TALLER CREATIVO I"],
    ["DIRECCION DE ARTE","DISENO SOCIAL","DOCUMENTAL","REALIDAD VIRTUAL","DISENO SERVICIOS","TALLER CREATIVO II"],
    ["PORTAFOLIO PROF","GESTION DISENO","PERIODISMO DIGITAL","TRANSMEDIA","INNOVACION CREATIVA","PRACTICA CREATIVA I"],
    ["PROYECTO GRADO","EMPRENDIMIENTO CREAT","CRITICA MEDIOS","TENDENCIAS DIGITALES","ETICA COMUNICACION","PRACTICA CREATIVA II"],
  ],
  4: [
    ["MAT ARQUITECTURA","DIBUJO ARQ I","HISTORIA ARQ I","GEOMETRIA DESCRIPTIVA","TALLER DISENO I","ECOLOGIA"],
    ["FISICA APLICADA","DIBUJO ARQ II","HISTORIA ARQ II","TOPOGRAFIA","TALLER DISENO II","BIOLOGIA AMBIENTAL"],
    ["RESIST MATERIALES","AUTOCAD BIM","URBANISMO I","INSTALACIONES I","TALLER DISENO III","QUIMICA AMBIENTAL"],
    ["ESTRUCTURAS I","MODELADO 3D","URBANISMO II","INSTALACIONES II","TALLER DISENO IV","GESTION AMBIENTAL"],
    ["ESTRUCTURAS II","RENDER VISUALIZACION","PLANIF TERRITORIAL","CONSTRUCCION I","TALLER DISENO V","IMPACTO AMBIENTAL"],
    ["PRESUPUESTO OBRA","PAISAJISMO","RESTAURACION","CONSTRUCCION II","TALLER DISENO VI","LEGISLACION AMBIENTAL"],
    ["GERENCIA PROYECTOS","DISENO SOSTENIBLE","PATRIMONIO","TEC MATERIALES","TALLER DISENO VII","ENERGIAS RENOVABLES"],
    ["GESTION INMOBILIARIA","DISENO PARAMETRICO","VIVIENDA SOCIAL","SUPERVISION OBRA","TALLER GRADO","PRACTICA AMBIENTAL I"],
    ["PROYECTO ARQ","INNOVACION CONSTRUCTIVA","CIUDAD TERRITORIO","PERITAJE","ETICA PROFESIONAL","PRACTICA AMBIENTAL II"],
  ],
};

function getTipo(nombre: string): string {
  const n = nombre.toUpperCase();
  if (n.includes("TALLER") || n.includes("DIBUJO")) return "TALLER";
  if (n.includes("PROG") || n.includes("BASE") || n.includes("RED") || n.includes("WEB") || n.includes("DESARROLLO") || n.includes("AUTOCAD") || n.includes("BIM") || n.includes("MODELADO") || n.includes("RENDER") || n.includes("ANIMACION") || n.includes("DIGITAL") || n.includes("FOTOGRAFIA") || n.includes("PRODUCCION") || n.includes("APP") || n.includes("UX") || n.includes("IOT") || n.includes("MACHINE") || n.includes("BIG DATA") || n.includes("BLOCKCHAIN") || n.includes("DEVOPS") || n.includes("COMPUTACION")) return "LABORATORIO";
  return "AULA";
}

function getHoras(nombre: string, tipo: string): number {
  if (nombre.includes("PRACTICA") || nombre.includes("PASANTIA")) return 3;
  if (tipo === "LABORATORIO") return 5;
  if (tipo === "TALLER") return 4;
  return nombre.length % 3 === 0 ? 3 : nombre.length % 3 === 1 ? 4 : 5;
}

const SEM_LABELS = ["PRIMERO","SEGUNDO","TERCERO","CUARTO","QUINTO","SEXTO","SEPTIMO","OCTAVO","NOVENO"];

lines.push("-- CATALOGO DE MATERIAS (540)");
const habLines: string[] = [];

for (const carrera of CARRERAS) {
  const template = MATERIAS[carrera.escuela];
  for (let sem = 0; sem < 9; sem++) {
    const mats = template[sem];
    for (let m = 0; m < mats.length; m++) {
      const nombre = mats[m];
      const tipo = getTipo(nombre);
      const horas = getHoras(nombre, tipo);
      const codigo = `${carrera.nombre.substring(0,3).toUpperCase()}${sem+1}${String(m+1).padStart(2,"0")}`;
      const grupoCodigo = `${sem+1}${carrera.grupo}`;
      const proyeccion = tipo === "AULA" ? 30 : tipo === "LABORATORIO" ? 22 : 18;

      lines.push(`INSERT INTO materias_catalogo (escuela, carrera, nombre_asignatura, codigo, grupo_codigo, turno, proyeccion_inscritos, horas_por_semana, semestre, tipo_aula, gestion) VALUES (${carrera.escuela}, '${q(carrera.nombre)}', '${q(nombre)}', '${codigo}', '${grupoCodigo}', '${carrera.turno}', ${proyeccion}, ${horas}, '${SEM_LABELS[sem]}', '${tipo}', '${GESTION}') ON CONFLICT DO NOTHING;`);

      // Habilitaciones: 2 docentes por materia
      const escDocOffset = (carrera.escuela - 1) * 15;
      const docIdx1 = escDocOffset + ((sem * 6 + m) % 15);
      const docIdx2 = escDocOffset + ((sem * 6 + m + 1) % 15);
      const ci1 = `${5000000 + docIdx1 * 1111}LP`;
      const ci2 = `${5000000 + docIdx2 * 1111}LP`;

      habLines.push(`INSERT INTO materias_habilitadas (docente_id, sigla, nombre_materia, carrera) SELECT id, '${codigo}', '${q(nombre)}', '${q(carrera.nombre)}' FROM docentes WHERE ci='${ci1}' ON CONFLICT DO NOTHING;`);
      habLines.push(`INSERT INTO materias_habilitadas (docente_id, sigla, nombre_materia, carrera) SELECT id, '${codigo}', '${q(nombre)}', '${q(carrera.nombre)}' FROM docentes WHERE ci='${ci2}' ON CONFLICT DO NOTHING;`);
    }
  }
}
lines.push("");
lines.push("-- HABILITACIONES DOCENTE-MATERIA (~1080)");
lines.push(...habLines);
lines.push("");
lines.push("-- FIN DEL SEED MASIVO");

const outputPath = path.join(__dirname, "seed-masivo.sql");
fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
console.log(`SQL generado: ${outputPath} (${lines.length} líneas)`);
