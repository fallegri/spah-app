import * as XLSX from "xlsx";
import type { MateriaCatalogo, TipoEspacio, Turno } from "@/types/scheduler";

interface ParseResult {
  materias: Omit<MateriaCatalogo, "id">[];
  errores: string[];
  advertencias: string[];
}

export function parseCatalogo(buffer: ArrayBuffer, gestion: string): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });

  // Find the correct sheet (try "Oferta" first, then first sheet)
  let sheetName = workbook.SheetNames.find(
    (n) => n.toLowerCase().includes("oferta") || n.toLowerCase().includes("catálogo")
  );
  if (!sheetName) sheetName = workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const materias: Omit<MateriaCatalogo, "id">[] = [];
  const errores: string[] = [];
  const advertencias: string[] = [];

  // Find header row
  let headerIdx = -1;
  const headerMap: Record<string, number> = {};

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i].map((c: any) => String(c).trim().toUpperCase());
    if (row.includes("ESCUELA") || row.includes("CODIGO") || row.includes("NOMBRE ASIGNATURA")) {
      headerIdx = i;
      row.forEach((cell: string, idx: number) => {
        if (cell.includes("ESCUELA")) headerMap.escuela = idx;
        if (cell.includes("CARRERA")) headerMap.carrera = idx;
        if (cell.includes("RESOLUC")) headerMap.resolucion = idx;
        if (cell.includes("NOMBRE") && cell.includes("ASIGNATURA")) headerMap.nombre = idx;
        if (cell === "CODIGO" || cell === "CÓDIGO") headerMap.codigo = idx;
        if (cell.includes("GRUPO")) headerMap.grupo = idx;
        if (cell.includes("TURNO")) headerMap.turno = idx;
        if (cell.includes("PROYECC") || cell.includes("INSCRITOS")) headerMap.proyeccion = idx;
        if (cell.includes("HORAS")) headerMap.horas = idx;
        if (cell.includes("SEMESTRE")) headerMap.semestre = idx;
        if (cell.includes("TIPO") && cell.includes("AULA")) headerMap.tipoAula = idx;
      });
      break;
    }
  }

  if (headerIdx === -1) {
    errores.push("No se encontró la fila de encabezados en el archivo de catálogo");
    return { materias, errores, advertencias };
  }

  // Parse data rows
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c: any) => !c)) continue;

    const codigo = String(row[headerMap.codigo] || "").trim();
    const nombre = String(row[headerMap.nombre] || "").trim();
    if (!codigo || !nombre) continue;

    const horas = parseInt(String(row[headerMap.horas] || "0"), 10);
    const escuela = parseInt(String(row[headerMap.escuela] || "1"), 10);
    const grupo = String(row[headerMap.grupo] || "").trim();
    const turnoRaw = String(row[headerMap.turno] || "Mañana").trim();
    const tipoAulaRaw = String(row[headerMap.tipoAula] || "").trim().toUpperCase();
    const proyeccion = parseInt(String(row[headerMap.proyeccion] || "0"), 10);
    const semestre = String(row[headerMap.semestre] || "").trim();
    const carrera = String(row[headerMap.carrera] || "").trim();
    const resolucion = String(row[headerMap.resolucion] || "").trim();

    // Exclusion rules
    if (horas === 0) {
      advertencias.push(`${codigo} (${grupo}): Excluida (0 horas)`);
      continue;
    }

    if (!tipoAulaRaw && horas > 0) {
      advertencias.push(`${codigo} (${grupo}): Excluida (sin tipo de aula)`);
      continue;
    }

    // Normalize turno
    let turno: Turno = "Mañana";
    if (turnoRaw.toLowerCase().includes("noche")) turno = "Noche";
    else if (turnoRaw.toLowerCase().includes("tarde")) turno = "Tarde";

    // Normalize tipo aula
    let tipoAula: TipoEspacio | null = null;
    if (tipoAulaRaw.includes("LAB")) tipoAula = "LABORATORIO";
    else if (tipoAulaRaw.includes("TALLER")) tipoAula = "TALLER";
    else if (tipoAulaRaw.includes("AULA")) tipoAula = "AULA";

    if (!tipoAula) {
      advertencias.push(`${codigo} (${grupo}): Tipo de aula no reconocido: "${tipoAulaRaw}"`);
      continue;
    }

    if (proyeccion > 50) {
      advertencias.push(`${codigo} (${grupo}): Proyección ${proyeccion} excede aforo máximo (50)`);
    }

    materias.push({
      escuela,
      carrera,
      resolucionMinisterial: resolucion || undefined,
      nombreAsignatura: nombre,
      codigo,
      grupoCodigo: grupo,
      turno,
      proyeccionInscritos: proyeccion,
      horasPorSemana: horas,
      semestre,
      tipoAula,
      gestion,
    });
  }

  return { materias, errores, advertencias };
}
