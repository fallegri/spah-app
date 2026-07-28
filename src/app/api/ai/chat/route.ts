import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { callAI, getDefaultAIConfig } from "@/lib/ai/provider";
import { db } from "@/db";
import { aiConfig, ejecuciones, asignaciones, conflictos, docentes, materiasCatalogo, espacios } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import type { AIMessage, AIProviderConfig } from "@/types/scheduler";

const SYSTEM_PROMPT = `Eres el asistente de IA del sistema SPAH (Sistema de Programación Automática de Horarios).
Tu rol es ayudar al administrador académico con:
1. Analizar conflictos de horarios y sugerir soluciones
2. Explicar por qué una materia no se pudo asignar
3. Recomendar redistribuciones para mejorar el horario
4. Responder consultas sobre la configuración del scheduler

Restricciones duras (HC) que nunca se violan:
- HC-01: Sin solapamiento de docente
- HC-02: Sin solapamiento de espacio
- HC-03: Solo bloques donde el docente está disponible
- HC-04: Solo materias habilitadas al docente
- HC-05: Sin solapamiento del grupo de estudiantes
- HC-06: Aforo suficiente
- HC-07: Max 3 periodos para aulas teóricas
- HC-08: Max 8 periodos diarios por grupo
- HC-09: Tipo de espacio debe coincidir
- HC-10: Respetar turno del catálogo
- HC-12: No usar espacios reservados externamente
- HC-13: Docente no puede dictar 2 materias al mismo paralelo

Responde en español, sé conciso y técnico. Usa los datos del contexto actual que se te proporcionan.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { messages, provider: requestProvider } = await req.json();

    // Get AI config
    let config: AIProviderConfig;
    if (requestProvider) {
      const [dbConfig] = await db.select().from(aiConfig).where(eq(aiConfig.provider, requestProvider)).limit(1);
      if (dbConfig) {
        config = { provider: dbConfig.provider as any, apiKey: dbConfig.apiKey || undefined, baseUrl: dbConfig.baseUrl || undefined, model: dbConfig.model };
      } else {
        config = getDefaultAIConfig();
      }
    } else {
      config = getDefaultAIConfig();
    }

    // ─── GATHER REAL CONTEXT FROM DATABASE ────────────────────────────────
    const [lastExec] = await db.select().from(ejecuciones).orderBy(desc(ejecuciones.createdAt)).limit(1);

    let contextData: any = { mensaje: "No hay ejecuciones registradas aún." };

    if (lastExec) {
      // Get assignments summary
      const asigs = await db.select().from(asignaciones).where(eq(asignaciones.ejecucionId, lastExec.id));
      const confs = await db.select().from(conflictos).where(eq(conflictos.ejecucionId, lastExec.id));

      // Group by carrera/semester
      const byCarrera: Record<string, number> = {};
      const bySemestre: Record<string, number> = {};
      const byDocente: Record<string, number> = {};
      const conflictosPorSemestre: Record<string, any[]> = {};

      for (const a of asigs) {
        byCarrera[a.carrera] = (byCarrera[a.carrera] || 0) + 1;
        bySemestre[a.semestre] = (bySemestre[a.semestre] || 0) + 1;
        const docKey = a.docenteNombre || "Sin Docente";
        byDocente[docKey] = (byDocente[docKey] || 0) + 1;
      }

      for (const c of confs) {
        const sem = c.semestre || "N/A";
        if (!conflictosPorSemestre[sem]) conflictosPorSemestre[sem] = [];
        conflictosPorSemestre[sem].push({ codigo: c.materiaCodigo, nombre: c.materiaNombre, grupo: c.grupoCodigo, motivo: c.motivo });
      }

      // Count totals from DB
      const [docenteCount] = await db.select({ count: count() }).from(docentes);
      const [materiaCount] = await db.select({ count: count() }).from(materiasCatalogo);
      const [espacioCount] = await db.select({ count: count() }).from(espacios);

      contextData = {
        ultimaEjecucion: {
          id: lastExec.id,
          gestion: lastExec.gestion,
          fecha: lastExec.createdAt.toISOString(),
          totalAsignadas: lastExec.totalAsignadas,
          totalConflictos: lastExec.totalConflictos,
          totalAIR: lastExec.totalAIR,
          totalSinDocente: lastExec.totalSinDocente,
          duracionMs: lastExec.duracionMs,
        },
        resumenGeneral: {
          totalDocentes: docenteCount.count,
          totalMaterias: materiaCount.count,
          totalEspacios: espacioCount.count,
        },
        asignadasPorCarrera: byCarrera,
        asignadasPorSemestre: bySemestre,
        cargaPorDocente: byDocente,
        conflictosPorSemestre,
        sesionesAIR: asigs.filter(a => a.esAIR).map(a => ({
          codigo: a.materiaCodigo, nombre: a.materiaNombre, grupo: a.grupoCodigo, dia: a.dia, horario: (a.slots as string[]).join("-")
        })),
        sesionesSinDocente: asigs.filter(a => a.esSinDocente).map(a => ({
          codigo: a.materiaCodigo, nombre: a.materiaNombre, grupo: a.grupoCodigo, espacio: a.espacioCodigo, dia: a.dia
        })),
      };
    }

    // Build messages
    const aiMessages: AIMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `DATOS ACTUALES DEL SISTEMA (consulta la base de datos en tiempo real):\n${JSON.stringify(contextData, null, 2)}` },
    ];

    for (const msg of messages) {
      aiMessages.push({ role: msg.role, content: msg.content });
    }

    const response = await callAI(aiMessages, config);

    return NextResponse.json({
      ok: true,
      response: response.content,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed,
    });
  } catch (error: any) {
    console.error("AI chat error:", error);
    return NextResponse.json({ error: `Error de IA: ${error.message}` }, { status: 500 });
  }
}
