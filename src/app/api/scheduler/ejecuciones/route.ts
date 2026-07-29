import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { ejecuciones } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "administrador") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const data = await db
      .select({
        id: ejecuciones.id,
        gestion: ejecuciones.gestion,
        algoritmo: ejecuciones.algoritmo,
        totalAsignadas: ejecuciones.totalAsignadas,
        totalConflictos: ejecuciones.totalConflictos,
        totalAIR: ejecuciones.totalAIR,
        totalSinDocente: ejecuciones.totalSinDocente,
        duracionMs: ejecuciones.duracionMs,
        activa: ejecuciones.activa,
        createdAt: ejecuciones.createdAt,
      })
      .from(ejecuciones)
      .orderBy(desc(ejecuciones.createdAt))
      .limit(50);

    const serialized = data.map((e) => ({
      id: e.id,
      gestion: e.gestion,
      algoritmo: e.algoritmo || "iterativo",
      totalAsignadas: e.totalAsignadas || 0,
      totalConflictos: e.totalConflictos || 0,
      totalAIR: e.totalAIR || 0,
      totalSinDocente: e.totalSinDocente || 0,
      duracionMs: e.duracionMs || 0,
      activa: e.activa,
      createdAt: e.createdAt.toISOString(),
    }));

    return NextResponse.json(serialized);
  } catch (error: any) {
    console.error("Error fetching ejecuciones:", error);
    return NextResponse.json(
      { error: `Error obteniendo ejecuciones: ${error.message}` },
      { status: 500 }
    );
  }
}
