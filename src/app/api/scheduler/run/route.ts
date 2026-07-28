import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { ejecutarScheduler } from "@/lib/scheduler/engine";
import {
  docentes,
  disponibilidadDocente,
  materiasHabilitadas,
  materiasCatalogo,
  espacios,
  reservasEspacios,
  ejecuciones,
  asignaciones as asignacionesTable,
  conflictos as conflictosTable,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import type {
  Docente,
  MateriaCatalogo,
  Espacio,
  ReservaExterna,
  SchedulerConfig,
  DisponibilidadSlot,
  MateriaHabilitada,
  Dia,
  Turno,
  TipoEspacio,
} from "@/types/scheduler";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "administrador") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const config: SchedulerConfig = body.config;
    const gestion: string = body.gestion;

    if (!config || !gestion) {
      return NextResponse.json(
        { error: "Faltan parámetros: config y gestion son obligatorios" },
        { status: 400 }
      );
    }

    // Load all data from DB
    const [docentesData, catalogoData, espaciosData, reservasData] = await Promise.all([
      loadDocentes(gestion),
      loadCatalogo(gestion),
      loadEspacios(),
      loadReservas(gestion),
    ]);

    // Execute scheduler
    const result = ejecutarScheduler(docentesData, catalogoData, espaciosData, reservasData, config);

    // Save execution
    const [ejecucion] = await db
      .insert(ejecuciones)
      .values({
        usuarioId: parseInt((session.user as any).id),
        gestion,
        configuracion: config,
        totalAsignadas: result.totalAsignadas,
        totalConflictos: result.totalConflictos,
        totalAIR: result.totalAIR,
        totalSinDocente: result.totalSinDocente,
        duracionMs: result.duracionMs,
        activa: true,
        log: result.log.join("\n"),
      })
      .returning();

    // Deactivate previous active executions
    // (handled by trigger or here manually if needed)

    // Save assignments
    if (result.asignaciones.length > 0) {
      const chunks = chunkArray(result.asignaciones, 100);
      for (const chunk of chunks) {
        await db.insert(asignacionesTable).values(
          chunk.map((a) => ({
            ejecucionId: ejecucion.id,
            materiaCodigo: a.materiaCodigo,
            materiaNombre: a.materiaNombre,
            grupoCodigo: a.grupoCodigo,
            carrera: a.carrera,
            semestre: a.semestre,
            docenteId: a.docenteId,
            docenteNombre: a.docenteNombre,
            espacioId: a.espacioId,
            espacioCodigo: a.espacioCodigo,
            dia: a.dia as any,
            slots: a.slots,
            turno: a.turno as any,
            tipoEspacio: a.tipoEspacio as any,
            esAIR: a.esAIR,
            esSinDocente: a.esSinDocente,
            sesionIndex: a.sesionIndex,
          }))
        );
      }
    }

    // Save conflicts
    if (result.conflictos.length > 0) {
      await db.insert(conflictosTable).values(
        result.conflictos.map((c) => ({
          ejecucionId: ejecucion.id,
          materiaCodigo: c.materiaCodigo,
          materiaNombre: c.materiaNombre,
          grupoCodigo: c.grupoCodigo,
          carrera: c.carrera,
          semestre: c.semestre,
          sesionIndex: c.sesionIndex,
          motivo: c.motivo,
        }))
      );
    }

    return NextResponse.json({
      ok: true,
      ejecucionId: ejecucion.id,
      resultado: {
        totalAsignadas: result.totalAsignadas,
        totalConflictos: result.totalConflictos,
        totalAIR: result.totalAIR,
        totalSinDocente: result.totalSinDocente,
        duracionMs: result.duracionMs,
      },
    });
  } catch (error: any) {
    console.error("Scheduler error:", error);
    return NextResponse.json(
      { error: `Error ejecutando scheduler: ${error.message}` },
      { status: 500 }
    );
  }
}

// ─── DATA LOADERS ───────────────────────────────────────────────────────────

async function loadDocentes(gestion: string): Promise<Docente[]> {
  const allDocentes = await db.select().from(docentes);
  const allDisp = await db
    .select()
    .from(disponibilidadDocente)
    .where(eq(disponibilidadDocente.gestion, gestion));
  const allHab = await db.select().from(materiasHabilitadas);

  return allDocentes.map((d) => ({
    id: d.id,
    ci: d.ci,
    nombre: d.nombre,
    profesion: d.profesion || undefined,
    telefono: d.telefono || undefined,
    disponibilidad: allDisp
      .filter((disp) => disp.docenteId === d.id)
      .map((disp) => ({ dia: disp.dia as Dia, slot: disp.slot })),
    materiasHabilitadas: allHab
      .filter((mh) => mh.docenteId === d.id)
      .map((mh) => ({
        sigla: mh.sigla,
        nombreMateria: mh.nombreMateria || undefined,
        carrera: mh.carrera || undefined,
      })),
  }));
}

async function loadCatalogo(gestion: string): Promise<MateriaCatalogo[]> {
  const data = await db
    .select()
    .from(materiasCatalogo)
    .where(eq(materiasCatalogo.gestion, gestion));

  return data.map((m) => ({
    id: m.id,
    escuela: m.escuela,
    carrera: m.carrera,
    resolucionMinisterial: m.resolucionMinisterial || undefined,
    nombreAsignatura: m.nombreAsignatura,
    codigo: m.codigo,
    grupoCodigo: m.grupoCodigo,
    turno: m.turno as Turno,
    proyeccionInscritos: m.proyeccionInscritos || 0,
    horasPorSemana: m.horasPorSemana,
    semestre: m.semestre,
    tipoAula: m.tipoAula as TipoEspacio | null,
  }));
}

async function loadEspacios(): Promise<Espacio[]> {
  const data = await db.select().from(espacios).where(eq(espacios.activo, true));
  return data.map((e) => ({
    id: e.id,
    codigo: e.codigo,
    tipo: e.tipo as TipoEspacio,
    aforo: e.aforo,
    escuela: e.escuela,
  }));
}

async function loadReservas(gestion: string): Promise<ReservaExterna[]> {
  const data = await db
    .select()
    .from(reservasEspacios)
    .where(eq(reservasEspacios.gestion, gestion));

  return data.map((r) => ({
    espacioId: r.espacioId,
    espacioCodigo: "",
    dia: r.dia as Dia,
    slot: r.slot,
  }));
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
