import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { docentes, disponibilidadDocente } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nombre = searchParams.get("nombre");
  const docenteId = searchParams.get("id");

  if (!nombre && !docenteId) {
    return NextResponse.json({ error: "Se requiere nombre o id del docente" }, { status: 400 });
  }

  try {
    let docente;
    if (docenteId) {
      [docente] = await db.select().from(docentes).where(eq(docentes.id, parseInt(docenteId)));
    } else {
      const all = await db.select().from(docentes);
      docente = all.find((d) =>
        d.nombre.toLowerCase().includes((nombre || "").toLowerCase())
      );
    }

    if (!docente) {
      return NextResponse.json({ error: "Docente no encontrado" }, { status: 404 });
    }

    const slots = await db
      .select()
      .from(disponibilidadDocente)
      .where(eq(disponibilidadDocente.docenteId, docente.id));

    return NextResponse.json({
      docente: { id: docente.id, ci: docente.ci, nombre: docente.nombre },
      totalSlots: slots.length,
      disponibilidad: slots.map((s) => ({ dia: s.dia, slot: s.slot, gestion: s.gestion })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
