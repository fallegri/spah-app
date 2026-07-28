import { auth } from "@/lib/auth";
import { db } from "@/db";
import { docentes, materiasCatalogo, espacios, ejecuciones } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";

export default async function DashboardPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;

  // Get counts
  const [docenteCount] = await db.select({ count: count() }).from(docentes);
  const [materiaCount] = await db.select({ count: count() }).from(materiasCatalogo);
  const [espacioCount] = await db.select({ count: count() }).from(espacios);

  // Get last execution
  const [lastExec] = await db
    .select()
    .from(ejecuciones)
    .orderBy(desc(ejecuciones.createdAt))
    .limit(1);

  const stats = [
    { label: "Docentes", value: docenteCount.count, color: "text-blue-400", bg: "bg-blue-600/10" },
    { label: "Materias", value: materiaCount.count, color: "text-emerald-400", bg: "bg-emerald-600/10" },
    { label: "Espacios", value: espacioCount.count, color: "text-purple-400", bg: "bg-purple-600/10" },
    {
      label: "Ultima ejecucion",
      value: lastExec ? `${lastExec.totalAsignadas} asignadas` : "Sin ejecuciones",
      color: "text-amber-400",
      bg: "bg-amber-600/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          {role === "docente" ? "Mi Panel" : "Panel de Administracion"}
        </h1>
        <p className="text-gray-400 mt-1">
          Bienvenido, {session?.user?.name}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`${stat.bg} border border-gray-800 rounded-xl p-5`}
          >
            <p className="text-sm text-gray-400">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      {role === "administrador" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Acciones rapidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <a
              href="/dashboard/carga"
              className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Cargar datos</p>
                <p className="text-xs text-gray-400">Excel de la gestion</p>
              </div>
            </a>

            <a
              href="/dashboard/scheduler"
              className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
            >
              <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Ejecutar scheduler</p>
                <p className="text-xs text-gray-400">Generar horarios</p>
              </div>
            </a>

            <a
              href="/dashboard/ai"
              className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
            >
              <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Asistente IA</p>
                <p className="text-xs text-gray-400">Consultar conflictos</p>
              </div>
            </a>
          </div>
        </div>
      )}

      {/* Last execution summary */}
      {lastExec && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Ultima ejecucion</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-gray-400">Asignadas</p>
              <p className="text-xl font-bold text-emerald-400">{lastExec.totalAsignadas}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Conflictos</p>
              <p className="text-xl font-bold text-red-400">{lastExec.totalConflictos}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">AIR</p>
              <p className="text-xl font-bold text-amber-400">{lastExec.totalAIR}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Sin docente</p>
              <p className="text-xl font-bold text-orange-400">{lastExec.totalSinDocente}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Duracion</p>
              <p className="text-xl font-bold text-gray-300">{lastExec.duracionMs}ms</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
