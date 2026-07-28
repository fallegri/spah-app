import { db } from "@/db";
import { ejecuciones, asignaciones, conflictos } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { ResultsClient } from "./results-client";

export default async function ResultadosPage() {
  const session = await auth();

  const [exec] = await db
    .select()
    .from(ejecuciones)
    .orderBy(desc(ejecuciones.createdAt))
    .limit(1);

  if (!exec) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Resultados</h1>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400">No hay ejecuciones registradas.</p>
          <p className="text-sm text-gray-500 mt-1">Ejecuta el scheduler primero desde la seccion Ejecutar.</p>
        </div>
      </div>
    );
  }

  const asigs = await db
    .select()
    .from(asignaciones)
    .where(eq(asignaciones.ejecucionId, exec.id));

  const confs = await db
    .select()
    .from(conflictos)
    .where(eq(conflictos.ejecucionId, exec.id));

  // Serialize for client component
  const data = {
    ejecucion: {
      id: exec.id,
      gestion: exec.gestion,
      totalAsignadas: exec.totalAsignadas || 0,
      totalConflictos: exec.totalConflictos || 0,
      totalAIR: exec.totalAIR || 0,
      totalSinDocente: exec.totalSinDocente || 0,
      duracionMs: exec.duracionMs || 0,
      createdAt: exec.createdAt.toISOString(),
    },
    asignaciones: asigs.map((a) => ({
      id: a.id,
      materiaCodigo: a.materiaCodigo,
      materiaNombre: a.materiaNombre,
      grupoCodigo: a.grupoCodigo,
      carrera: a.carrera,
      semestre: a.semestre,
      docenteNombre: a.docenteNombre || "Sin Docente",
      espacioCodigo: a.espacioCodigo || "AIR",
      dia: a.dia,
      slots: a.slots as string[],
      turno: a.turno,
      tipoEspacio: a.tipoEspacio,
      esAIR: a.esAIR,
      esSinDocente: a.esSinDocente,
    })),
    conflictos: confs.map((c) => ({
      id: c.id,
      materiaCodigo: c.materiaCodigo,
      materiaNombre: c.materiaNombre,
      grupoCodigo: c.grupoCodigo,
      carrera: c.carrera || "",
      semestre: c.semestre || "",
      motivo: c.motivo,
    })),
  };

  return <ResultsClient data={data} />;
}
