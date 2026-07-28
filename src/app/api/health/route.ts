import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ ok: true, db: "no configurada" });
    }

    const sql = neon(process.env.DATABASE_URL);
    await sql`SELECT 1`;

    return NextResponse.json({ ok: true, db: "conectado" });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, db: "error", message: error.message },
      { status: 500 }
    );
  }
}
