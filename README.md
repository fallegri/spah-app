# SPAH v2.0 - Sistema de Programacion Automatica de Horarios

Sistema full-stack para la programacion automatica de horarios academicos con asistente de IA multi-proveedor.

## Stack Tecnologico

| Componente | Tecnologia |
|---|---|
| Frontend | Next.js 16 (App Router) + Tailwind CSS |
| Backend/API | Next.js API Routes (serverless) |
| Base de datos | Neon (PostgreSQL serverless) + Drizzle ORM |
| Autenticacion | NextAuth.js v5 (JWT, roles) |
| Algoritmo | TypeScript - Greedy + Backtracking acotado |
| IA | NVIDIA NIM / OpenAI / Ollama (intercambiable) |
| Deploy | Vercel |

## Roles

- **Administrador**: Carga datos, configura y ejecuta el scheduler, exporta resultados, usa asistente IA
- **Docente**: Registra disponibilidad horaria interactivamente
- **Asistente**: Consulta horarios generados (solo lectura)

## Inicio Rapido

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tu DATABASE_URL de Neon y API keys

# 3. Push schema a la base de datos
pnpm db:push

# 4. Seed de datos de prueba (opcional)
pnpm db:seed

# 5. Iniciar en desarrollo
pnpm dev
```

## Despliegue en Vercel

```bash
# Instalar CLI de Vercel
npm i -g vercel

# Login y deploy
vercel login
vercel

# Configurar env vars en Vercel Dashboard:
# - DATABASE_URL
# - NEXTAUTH_SECRET
# - NVIDIA_API_KEY (u otros proveedores)

# Deploy a produccion
vercel --prod
```

## Algoritmo de Scheduling

El motor implementa:
- 13 restricciones duras (HC-01 a HC-13) - nunca se violan
- 4 restricciones blandas (SC-01 a SC-04) - optimizan calidad
- Comodines: AIR (espacio ficticio) y Sin Docente
- Backtracking acotado con permutaciones de dias
- Prioridad por dificultad y docentes prioritarios

## IA Multi-Proveedor

Configuracion dinamica de proveedores de IA:
- **NVIDIA NIM**: Llama 3.1 8B (default), Mistral, etc.
- **OpenAI**: GPT-4o, GPT-4o-mini
- **Ollama**: Cualquier modelo local

El asistente ayuda con:
- Analisis de conflictos
- Sugerencias de redistribucion
- Explicacion de decisiones del scheduler

## Estructura del Proyecto

```
src/
  app/
    api/           # API Routes (auth, upload, scheduler, ai, health)
    dashboard/     # Dashboard pages (admin, docente, asistente)
    login/         # Auth pages
  components/      # UI components
  db/              # Drizzle ORM schema + connection
  lib/
    ai/            # Multi-provider AI client
    parsers/       # Excel parsers (catalogo, espacios, habilitacion, disponibilidad)
    scheduler/     # Scheduling algorithm engine
  types/           # TypeScript types and constants
scripts/           # CLI scripts (create admin, seed)
```
