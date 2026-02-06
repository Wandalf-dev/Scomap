import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@scomap/db";
import { users, tenants } from "@scomap/db/schema";
import { eq, and } from "drizzle-orm";
import { getTenantSlug } from "../tenant";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Get tenant from subdomain
        const tenantSlug = await getTenantSlug();

        if (!tenantSlug) {
          // No tenant subdomain, can't authenticate
          return null;
        }

        // Find tenant by slug
        const tenant = await db
          .select()
          .from(tenants)
          .where(eq(tenants.slug, tenantSlug))
          .limit(1);

        if (tenant.length === 0) {
          return null;
        }

        // Find user by email and tenant
        const user = await db
          .select()
          .from(users)
          .where(and(eq(users.email, email), eq(users.tenantId, tenant[0].id)))
          .limit(1);

        if (user.length === 0) {
          return null;
        }

        const foundUser = user[0];

        if (!foundUser.passwordHash) {
          return null;
        }

        const passwordMatch = await compare(password, foundUser.passwordHash);

        if (!passwordMatch) {
          return null;
        }

        return {
          id: foundUser.id,
          email: foundUser.email,
          name: foundUser.name,
          tenantId: foundUser.tenantId,
          role: foundUser.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tenantId = (user as { tenantId: string }).tenantId;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  session: {
    strategy: "jwt",
  },
});
