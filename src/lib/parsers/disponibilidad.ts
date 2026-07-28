import * as XLSX from "xlsx";
import type { Dia, DisponibilidadSlot } from "@/types/scheduler";
import { SLOTS, DIAS } from "@/types/scheduler";

interface DocenteDisponibilidad {
  ci: string;
  nombre: string;
  profesion: string;
  telefono: string;
  disponibilidad: DisponibilidadSlot[];
}

interface ParseResult {
  docente: DocenteDisponibilidad | null;
  errores: string[];
  advertencias: string[];
}

const CI_REGEX = /^c\.?i\.?:?$/i;
const MARCA_DISPONIBLE = /^(x|si|sí|1|true)$/i;

export function parseDisponibilidadIndividual(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });

  // Find correct sheet
  let sheetName = workbook.SheetNames.find(
    (n) =>
      n.toLowerCase().includes("presencial") ||
      n.toLowerCase().includes("disponibilidad")
  );
  if (!sheetName) sheetName = workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const errores: string[] = [];
  const advertencias: string[] = [];

  // Extract header fields
  let nombre = "";
  let ci = "";
  let profesion = "";
  let telefono = "";

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    if (!row) continue;

    for (let j = 0; j < row.length - 1; j++) {
      const cell = String(row[j] || "").trim();
      const nextCell = String(row[j + 1] || "").trim();

      if (cell.toLowerCase().includes("nombre") && !cell.toLowerCase().includes("asignatura")) {
        nombre = nextCell || nombre;
      }
      if (CI_REGEX.test(cell) || cell.toLowerCase().includes("cédula") || cell.toLowerCase().includes("cedula")) {
        ci = nextCell || ci;
      }
      if (cell.toLowerCase().includes("profesión") || cell.toLowerCase().includes("profesion")) {
        profesion = nextCell || profesion;
      }
      if (cell.toLowerCase().includes("teléfono") || cell.toLowerCase().includes("telefono") || cell.toLowerCase().includes("celular")) {
        telefono = nextCell || telefono;
      }
    }
  }

  if (!ci) {
    errores.push("No se encontró el CI del docente en el archivo");
    return { docente: null, errores, advertencias };
  }

  // Find grid start (row with "Lunes")
  let gridStartRow = -1;
  let dayColumns: Record<string, number> = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || "").trim().toLowerCase();
      if (cell === "lunes") {
        gridStartRow = i;
        // Map day columns
        for (let k = j; k < row.length; k++) {
          const dayCell = String(row[k] || "").trim();
          const dayMatch = DIAS.find(
            (d) => d.toLowerCase() === dayCell.toLowerCase() || 
                   dayCell.toLowerCase().startsWith(d.toLowerCase().substring(0, 3))
          );
          if (dayMatch) {
            dayColumns[dayMatch] = k;
          }
        }
        break;
      }
    }
    if (gridStartRow >= 0) break;
  }

  if (gridStartRow < 0) {
    errores.push("No se encontró la grilla de disponibilidad (fila con 'Lunes')");
    return { docente: null, errores, advertencias };
  }

  // Parse availability grid
  const disponibilidad: DisponibilidadSlot[] = [];

  for (let i = gridStartRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    // Find the time label in this row
    const timeCell = String(row[0] || row[1] || "").trim();
    const slot = parseTimeToSlot(timeCell);
    if (!slot) continue;

    for (const [dia, col] of Object.entries(dayColumns)) {
      const cell = String(row[col] || "").trim();
      if (MARCA_DISPONIBLE.test(cell)) {
        disponibilidad.push({ dia: dia as Dia, slot });
      }
    }
  }

  return {
    docente: { ci, nombre, profesion, telefono, disponibilidad },
    errores,
    advertencias,
  };
}

function parseTimeToSlot(timeStr: string): string | null {
  if (!timeStr) return null;

  // Try to match patterns like "7.46 a 8.30", "07:45", "7:45 - 8:30"
  const match = timeStr.match(/(\d{1,2})[.:h](\d{2})/);
  if (!match) return null;

  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const totalMinutes = hour * 60 + minute;

  // Find the closest slot within ±2 minutes
  for (const slot of SLOTS) {
    const [sh, sm] = slot.split(":").map(Number);
    const slotMinutes = sh * 60 + sm;
    if (Math.abs(totalMinutes - slotMinutes) <= 2) {
      return slot;
    }
  }

  // Try matching to nearest slot
  let closest = SLOTS[0];
  let minDiff = Infinity;
  for (const slot of SLOTS) {
    const [sh, sm] = slot.split(":").map(Number);
    const diff = Math.abs(totalMinutes - (sh * 60 + sm));
    if (diff < minDiff) {
      minDiff = diff;
      closest = slot;
    }
  }

  if (minDiff <= 10) return closest;
  return null;
}
