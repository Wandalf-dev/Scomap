import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@scomap/db";
import { users, tenants } from "@scomap/db/schema";
import { eq, and } from "drizzle-orm";
import { getTenantSlug } from "../tenant";

// bcrypt hash (cost 12) of a dummy value: compared when the email does not exist
// so that the response time does not reveal whether the account exists.
const DUMMY_HASH =
  "$2b$12$XyfTot6daCHosRDk1qa8CubGvQYg1OJ63HCOP35qJbyzTrlaPxenS";

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
          await compare(password, DUMMY_HASH); // equalise timing
          return null;
        }

        const foundUser = user[0];

        if (!foundUser.passwordHash) {
          await compare(password, DUMMY_HASH); // equalise timing
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
          tenantSlug: tenant[0].slug,
          role: foundUser.role,
        };
      },
    }),
  ],
  callbacks: {
    // Multi-tenant by subdomain: Auth.js rebuilds absolute URLs from the host
    // it sees, which in dev (and behind some proxies) is the bind address
    // (localhost:3000) — the post-login redirect would then leave the tenant
    // subdomain and lose the session cookie. Returning RELATIVE paths keeps
    // the browser on the subdomain that initiated the sign-in.
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return url;
      const parsed = new URL(url);
      if (parsed.origin === baseUrl) return parsed.pathname + parsed.search;
      return "/";
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tenantId = (user as { tenantId: string }).tenantId;
        token.tenantSlug = (user as { tenantSlug: string }).tenantSlug;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.tenantSlug = token.tenantSlug as string;
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
    // Stateless JWT = not revocable before expiry: window intentionally shorter
    // than Auth.js's 30-day default.
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
});
