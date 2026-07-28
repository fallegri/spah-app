import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { disponibilidadDocente, docentes } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET - Get my availability (docente) or all (admin)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const gestion = req.nextUrl.searchParams.get("gestion") || "2026-II";
  const role = (session.user as any).role;
  const docenteId = (session.user as any).docenteId;

  if (role === "docente") {
    if (!docenteId) {
      return NextResponse.json({ error: "Docente no vinculado" }, { status: 400 });
    }

    const slots = await db
      .select()
      .from(disponibilidadDocente)
      .where(
        and(
          eq(disponibilidadDocente.docenteId, docenteId),
          eq(disponibilidadDocente.gestion, gestion)
        )
      );

    const [docente] = await db.select().from(docentes).where(eq(docentes.id, docenteId));

    return NextResponse.json({
      ok: true,
      docente: { ci: docente.ci, nombre: docente.nombre },
      disponibilidad: slots.map((s) => ({ dia: s.dia, slot: s.slot })),
    });
  }

  // Admin/asistente: return all
  const allSlots = await db
    .select()
    .from(disponibilidadDocente)
    .where(eq(disponibilidadDocente.gestion, gestion));

  return NextResponse.json({ ok: true, disponibilidad: allSlots });
}

// PUT - Update my availability (docente only)
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const role = (session.user as any).role;
  const docenteId = (session.user as any).docenteId;

  if (role !== "docente" || !docenteId) {
    return NextResponse.json({ error: "Solo docentes pueden actualizar su disponibilidad" }, { status: 403 });
  }

  const body = await req.json();
  const { gestion, slots } = body; // slots: [{dia, slot}]

  if (!gestion || !Array.isArray(slots)) {
    return NextResponse.json({ error: "gestion y slots son obligatorios" }, { status: 400 });
  }

  // Delete existing
  await db
    .delete(disponibilidadDocente)
    .where(
      and(
        eq(disponibilidadDocente.docenteId, docenteId),
        eq(disponibilidadDocente.gestion, gestion)
      )
    );

  // Insert new
  if (slots.length > 0) {
    await db.insert(disponibilidadDocente).values(
      slots.map((s: any) => ({
        docenteId,
        dia: s.dia,
        slot: s.slot,
        gestion,
      }))
    );
  }

  return NextResponse.json({ ok: true, total: slots.length });
}
