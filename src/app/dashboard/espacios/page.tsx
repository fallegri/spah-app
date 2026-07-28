import { db } from "@/db";
import { espacios } from "@/db/schema";

export default async function EspaciosPage() {
  const allEspacios = await db.select().from(espacios).orderBy(espacios.tipo, espacios.codigo);

  const escuelaNames: Record<number, string> = { 1: "EIT", 2: "EI", 3: "EGT", 4: "EAN" };

  // Group counts
  const byTipo = {
    AULA: allEspacios.filter((e) => e.tipo === "AULA").length,
    TALLER: allEspacios.filter((e) => e.tipo === "TALLER").length,
    LABORATORIO: allEspacios.filter((e) => e.tipo === "LABORATORIO").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Espacios Fisicos</h1>
          <p className="text-gray-400 mt-1">{allEspacios.length} espacios registrados</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400">Aulas</p>
          <p className="text-2xl font-bold text-gray-300 mt-1">{byTipo.AULA}</p>
        </div>
        <div className="bg-purple-900/10 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400">Talleres</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">{byTipo.TALLER}</p>
        </div>
        <div className="bg-blue-900/10 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400">Laboratorios</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{byTipo.LABORATORIO}</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Codigo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tipo</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Aforo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Escuela</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Activo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {allEspacios.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No hay espacios cargados. Sube el archivo de espacios y aforo.
                  </td>
                </tr>
              ) : (
                allEspacios.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-800/50">
                    <td className="px-4 py-2.5 text-white font-mono text-xs">{e.codigo}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        e.tipo === "LABORATORIO" ? "bg-blue-900/30 text-blue-400" :
                        e.tipo === "TALLER" ? "bg-purple-900/30 text-purple-400" :
                        "bg-gray-700 text-gray-300"
                      }`}>
                        {e.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-white font-semibold">{e.aforo}</td>
                    <td className="px-4 py-2.5 text-gray-400">{escuelaNames[e.escuela] || e.escuela}</td>
                    <td className="px-4 py-2.5 text-center">
                      {e.activo ? (
                        <span className="text-emerald-400">●</span>
                      ) : (
                        <span className="text-red-400">●</span>
                      )}
                    </td>
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
