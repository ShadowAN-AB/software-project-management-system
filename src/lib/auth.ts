import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// Per-(user, workspace) role cache with 30s TTL. Same globalThis pattern as prisma.ts.
// Any code path that mutates WorkspaceMember.role or deletes a membership MUST call
// invalidateWorkspaceRoleCache(userId, workspaceId) so the change is visible immediately.
const ROLE_TTL_MS = 30_000;
const globalForRoleCache = globalThis as unknown as {
  __pmsWorkspaceRoleCache?: Map<string, { role: Role; expires: number }>;
};
const roleCache =
  globalForRoleCache.__pmsWorkspaceRoleCache ??
  (globalForRoleCache.__pmsWorkspaceRoleCache = new Map());

function cacheKey(userId: string, workspaceId: string) {
  return `${userId}:${workspaceId}`;
}

export async function getCachedWorkspaceRole(
  userId: string,
  workspaceId: string
): Promise<Role | null> {
  const now = Date.now();
  const key = cacheKey(userId, workspaceId);
  const hit = roleCache.get(key);
  if (hit && hit.expires > now) return hit.role;

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  if (!member) return null;

  roleCache.set(key, { role: member.role, expires: now + ROLE_TTL_MS });
  return member.role;
}

export function invalidateWorkspaceRoleCache(userId: string, workspaceId: string) {
  roleCache.delete(cacheKey(userId, workspaceId));
}

export function invalidateAllWorkspaceRolesForUser(userId: string) {
  const prefix = `${userId}:`;
  for (const key of roleCache.keys()) {
    if (key.startsWith(prefix)) roleCache.delete(key);
  }
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
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      return session;
    },
  },
});
