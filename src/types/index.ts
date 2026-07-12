import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
  }
}

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// Per-request workspace context resolved from the URL slug in the workspace layout
// and passed to server actions. See src/lib/authorization.ts#requireWorkspaceMember.
export type WorkspaceContext = {
  workspaceId: string;
  workspaceSlug: string;
  role: Role;
};
