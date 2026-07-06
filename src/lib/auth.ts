import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const ROLE_TTL_MS = 30_000;
const globalForRoleCache = globalThis as unknown as {
  __pmsRoleCache?: Map<string, { role: Role; expires: number }>;
};
const roleCache =
  globalForRoleCache.__pmsRoleCache ??
  (globalForRoleCache.__pmsRoleCache = new Map());

async function getCachedRole(userId: string): Promise<Role | null> {
  const now = Date.now();
  const hit = roleCache.get(userId);
  if (hit && hit.expires > now) return hit.role;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!dbUser) return null;

  roleCache.set(userId, { role: dbUser.role, expires: now + ROLE_TTL_MS });
  return dbUser.role;
}

export function invalidateRoleCache(userId: string) {
  roleCache.delete(userId);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: Role }).role;
      }
      if (token.id) {
        try {
          const role = await getCachedRole(token.id as string);
          if (role) token.role = role;
        } catch {
          // DB error — keep existing token role
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      return session;
    },
  },
});
