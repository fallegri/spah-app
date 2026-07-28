import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { usuarios, docentes } from "@/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        const [user] = await db
          .select()
          .from(usuarios)
          .where(eq(usuarios.email, email))
          .limit(1);

        if (!user || !user.activo) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Get docente info if applicable
        let docenteInfo = null;
        if (user.docenteId) {
          const [doc] = await db
            .select()
            .from(docentes)
            .where(eq(docentes.id, user.docenteId))
            .limit(1);
          docenteInfo = doc || null;
        }

        return {
          id: String(user.id),
          email: user.email,
          name: user.nombre,
          role: user.rol,
          docenteId: user.docenteId,
          docenteCi: docenteInfo?.ci || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.docenteId = (user as any).docenteId;
        token.docenteCi = (user as any).docenteCi;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).docenteId = token.docenteId;
        (session.user as any).docenteCi = token.docenteCi;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60, // 12 hours
  },
});
