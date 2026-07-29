import { db } from "@/db";
import { docentes, disponibilidadDocente, materiasHabilitadas } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { DocentesClient } from "./docentes-client";

export default async function DocentesPage() {
  const allDocentes = await db.select().from(docentes);

  // Get slot counts per docente
  const slotCounts = await db
    .select({
      docenteId: disponibilidadDocente.docenteId,
      count: count(),
    })
    .from(disponibilidadDocente)
    .groupBy(disponibilidadDocente.docenteId);

  // Get habilitacion counts per docente
  const habCounts = await db
    .select({
      docenteId: materiasHabilitadas.docenteId,
      count: count(),
    })
    .from(materiasHabilitadas)
    .groupBy(materiasHabilitadas.docenteId);

  const data = allDocentes.map((doc) => ({
    id: doc.id,
    ci: doc.ci,
    nombre: doc.nombre,
    profesion: doc.profesion || "",
    telefono: doc.telefono || "",
    slots: slotCounts.find((s) => s.docenteId === doc.id)?.count || 0,
    habs: habCounts.find((h) => h.docenteId === doc.id)?.count || 0,
  }));

  return <DocentesClient docentes={data} />;
}
