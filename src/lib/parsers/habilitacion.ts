import * as XLSX from "xlsx";

interface HabilitacionParsed {
  ci: string;
  docente: string;
  materia: string;
  sigla: string;
  carrera: string;
}

interface ParseResult {
  habilitaciones: HabilitacionParsed[];
  errores: string[];
  advertencias: string[];
}

export function parseHabilitacion(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const habilitaciones: HabilitacionParsed[] = [];
  const errores: string[] = [];
  const advertencias: string[] = [];

  // Find header
  let headerIdx = -1;
  const headerMap: Record<string, number> = {};

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i].map((c: any) => String(c).trim().toUpperCase());
    if (row.includes("CI") || row.includes("SIGLA")) {
      headerIdx = i;
      row.forEach((cell: string, idx: number) => {
        if (cell === "CI" || cell === "C.I." || cell === "CÉDULA") headerMap.ci = idx;
        if (cell === "DOCENTE" || cell === "NOMBRE") headerMap.docente = idx;
        if (cell === "MATERIA" || cell === "NOMBRE MATERIA") headerMap.materia = idx;
        if (cell === "SIGLA" || cell === "CÓDIGO" || cell === "CODIGO") headerMap.sigla = idx;
        if (cell === "CARRERA") headerMap.carrera = idx;
      });
      break;
    }
  }

  if (headerIdx === -1 || headerMap.ci === undefined) {
    errores.push("No se encontró la columna CI en el archivo de habilitación");
    return { habilitaciones, errores, advertencias };
  }

  if (headerMap.sigla === undefined) {
    errores.push("No se encontró la columna SIGLA en el archivo de habilitación");
    return { habilitaciones, errores, advertencias };
  }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c: any) => !c)) continue;

    const ci = String(row[headerMap.ci] || "").trim();
    const sigla = String(row[headerMap.sigla] || "").trim();

    if (!ci || !sigla) continue;

    habilitaciones.push({
      ci,
      docente: String(row[headerMap.docente] || "").trim(),
      materia: String(row[headerMap.materia] || "").trim(),
      sigla,
      carrera: String(row[headerMap.carrera] || "").trim(),
    });
  }

  return { habilitaciones, errores, advertencias };
}
