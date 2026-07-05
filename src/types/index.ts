import { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
  }
}

// NextAuth v5 uses @auth/core
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
