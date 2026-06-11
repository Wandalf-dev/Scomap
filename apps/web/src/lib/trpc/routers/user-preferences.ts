import { z } from "zod";
import { eq } from "drizzle-orm";
import { users } from "@scomap/db/schema";
import { createTRPCRouter, protectedProcedure } from "../init";

const preferencesSchema = z.object({
  sidebar: z
    .object({
      variant: z.enum(["sidebar", "floating", "inset"]),
      collapsible: z.enum(["offcanvas", "icon", "none"]),
      side: z.enum(["left", "right"]),
    })
    .optional(),
  // Injected via document.style.setProperty("--radius", …): strict format
  radius: z
    .string()
    .regex(/^\d+(\.\d+)?rem$/)
    .optional(),
});

export type UserPreferences = z.infer<typeof preferencesSchema>;

export const userPreferencesRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, ctx.user.id as string))
      .then((rows) => rows[0]);

    return (user?.preferences as UserPreferences | null) ?? null;
  }),

  save: protectedProcedure
    .input(preferencesSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({
          preferences: input as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id as string));

      return { success: true };
    }),
});
