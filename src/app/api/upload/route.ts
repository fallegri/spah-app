import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  docentes,
  disponibilidadDocente,
  materiasHabilitadas,
  materiasCatalogo,
  espacios,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  parseCatalogo,
  parseEspacios,
  parseHabilitacion,
  parseDisponibilidadIndividual,
} from "@/lib/parsers";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "administrador") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const type = formData.get("type") as string;
    const gestion = formData.get("gestion") as string || "2026-II";

    if (!type) {
      return NextResponse.json({ error: "Tipo de archivo no especificado" }, { status: 400 });
    }

    switch (type) {
      case "catalogo": {
        const file = formData.get("file") as File;
        if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });

        const buffer = await file.arrayBuffer();
        const result = parseCatalogo(buffer, gestion);

        if (result.errores.length > 0) {
          return NextResponse.json({ ok: false, errores: result.errores }, { status: 400 });
        }

        // Upsert materias
        for (const m of result.materias) {
          await db
            .insert(materiasCatalogo)
            .values(m as any)
            .onConflictDoNothing();
        }

        return NextResponse.json({
          ok: true,
          total: result.materias.length,
          advertencias: result.advertencias,
        });
      }

      case "espacios": {
        const file = formData.get("file") as File;
        if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });

        const buffer = await file.arrayBuffer();
        const result = parseEspacios(buffer);

        if (result.errores.length > 0) {
          return NextResponse.json({ ok: false, errores: result.errores }, { status: 400 });
        }

        for (const e of result.espacios) {
          await db
            .insert(espacios)
            .values(e as any)
            .onConflictDoNothing();
        }

        return NextResponse.json({
          ok: true,
          total: result.espacios.length,
          advertencias: result.advertencias,
        });
      }

      case "habilitacion": {
        const file = formData.get("file") as File;
        if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });

        const buffer = await file.arrayBuffer();
        const result = parseHabilitacion(buffer);

        if (result.errores.length > 0) {
          return NextResponse.json({ ok: false, errores: result.errores }, { status: 400 });
        }

        // Group by CI and upsert docentes + habilitaciones
        const byCI = new Map<string, typeof result.habilitaciones>();
        for (const h of result.habilitaciones) {
          if (!byCI.has(h.ci)) byCI.set(h.ci, []);
          byCI.get(h.ci)!.push(h);
        }

        let docentesCreados = 0;
        let habCreadas = 0;

        for (const [ci, habs] of byCI) {
          // Ensure docente exists
          const [existing] = await db
            .select()
            .from(docentes)
            .where(eq(docentes.ci, ci))
            .limit(1);

          let docenteId: number;
          if (existing) {
            docenteId = existing.id;
          } else {
            const [created] = await db
              .insert(docentes)
              .values({
                ci,
                nombre: habs[0].docente || `Docente ${ci}`,
                gestion,
              })
              .returning();
            docenteId = created.id;
            docentesCreados++;
          }

          // Insert habilitaciones
          for (const h of habs) {
            await db
              .insert(materiasHabilitadas)
              .values({
                docenteId,
                sigla: h.sigla,
                nombreMateria: h.materia || null,
                carrera: h.carrera || null,
              })
              .onConflictDoNothing();
          }
          habCreadas += habs.length;
        }

        return NextResponse.json({
          ok: true,
          docentesCreados,
          habilitaciones: habCreadas,
          advertencias: result.advertencias,
        });
      }

      case "disponibilidad": {
        const files = formData.getAll("files") as File[];
        if (files.length === 0) {
          return NextResponse.json({ error: "No se recibieron archivos" }, { status: 400 });
        }

        const resultados: any[] = [];

        for (const file of files) {
          const buffer = await file.arrayBuffer();
          const result = parseDisponibilidadIndividual(buffer);

          if (result.errores.length > 0 || !result.docente) {
            resultados.push({ file: file.name, ok: false, errores: result.errores });
            continue;
          }

          const { ci, nombre, profesion, telefono, disponibilidad } = result.docente;

          // Ensure docente exists
          const [existing] = await db
            .select()
            .from(docentes)
            .where(eq(docentes.ci, ci))
            .limit(1);

          let docenteId: number;
          if (existing) {
            docenteId = existing.id;
            // Update info
            await db
              .update(docentes)
              .set({ nombre: nombre || existing.nombre, profesion, telefono })
              .where(eq(docentes.id, docenteId));
          } else {
            const [created] = await db
              .insert(docentes)
              .values({ ci, nombre, profesion, telefono, gestion })
              .returning();
            docenteId = created.id;
          }

          // Delete existing availability for this gestion
          await db
            .delete(disponibilidadDocente)
            .where(
              and(
                eq(disponibilidadDocente.docenteId, docenteId),
                eq(disponibilidadDocente.gestion, gestion)
              )
            );

          // Insert new availability
          if (disponibilidad.length > 0) {
            await db.insert(disponibilidadDocente).values(
              disponibilidad.map((d) => ({
                docenteId,
                dia: d.dia as any,
                slot: d.slot,
                gestion,
              }))
            );
          }

          resultados.push({
            file: file.name,
            ok: true,
            ci,
            nombre,
            slots: disponibilidad.length,
          });
        }

        return NextResponse.json({ ok: true, resultados });
      }

      default:
        return NextResponse.json({ error: `Tipo no soportado: ${type}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
