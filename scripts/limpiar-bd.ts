/**
 * Script para limpiar la base de datos SPAH.
 * Elimina TODOS los datos EXCEPTO el usuario administrador.
 * 
 * Uso: npx tsx scripts/limpiar-bd.ts
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, ne, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connection = neon(process.env.DATABASE_URL!);
const db = drizzle(connection, { schema });

async function main() {
  console.log("=== LIMPIEZA DE BASE DE DATOS SPAH ===\n");
  console.log("Se conservará UNICAMENTE el usuario administrador.\n");

  // Order matters due to foreign keys (delete children first)

  // 1. Delete conflictos (depends on ejecuciones)
  const delConflictos = await db.delete(schema.conflictos).returning();
  console.log(`[1/8] Conflictos eliminados: ${delConflictos.length}`);

  // 2. Delete asignaciones (depends on ejecuciones, docentes, espacios)
  const delAsignaciones = await db.delete(schema.asignaciones).returning();
  console.log(`[2/8] Asignaciones eliminadas: ${delAsignaciones.length}`);

  // 3. Delete ejecuciones (depends on usuarios)
  const delEjecuciones = await db.delete(schema.ejecuciones).returning();
  console.log(`[3/8] Ejecuciones eliminadas: ${delEjecuciones.length}`);

  // 4. Delete reservas externas (depends on espacios)
  const delReservas = await db.delete(schema.reservasEspacios).returning();
  console.log(`[4/8] Reservas externas eliminadas: ${delReservas.length}`);

  // 5. Delete materias catalogo
  const delCatalogo = await db.delete(schema.materiasCatalogo).returning();
  console.log(`[5/8] Materias catálogo eliminadas: ${delCatalogo.length}`);

  // 6. Delete disponibilidad docente (depends on docentes)
  const delDisp = await db.delete(schema.disponibilidadDocente).returning();
  console.log(`[6/8] Disponibilidad docente eliminada: ${delDisp.length}`);

  // 7. Delete materias habilitadas (depends on docentes)
  const delHab = await db.delete(schema.materiasHabilitadas).returning();
  console.log(`[7/8] Materias habilitadas eliminadas: ${delHab.length}`);

  // 8. Delete docentes and their user accounts (non-admin)
  // First delete non-admin users (docente users)
  const delUsuarios = await db
    .delete(schema.usuarios)
    .where(ne(schema.usuarios.rol, "administrador"))
    .returning();
  console.log(`[8a/8] Usuarios no-admin eliminados: ${delUsuarios.length}`);

  // Then delete docentes
  const delDocentes = await db.delete(schema.docentes).returning();
  console.log(`[8b/8] Docentes eliminados: ${delDocentes.length}`);

  // 9. Delete espacios
  const delEspacios = await db.delete(schema.espacios).returning();
  console.log(`[9/8] Espacios eliminados: ${delEspacios.length}`);

  // 10. Delete AI config (optional, cleanup)
  const delAI = await db.delete(schema.aiConfig).returning();
  console.log(`[10/8] AI Config eliminados: ${delAI.length}`);

  // Verify admin still exists
  const admins = await db
    .select({ id: schema.usuarios.id, email: schema.usuarios.email, rol: schema.usuarios.rol })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.rol, "administrador"));

  console.log(`\n=== LIMPIEZA COMPLETADA ===`);
  console.log(`Usuarios admin preservados: ${admins.length}`);
  for (const a of admins) {
    console.log(`  → ${a.email} (id: ${a.id})`);
  }
  console.log(`\nLa BD está lista para cargar nuevos datos de prueba.`);
}

main().catch((err) => {
  console.error("Error durante la limpieza:", err);
  process.exit(1);
});
