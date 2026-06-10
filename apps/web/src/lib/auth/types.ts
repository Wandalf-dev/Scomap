import "next-auth";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      tenantSlug: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    tenantId?: string;
    tenantSlug?: string;
    role?: string;
  }
}
