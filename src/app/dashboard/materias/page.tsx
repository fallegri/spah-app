import { db } from "@/db";
import { materiasCatalogo } from "@/db/schema";
import { desc } from "drizzle-orm";

export default async function MateriasPage() {
  const materias = await db
    .select()
    .from(materiasCatalogo)
    .orderBy(materiasCatalogo.carrera, materiasCatalogo.semestre, materiasCatalogo.codigo);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Catalogo de Materias</h1>
          <p className="text-gray-400 mt-1">{materias.length} materias en la oferta academica</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Codigo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Asignatura</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Carrera</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Grupo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Semestre</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Horas/sem</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Turno</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tipo</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Inscritos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {materias.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No hay materias cargadas. Sube el archivo de catalogo.
                  </td>
                </tr>
              ) : (
                materias.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-800/50">
                    <td className="px-4 py-2.5 text-blue-400 font-mono text-xs">{m.codigo}</td>
                    <td className="px-4 py-2.5 text-white text-xs">{m.nombreAsignatura}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs max-w-[200px] truncate">{m.carrera}</td>
                    <td className="px-4 py-2.5 text-gray-300 font-mono text-xs">{m.grupoCodigo}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{m.semestre}</td>
                    <td className="px-4 py-2.5 text-center text-white font-semibold">{m.horasPorSemana}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs ${
                        m.turno === "Mañana" ? "text-amber-400" :
                        m.turno === "Tarde" ? "text-blue-400" : "text-purple-400"
                      }`}>
                        {m.turno}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        m.tipoAula === "LABORATORIO" ? "bg-blue-900/30 text-blue-400" :
                        m.tipoAula === "TALLER" ? "bg-purple-900/30 text-purple-400" :
                        "bg-gray-700 text-gray-300"
                      }`}>
                        {m.tipoAula || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-300">{m.proyeccionInscritos || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
