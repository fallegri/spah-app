import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import bcrypt from "bcryptjs";
import * as schema from "../src/db/schema";
import dotenv from "dotenv";
import readline from "readline";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log("\n=== SPAH - Crear Primer Administrador ===\n");

  const email = await ask("Email: ");
  const nombre = await ask("Nombre completo: ");
  const password = await ask("Contrasena (min 8 caracteres): ");

  if (password.length < 8) {
    console.error("Error: La contrasena debe tener al menos 8 caracteres");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const [user] = await db
      .insert(schema.usuarios)
      .values({
        email,
        nombre,
        passwordHash,
        rol: "administrador",
        activo: true,
      })
      .returning();

    console.log("\nAdministrador creado exitosamente:");
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Nombre: ${user.nombre}`);
    console.log(`  Rol: ${user.rol}`);
  } catch (error: any) {
    if (error.message?.includes("unique")) {
      console.error("\nError: Ya existe un usuario con ese email");
    } else {
      console.error("\nError:", error.message);
    }
  }

  rl.close();
}

main();
