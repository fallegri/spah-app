import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = path.join(__dirname, "../public/plantillas/demo");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SLOTS = ["07:45","08:30","09:15","10:00","10:45","11:30","12:15","13:00","13:45","14:30","15:15","16:00","16:45","17:30","18:15","19:00","19:45","20:30","21:15","22:00","22:45"];

const DOCENTES = [
  { ci: "1001001SC", nombre: "Garcia Lopez Maria Elena", profesion: "Ing. Sistemas", tel: "70011001" },
  { ci: "1002002SC", nombre: "Martinez Rojas Carlos Alberto", profesion: "Ing. Industrial", tel: "70022002" },
  { ci: "1003003SC", nombre: "Fernandez Vaca Sandra Patricia", profesion: "Lic. Administracion", tel: "70033003" },
  { ci: "1004004SC", nombre: "Perez Suarez Juan Carlos", profesion: "Ing. Telecomunicaciones", tel: "70044004" },
  { ci: "1005005SC", nombre: "Rodriguez Mendoza Ana Lucia", profesion: "Lic. Matematicas", tel: "70055005" },
  { ci: "1006006SC", nombre: "Torrez Aguilar Pedro Miguel", profesion: "Ing. Electromecanica", tel: "70066006" },
  { ci: "1007007SC", nombre: "Vargas Quispe Claudia Beatriz", profesion: "Lic. Diseño Grafico", tel: "70077007" },
  { ci: "1008008SC", nombre: "Morales Gutierrez Roberto Carlos", profesion: "Ing. Sistemas", tel: "70088008" },
  { ci: "1012012SC", nombre: "Castillo Mendez Javier Fernando", profesion: "Ing. Sistemas", tel: "70122012" },
];

const HABILITACIONES = [
  { ci: "1001001SC", nombre: "Garcia Lopez Maria Elena", materia: "PROGRAMACION DE ALGORITMOS", sigla: "DES120", carrera: "Ingenieria de Sistemas" },
  { ci: "1001001SC", nombre: "Garcia Lopez Maria Elena", materia: "PROGRAMACION ORIENTADA A OBJETOS", sigla: "DES210", carrera: "Ingenieria de Sistemas" },
  { ci: "1001001SC", nombre: "Garcia Lopez Maria Elena", materia: "ESTRUCTURAS DE DATOS Y ALGORITMOS", sigla: "DES410", carrera: "Ingenieria de Sistemas" },
  { ci: "1002002SC", nombre: "Martinez Rojas Carlos Alberto", materia: "FISICA", sigla: "FIG110", carrera: "Ingenieria Industrial" },
  { ci: "1002002SC", nombre: "Martinez Rojas Carlos Alberto", materia: "SEGURIDAD INDUSTRIAL", sigla: "GEA641", carrera: "Ingenieria Industrial" },
  { ci: "1002002SC", nombre: "Martinez Rojas Carlos Alberto", materia: "ADMINISTRACION GENERAL", sigla: "GEA112", carrera: "Ingenieria Industrial" },
  { ci: "1003003SC", nombre: "Fernandez Vaca Sandra Patricia", materia: "ECONOMIA PARA LA ADMINISTRACION", sigla: "ECO110", carrera: "Ingenieria Comercial" },
  { ci: "1003003SC", nombre: "Fernandez Vaca Sandra Patricia", materia: "FUNDAMENTOS DE MARKETING", sigla: "MKT310", carrera: "Ingenieria Comercial" },
  { ci: "1003003SC", nombre: "Fernandez Vaca Sandra Patricia", materia: "ESTADISTICA I", sigla: "EST010", carrera: "Ingenieria Comercial" },
  { ci: "1004004SC", nombre: "Perez Suarez Juan Carlos", materia: "FUNDAMENTOS DE REDES (CCNA1)", sigla: "IFT210", carrera: "Ingenieria de Sistemas" },
  { ci: "1004004SC", nombre: "Perez Suarez Juan Carlos", materia: "ARQUITECTURA DE SOFTWARE", sigla: "SOF610", carrera: "Ingenieria de Sistemas" },
  { ci: "1004004SC", nombre: "Perez Suarez Juan Carlos", materia: "SEGURIDAD INFORMATICA", sigla: "ITEL200", carrera: "Ingenieria de Sistemas" },
  { ci: "1005005SC", nombre: "Rodriguez Mendoza Ana Lucia", materia: "ALGEBRA", sigla: "MAT040", carrera: "Ingenieria de Sistemas" },
  { ci: "1005005SC", nombre: "Rodriguez Mendoza Ana Lucia", materia: "MATEMATICA DISCRETA Y LOGICA", sigla: "MAT050", carrera: "Ingenieria de Sistemas" },
  { ci: "1005005SC", nombre: "Rodriguez Mendoza Ana Lucia", materia: "PROBABILIDAD Y ESTADISTICA", sigla: "EST030", carrera: "Ingenieria de Sistemas" },
  { ci: "1005005SC", nombre: "Rodriguez Mendoza Ana Lucia", materia: "MATEMATICA BASICA", sigla: "MAT101", carrera: "Lic. En Diseño Grafico" },
  { ci: "1007007SC", nombre: "Vargas Quispe Claudia Beatriz", materia: "TECNICAS DE REPRESENTACION", sigla: "TRD1011", carrera: "Lic. En Diseño Grafico" },
  { ci: "1007007SC", nombre: "Vargas Quispe Claudia Beatriz", materia: "TALLER DE ELEMENTOS GRAFICOS", sigla: "TEG1011", carrera: "Lic. En Diseño Grafico" },
  { ci: "1007007SC", nombre: "Vargas Quispe Claudia Beatriz", materia: "COLOR", sigla: "CLD1011", carrera: "Lic. En Diseño Grafico" },
  { ci: "1007007SC", nombre: "Vargas Quispe Claudia Beatriz", materia: "EDICION VECTORIAL", sigla: "EVD1011", carrera: "Lic. En Diseño Grafico" },
  { ci: "1008008SC", nombre: "Morales Gutierrez Roberto Carlos", materia: "DESARROLLO DE APLICACIONES WEB I", sigla: "DES421", carrera: "Ingenieria de Sistemas" },
  { ci: "1008008SC", nombre: "Morales Gutierrez Roberto Carlos", materia: "INGENIERIA DE SOFTWARE", sigla: "SOF620", carrera: "Ingenieria de Sistemas" },
  { ci: "1008008SC", nombre: "Morales Gutierrez Roberto Carlos", materia: "TALLER PRODUCCION DIGITAL", sigla: "TPD4011", carrera: "Lic. En Diseño Grafico" },
  { ci: "1008008SC", nombre: "Morales Gutierrez Roberto Carlos", materia: "PROTOTIPADO WEB", sigla: "PWD2011", carrera: "Lic. En Diseño Grafico" },
  { ci: "1012012SC", nombre: "Castillo Mendez Javier Fernando", materia: "MODELAMIENTO DE DATOS Y BASES DE DATOS", sigla: "BDT210", carrera: "Ingenieria de Sistemas" },
  { ci: "1012012SC", nombre: "Castillo Mendez Javier Fernando", materia: "PROGRAMACION ORIENTADA A OBJETOS", sigla: "DES210", carrera: "Ingenieria de Sistemas" },
];

const CATALOGO = [
  { escuela: 1, carrera: "Ingenieria de Sistemas", res: "2570/2017", nombre: "PROGRAMACION DE ALGORITMOS", codigo: "DES120", grupo: "1AM", turno: "Mañana", inscritos: 25, horas: 5, sem: "PRIMERO", tipo: "LABORATORIO" },
  { escuela: 1, carrera: "Ingenieria de Sistemas", res: "2570/2017", nombre: "ALGEBRA", codigo: "MAT040", grupo: "1AM", turno: "Mañana", inscritos: 25, horas: 4, sem: "PRIMERO", tipo: "AULA" },
  { escuela: 1, carrera: "Ingenieria de Sistemas", res: "2570/2017", nombre: "PROGRAMACION ORIENTADA A OBJETOS", codigo: "DES210", grupo: "2AM", turno: "Mañana", inscritos: 22, horas: 5, sem: "SEGUNDO", tipo: "LABORATORIO" },
  { escuela: 1, carrera: "Ingenieria de Sistemas", res: "2570/2017", nombre: "MODELAMIENTO DE DATOS Y BASES DE DATOS", codigo: "BDT210", grupo: "2AM", turno: "Mañana", inscritos: 22, horas: 5, sem: "SEGUNDO", tipo: "LABORATORIO" },
  { escuela: 1, carrera: "Ingenieria de Sistemas", res: "2570/2017", nombre: "FUNDAMENTOS DE REDES (CCNA1)", codigo: "IFT210", grupo: "2AM", turno: "Mañana", inscritos: 21, horas: 5, sem: "SEGUNDO", tipo: "LABORATORIO" },
  { escuela: 1, carrera: "Ingenieria de Sistemas", res: "2570/2017", nombre: "MATEMATICA DISCRETA Y LOGICA", codigo: "MAT050", grupo: "2AM", turno: "Mañana", inscritos: 19, horas: 5, sem: "SEGUNDO", tipo: "AULA" },
  { escuela: 1, carrera: "Ingenieria de Sistemas", res: "2570/2017", nombre: "ESTRUCTURAS DE DATOS Y ALGORITMOS", codigo: "DES410", grupo: "4AM", turno: "Mañana", inscritos: 15, horas: 5, sem: "CUARTO", tipo: "LABORATORIO" },
  { escuela: 1, carrera: "Ingenieria de Sistemas", res: "2570/2017", nombre: "DESARROLLO DE APLICACIONES WEB I", codigo: "DES421", grupo: "4AM", turno: "Mañana", inscritos: 14, horas: 5, sem: "CUARTO", tipo: "LABORATORIO" },
  { escuela: 1, carrera: "Ingenieria de Sistemas", res: "2570/2017", nombre: "PROBABILIDAD Y ESTADISTICA", codigo: "EST030", grupo: "4AM", turno: "Mañana", inscritos: 14, horas: 4, sem: "CUARTO", tipo: "AULA" },
  { escuela: 1, carrera: "Ingenieria de Sistemas", res: "2570/2017", nombre: "ARQUITECTURA DE SOFTWARE", codigo: "SOF610", grupo: "6AN", turno: "Noche", inscritos: 10, horas: 5, sem: "SEXTO", tipo: "LABORATORIO" },
  { escuela: 1, carrera: "Ingenieria de Sistemas", res: "2570/2017", nombre: "INGENIERIA DE SOFTWARE", codigo: "SOF620", grupo: "6AN", turno: "Noche", inscritos: 10, horas: 5, sem: "SEXTO", tipo: "LABORATORIO" },
  { escuela: 1, carrera: "Ingenieria de Sistemas", res: "2570/2017", nombre: "SEGURIDAD INFORMATICA", codigo: "ITEL200", grupo: "6AN", turno: "Noche", inscritos: 9, horas: 5, sem: "SEXTO", tipo: "LABORATORIO" },
  { escuela: 1, carrera: "Lic. En Diseño Grafico", res: "718/2015", nombre: "TECNICAS DE REPRESENTACION", codigo: "TRD1011", grupo: "1AM", turno: "Mañana", inscritos: 20, horas: 4, sem: "PRIMERO", tipo: "TALLER" },
  { escuela: 1, carrera: "Lic. En Diseño Grafico", res: "718/2015", nombre: "TALLER DE ELEMENTOS GRAFICOS", codigo: "TEG1011", grupo: "1AM", turno: "Mañana", inscritos: 20, horas: 6, sem: "PRIMERO", tipo: "TALLER" },
  { escuela: 1, carrera: "Lic. En Diseño Grafico", res: "718/2015", nombre: "COLOR", codigo: "CLD1011", grupo: "1AM", turno: "Mañana", inscritos: 20, horas: 3, sem: "PRIMERO", tipo: "TALLER" },
  { escuela: 1, carrera: "Lic. En Diseño Grafico", res: "718/2015", nombre: "EDICION VECTORIAL", codigo: "EVD1011", grupo: "1AM", turno: "Mañana", inscritos: 20, horas: 4, sem: "PRIMERO", tipo: "LABORATORIO" },
  { escuela: 1, carrera: "Lic. En Diseño Grafico", res: "718/2015", nombre: "MATEMATICA BASICA", codigo: "MAT101", grupo: "1AM", turno: "Mañana", inscritos: 20, horas: 4, sem: "PRIMERO", tipo: "AULA" },
  { escuela: 1, carrera: "Lic. En Diseño Grafico", res: "718/2015", nombre: "TALLER PRODUCCION DIGITAL", codigo: "TPD4011", grupo: "4AM", turno: "Mañana", inscritos: 17, horas: 8, sem: "CUARTO", tipo: "LABORATORIO" },
  { escuela: 1, carrera: "Lic. En Diseño Grafico", res: "718/2015", nombre: "PROTOTIPADO WEB", codigo: "PWD2011", grupo: "4AM", turno: "Mañana", inscritos: 17, horas: 4, sem: "CUARTO", tipo: "LABORATORIO" },
  { escuela: 2, carrera: "Ingenieria Industrial", res: "1234/2018", nombre: "FISICA", codigo: "FIG110", grupo: "1AM", turno: "Mañana", inscritos: 30, horas: 4, sem: "PRIMERO", tipo: "AULA" },
  { escuela: 2, carrera: "Ingenieria Industrial", res: "1234/2018", nombre: "ADMINISTRACION GENERAL", codigo: "GEA112", grupo: "1AM", turno: "Mañana", inscritos: 30, horas: 4, sem: "PRIMERO", tipo: "AULA" },
  { escuela: 2, carrera: "Ingenieria Industrial", res: "1234/2018", nombre: "SEGURIDAD INDUSTRIAL", codigo: "GEA641", grupo: "6AM", turno: "Mañana", inscritos: 18, horas: 4, sem: "SEXTO", tipo: "AULA" },
  { escuela: 3, carrera: "Ingenieria Comercial", res: "5678/2019", nombre: "ECONOMIA PARA LA ADMINISTRACION", codigo: "ECO110", grupo: "1AN", turno: "Noche", inscritos: 28, horas: 4, sem: "PRIMERO", tipo: "AULA" },
  { escuela: 3, carrera: "Ingenieria Comercial", res: "5678/2019", nombre: "FUNDAMENTOS DE MARKETING", codigo: "MKT310", grupo: "3AN", turno: "Noche", inscritos: 20, horas: 4, sem: "TERCERO", tipo: "AULA" },
  { escuela: 3, carrera: "Ingenieria Comercial", res: "5678/2019", nombre: "ESTADISTICA I", codigo: "EST010", grupo: "1AN", turno: "Noche", inscritos: 28, horas: 4, sem: "PRIMERO", tipo: "AULA" },
];

const ESPACIOS = [
  { aula: "A101", aforo: 50, tipo: "AULA", escuela: 2 },
  { aula: "A102", aforo: 50, tipo: "AULA", escuela: 2 },
  { aula: "A201", aforo: 46, tipo: "AULA", escuela: 3 },
  { aula: "A202", aforo: 46, tipo: "AULA", escuela: 3 },
  { aula: "B201", aforo: 46, tipo: "AULA", escuela: 1 },
  { aula: "B202", aforo: 46, tipo: "AULA", escuela: 1 },
  { aula: "C101", aforo: 30, tipo: "AULA", escuela: 1 },
  { aula: "LAB202", aforo: 30, tipo: "LABORATORIO", escuela: 1 },
  { aula: "LAB203", aforo: 40, tipo: "LABORATORIO", escuela: 1 },
  { aula: "LAB205", aforo: 20, tipo: "LABORATORIO", escuela: 1 },
  { aula: "LAB101", aforo: 20, tipo: "LABORATORIO", escuela: 2 },
  { aula: "TALLER 1 DG B206", aforo: 28, tipo: "TALLER", escuela: 1 },
  { aula: "TALLER 2 DG B205", aforo: 28, tipo: "TALLER", escuela: 1 },
  { aula: "TM101", aforo: 22, tipo: "TALLER", escuela: 2 },
];

// ─── GENERATORS ─────────────────────────────────────────────────────────────

function generarCatalogo() {
  const headers = ["ESCUELA", "CARRERA", "RESOLUCIÓN MINISTERIAL", "NOMBRE ASIGNATURA", "CODIGO", "GRUPO", "TURNO", "PROYECCIÓN DE INSCRITOS", "Horas por Semana", "SEMESTRE", "TIPO AULA"];
  const rows = CATALOGO.map(m => [m.escuela, m.carrera, m.res, m.nombre, m.codigo, m.grupo, m.turno, m.inscritos, m.horas, m.sem, m.tipo]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Oferta");
  XLSX.writeFile(wb, path.join(OUTPUT_DIR, "catalogo_prueba.xlsx"));
  console.log("✓ Catalogo: " + CATALOGO.length + " materias");
}

function generarEspacios() {
  const headers = ["Aula", "AFORO", "TIPO", "ESCUELA"];
  const rows = ESPACIOS.map(e => [e.aula, e.aforo, e.tipo, e.escuela]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Salas");
  XLSX.writeFile(wb, path.join(OUTPUT_DIR, "espacios_prueba.xlsx"));
  console.log("✓ Espacios: " + ESPACIOS.length + " espacios");
}

function generarHabilitacion() {
  const headers = ["CI", "Docente", "Materia", "Sigla", "Carrera"];
  const rows = HABILITACIONES.map(h => [h.ci, h.nombre, h.materia, h.sigla, h.carrera]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
  XLSX.writeFile(wb, path.join(OUTPUT_DIR, "habilitacion_prueba.xlsx"));
  console.log("✓ Habilitacion: " + HABILITACIONES.length + " registros");
}

function generarDisponibilidad() {
  const nocturno = ["1003003SC", "1004004SC"];
  for (const doc of DOCENTES) {
    const wb = XLSX.utils.book_new();
    const isNoche = nocturno.includes(doc.ci);
    const slotRange = isNoche ? [14,15,16,17,18,19,20] : [0,1,2,3,4,5,6];
    const headerRows: any[][] = [
      ["Nombre del docente:", doc.nombre],
      ["C.I.:", doc.ci],
      ["Profesión:", doc.profesion],
      ["Teléfono:", doc.tel],
      [],
    ];
    const gridHeader = ["Hora", ...DIAS];
    const gridRows: any[][] = [gridHeader];
    for (let s = 0; s < SLOTS.length; s++) {
      const row: any[] = [SLOTS[s] + " a " + (SLOTS[s+1] || "23:30")];
      for (let d = 0; d < 6; d++) {
        if (slotRange.includes(s) && d < 5) {
          row.push(Math.random() < 0.85 ? "X" : "");
        } else if (d === 5 && slotRange.includes(s) && Math.random() < 0.3) {
          row.push("X");
        } else {
          row.push("");
        }
      }
      gridRows.push(row);
    }
    const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...gridRows]);
    XLSX.utils.book_append_sheet(wb, ws, "PRESENCIAL");
    XLSX.writeFile(wb, path.join(OUTPUT_DIR, "disponibilidad_" + doc.ci + ".xlsx"));
  }
  console.log("✓ Disponibilidad: " + DOCENTES.length + " archivos generados");
}

// ─── RUN ────────────────────────────────────────────────────────────────────
console.log("\n=== SPAH — Generador de datos de prueba ===\n");
generarCatalogo();
generarEspacios();
generarHabilitacion();
generarDisponibilidad();
console.log("\n=== Listo! Archivos en: " + OUTPUT_DIR + " ===\n");
