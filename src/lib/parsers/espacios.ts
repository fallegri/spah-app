import * as XLSX from "xlsx";
import type { TipoEspacio } from "@/types/scheduler";

interface EspacioParsed {
  codigo: string;
  tipo: TipoEspacio;
  aforo: number;
  escuela: number;
}

interface ParseResult {
  espacios: EspacioParsed[];
  errores: string[];
  advertencias: string[];
}

export function parseEspacios(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });

  let sheetName = workbook.SheetNames.find(
    (n) => n.toLowerCase().includes("sala") || n.toLowerCase().includes("espacio")
  );
  if (!sheetName) sheetName = workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const espacios: EspacioParsed[] = [];
  const errores: string[] = [];
  const advertencias: string[] = [];

  // Find header row
  let headerIdx = -1;
  const headerMap: Record<string, number> = {};

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i].map((c: any) => String(c).trim().toUpperCase());
    if (row.includes("AULA") || row.includes("AFORO") || row.includes("TIPO")) {
      headerIdx = i;
      row.forEach((cell: string, idx: number) => {
        if (cell === "AULA" || cell === "SALA" || cell === "ESPACIO") headerMap.codigo = idx;
        if (cell === "AFORO" || cell === "CAPACIDAD") headerMap.aforo = idx;
        if (cell === "TIPO") headerMap.tipo = idx;
        if (cell === "ESCUELA") headerMap.escuela = idx;
      });
      break;
    }
  }

  if (headerIdx === -1) {
    errores.push("No se encontró la fila de encabezados en el archivo de espacios");
    return { espacios, errores, advertencias };
  }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c: any) => !c)) continue;

    const codigo = String(row[headerMap.codigo] || "").trim();
    if (!codigo) continue;

    const aforo = parseInt(String(row[headerMap.aforo] || "0"), 10);
    const tipoRaw = String(row[headerMap.tipo] || "").trim().toUpperCase();
    const escuela = parseInt(String(row[headerMap.escuela] || "1"), 10);

    let tipo: TipoEspacio;
    if (tipoRaw.includes("LAB")) tipo = "LABORATORIO";
    else if (tipoRaw.includes("TALLER")) tipo = "TALLER";
    else tipo = "AULA";

    if (aforo <= 0) {
      advertencias.push(`${codigo}: Aforo inválido (${aforo}), se establece en 1`);
    }

    espacios.push({
      codigo,
      tipo,
      aforo: Math.max(aforo, 1),
      escuela: Math.max(1, Math.min(4, escuela)),
    });
  }

  return { espacios, errores, advertencias };
}
