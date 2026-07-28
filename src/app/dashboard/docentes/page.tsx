import { db } from "@/db";
import { docentes, disponibilidadDocente, materiasHabilitadas } from "@/db/schema";
import { eq, count, sql } from "drizzle-orm";

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

  const slotMap = new Map(slotCounts.map((s) => [s.docenteId, s.count]));
  const habMap = new Map(habCounts.map((h) => [h.docenteId, h.count]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Docentes</h1>
          <p className="text-gray-400 mt-1">{allDocentes.length} docentes registrados</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">CI</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Profesion</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Telefono</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Slots disponibles</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Materias habilitadas</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {allDocentes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No hay docentes cargados. Sube los archivos de disponibilidad y habilitacion.
                  </td>
                </tr>
              ) : (
                allDocentes.map((doc) => {
                  const slots = slotMap.get(doc.id) || 0;
                  const habs = habMap.get(doc.id) || 0;
                  const estado = slots > 0 && habs > 0 ? "completo" : slots > 0 ? "sin habilitacion" : habs > 0 ? "sin disponibilidad" : "incompleto";

                  return (
                    <tr key={doc.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-gray-300 font-mono text-xs">{doc.ci}</td>
                      <td className="px-4 py-3 text-white">{doc.nombre}</td>
                      <td className="px-4 py-3 text-gray-400">{doc.profesion || "—"}</td>
                      <td className="px-4 py-3 text-gray-400">{doc.telefono || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-semibold ${slots > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {slots}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-semibold ${habs > 0 ? "text-blue-400" : "text-red-400"}`}>
                          {habs}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          estado === "completo"
                            ? "bg-emerald-900/30 text-emerald-400"
                            : estado === "incompleto"
                            ? "bg-red-900/30 text-red-400"
                            : "bg-amber-900/30 text-amber-400"
                        }`}>
                          {estado}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
