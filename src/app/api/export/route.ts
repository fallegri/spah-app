import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { ejecuciones, asignaciones, conflictos } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ejecucionId = req.nextUrl.searchParams.get("id");

  // Get execution (latest or specific)
  let exec;
  if (ejecucionId) {
    [exec] = await db.select().from(ejecuciones).where(eq(ejecuciones.id, parseInt(ejecucionId)));
  } else {
    [exec] = await db.select().from(ejecuciones).orderBy(desc(ejecuciones.createdAt)).limit(1);
  }

  if (!exec) {
    return NextResponse.json({ error: "No hay ejecuciones" }, { status: 404 });
  }

  const asigs = await db.select().from(asignaciones).where(eq(asignaciones.ejecucionId, exec.id));
  const confs = await db.select().from(conflictos).where(eq(conflictos.ejecucionId, exec.id));

  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen
  const resumen = [
    ["SPAH - Horario Generado"],
    ["Fecha", new Date(exec.createdAt).toLocaleString("es")],
    ["Gestion", exec.gestion],
    ["Total asignadas", exec.totalAsignadas],
    ["Total conflictos", exec.totalConflictos],
    ["AIR (sin espacio)", exec.totalAIR],
    ["Sin docente", exec.totalSinDocente],
    ["Duracion (ms)", exec.duracionMs],
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  // Sheet 2: Todas las asignaciones
  const headers = ["Materia", "Codigo", "Grupo", "Carrera", "Semestre", "Docente", "Espacio", "Dia", "Horario", "Turno", "Tipo", "AIR", "Sin Docente"];
  const rows = asigs.map((a) => [
    a.materiaNombre,
    a.materiaCodigo,
    a.grupoCodigo,
    a.carrera,
    a.semestre,
    a.docenteNombre || "Sin Docente",
    a.espacioCodigo || "AIR",
    a.dia,
    (a.slots as string[]).join(" - "),
    a.turno,
    a.tipoEspacio || "",
    a.esAIR ? "SI" : "",
    a.esSinDocente ? "SI" : "",
  ]);
  const wsAsig = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, wsAsig, "Asignaciones");

  // Sheet 3: Por carrera
  const carreras = [...new Set(asigs.map((a) => a.carrera))];
  for (const carrera of carreras.slice(0, 10)) {
    const carreraAsigs = asigs.filter((a) => a.carrera === carrera);
    const cHeaders = ["Codigo", "Materia", "Grupo", "Semestre", "Docente", "Espacio", "Dia", "Horario"];
    const cRows = carreraAsigs.map((a) => [
      a.materiaCodigo,
      a.materiaNombre,
      a.grupoCodigo,
      a.semestre,
      a.docenteNombre || "Sin Docente",
      a.espacioCodigo || "AIR",
      a.dia,
      (a.slots as string[]).join("-"),
    ]);
    const sheetName = carrera.substring(0, 28).replace(/[\/\\?*[\]]/g, "");
    const wsC = XLSX.utils.aoa_to_sheet([cHeaders, ...cRows]);
    XLSX.utils.book_append_sheet(wb, wsC, sheetName);
  }

  // Sheet 4: Pendientes AIR
  const airAsigs = asigs.filter((a) => a.esAIR);
  if (airAsigs.length > 0) {
    const airHeaders = ["Materia", "Codigo", "Grupo", "Docente", "Dia", "Horario", "Turno"];
    const airRows = airAsigs.map((a) => [
      a.materiaNombre, a.materiaCodigo, a.grupoCodigo,
      a.docenteNombre, a.dia, (a.slots as string[]).join("-"), a.turno,
    ]);
    const wsAir = XLSX.utils.aoa_to_sheet([airHeaders, ...airRows]);
    XLSX.utils.book_append_sheet(wb, wsAir, "Pendientes AIR");
  }

  // Sheet 5: Sin Docente
  const sinDoc = asigs.filter((a) => a.esSinDocente);
  if (sinDoc.length > 0) {
    const sdHeaders = ["Materia", "Codigo", "Grupo", "Espacio", "Dia", "Horario", "Turno"];
    const sdRows = sinDoc.map((a) => [
      a.materiaNombre, a.materiaCodigo, a.grupoCodigo,
      a.espacioCodigo, a.dia, (a.slots as string[]).join("-"), a.turno,
    ]);
    const wsSd = XLSX.utils.aoa_to_sheet([sdHeaders, ...sdRows]);
    XLSX.utils.book_append_sheet(wb, wsSd, "Sin Docente");
  }

  // Sheet 6: Conflictos
  if (confs.length > 0) {
    const confHeaders = ["Materia", "Codigo", "Grupo", "Carrera", "Semestre", "Sesion", "Motivo"];
    const confRows = confs.map((c) => [
      c.materiaNombre, c.materiaCodigo, c.grupoCodigo,
      c.carrera, c.semestre, c.sesionIndex, c.motivo,
    ]);
    const wsConf = XLSX.utils.aoa_to_sheet([confHeaders, ...confRows]);
    XLSX.utils.book_append_sheet(wb, wsConf, "Conflictos");
  }

  // Generate buffer
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="horario_${exec.gestion}_${exec.id}.xlsx"`,
    },
  });
}
