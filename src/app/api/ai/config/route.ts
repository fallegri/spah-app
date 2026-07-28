import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { aiConfig } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET - List AI providers configured
export async function GET() {
  const session = await auth();
  if (!session || (session.user as any).role !== "administrador") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const configs = await db.select().from(aiConfig);

  // Mask API keys
  const masked = configs.map((c) => ({
    ...c,
    apiKey: c.apiKey ? `${c.apiKey.slice(0, 8)}...${c.apiKey.slice(-4)}` : null,
  }));

  return NextResponse.json({ ok: true, providers: masked });
}

// POST - Add/Update AI provider
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "administrador") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const { provider, apiKey, baseUrl, model, activo } = body;

  if (!provider || !model) {
    return NextResponse.json(
      { error: "provider y model son obligatorios" },
      { status: 400 }
    );
  }

  // Check if exists
  const [existing] = await db
    .select()
    .from(aiConfig)
    .where(eq(aiConfig.provider, provider))
    .limit(1);

  if (existing) {
    await db
      .update(aiConfig)
      .set({
        apiKey: apiKey || existing.apiKey,
        baseUrl: baseUrl || existing.baseUrl,
        model,
        activo: activo !== undefined ? activo : existing.activo,
        updatedAt: new Date(),
      })
      .where(eq(aiConfig.id, existing.id));
  } else {
    await db.insert(aiConfig).values({
      provider,
      apiKey: apiKey || null,
      baseUrl: baseUrl || null,
      model,
      activo: activo !== undefined ? activo : true,
    });
  }

  return NextResponse.json({ ok: true, message: `Proveedor ${provider} configurado` });
}
