import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { callAI, getDefaultAIConfig } from "@/lib/ai/provider";
import { db } from "@/db";
import { aiConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { AIMessage, AIProviderConfig } from "@/types/scheduler";

const SYSTEM_PROMPT = `Eres el asistente de IA del sistema SPAH (Sistema de Programación Automática de Horarios).
Tu rol es ayudar al administrador académico con:
1. Analizar conflictos de horarios y sugerir soluciones
2. Explicar por qué una materia no se pudo asignar
3. Recomendar redistribuciones para mejorar el horario
4. Responder consultas sobre la configuración del scheduler

Contexto: El sistema asigna horarios a una universidad usando un algoritmo Greedy + Backtracking.
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

Responde en español, sé conciso y técnico.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { messages, provider: requestProvider, context } = await req.json();

    // Get AI config (from DB or env)
    let config: AIProviderConfig;

    if (requestProvider) {
      // Use specific provider from request
      const [dbConfig] = await db
        .select()
        .from(aiConfig)
        .where(eq(aiConfig.provider, requestProvider))
        .limit(1);

      if (dbConfig) {
        config = {
          provider: dbConfig.provider as any,
          apiKey: dbConfig.apiKey || undefined,
          baseUrl: dbConfig.baseUrl || undefined,
          model: dbConfig.model,
        };
      } else {
        config = getDefaultAIConfig();
      }
    } else {
      config = getDefaultAIConfig();
    }

    // Build messages with system prompt and context
    const aiMessages: AIMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (context) {
      aiMessages.push({
        role: "system",
        content: `Datos del contexto actual:\n${JSON.stringify(context, null, 2)}`,
      });
    }

    // Add user conversation
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
    return NextResponse.json(
      { error: `Error de IA: ${error.message}` },
      { status: 500 }
    );
  }
}
