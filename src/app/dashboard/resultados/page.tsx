import { db } from "@/db";
import { ejecuciones, asignaciones, conflictos } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { SLOTS, DIAS } from "@/types/scheduler";

export default async function ResultadosPage() {
  const session = await auth();

  // Get latest active execution
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
          <p className="text-sm text-gray-500 mt-1">Ejecuta el scheduler primero.</p>
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

  // Group by carrera
  const byCarrera = new Map<string, typeof asigs>();
  for (const a of asigs) {
    if (!byCarrera.has(a.carrera)) byCarrera.set(a.carrera, []);
    byCarrera.get(a.carrera)!.push(a);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Resultados</h1>
          <p className="text-gray-400 mt-1">
            Ejecucion #{exec.id} &middot; {new Date(exec.createdAt).toLocaleString("es")}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Asignadas" value={exec.totalAsignadas || 0} color="emerald" />
        <StatCard label="Conflictos" value={exec.totalConflictos || 0} color="red" />
        <StatCard label="AIR" value={exec.totalAIR || 0} color="amber" />
        <StatCard label="Sin docente" value={exec.totalSinDocente || 0} color="orange" />
        <StatCard label="Duracion" value={`${exec.duracionMs}ms`} color="blue" />
      </div>

      {/* By Carrera */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Asignaciones por carrera</h2>
        <div className="space-y-2">
          {Array.from(byCarrera.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([carrera, asigList]) => (
              <div key={carrera} className="flex items-center justify-between py-2 px-3 bg-gray-800 rounded-lg">
                <span className="text-sm text-gray-300">{carrera}</span>
                <span className="text-sm font-semibold text-blue-400">{asigList.length} sesiones</span>
              </div>
            ))}
        </div>
      </div>

      {/* AIR sessions */}
      {asigs.filter((a) => a.esAIR).length > 0 && (
        <div className="bg-amber-900/10 border border-amber-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-amber-400 mb-3">Sesiones AIR (pendientes de espacio)</h2>
          <div className="space-y-1.5">
            {asigs.filter((a) => a.esAIR).map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-1.5 px-3 bg-gray-800/50 rounded text-xs">
                <span className="text-gray-400">{a.materiaCodigo}</span>
                <span className="text-white">{a.materiaNombre}</span>
                <span className="text-gray-500">{a.grupoCodigo}</span>
                <span className="text-gray-500">{a.dia} {(a.slots as string[])?.[0]}</span>
                <span className="text-amber-400">{a.docenteNombre}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conflicts */}
      {confs.length > 0 && (
        <div className="bg-red-900/10 border border-red-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-red-400 mb-3">Conflictos ({confs.length})</h2>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {confs.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-1.5 px-3 bg-gray-800/50 rounded text-xs">
                <span className="text-gray-400">{c.materiaCodigo}</span>
                <span className="text-white">{c.materiaNombre}</span>
                <span className="text-gray-500">{c.grupoCodigo}</span>
                <span className="text-red-300 flex-1 text-right">{c.motivo}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: any; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-600/10",
    red: "text-red-400 bg-red-600/10",
    amber: "text-amber-400 bg-amber-600/10",
    orange: "text-orange-400 bg-orange-600/10",
    blue: "text-blue-400 bg-blue-600/10",
  };
  const classes = colorMap[color] || colorMap.blue;

  return (
    <div className={`${classes.split(" ")[1]} border border-gray-800 rounded-xl p-4`}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${classes.split(" ")[0]}`}>{value}</p>
    </div>
  );
}
