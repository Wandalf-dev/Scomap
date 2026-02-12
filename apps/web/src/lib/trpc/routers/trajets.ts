import { z } from "zod";
import { eq, and, isNull, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  trajets,
  trajetOccurrences,
  circuits,
  chauffeurs,
  vehicules,
  etablissements,
  arrets,
} from "@scomap/db/schema";
import { createTRPCRouter, tenantProcedure } from "../init";
import {
  trajetSchema,
  trajetDetailSchema,
  occurrenceOverrideSchema,
} from "@/lib/validators/trajet";

export const trajetsRouter = createTRPCRouter({
  listByCircuit: tenantProcedure
    .input(z.object({ circuitId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: trajets.id,
          name: trajets.name,
          direction: trajets.direction,
          departureTime: trajets.departureTime,
          recurrence: trajets.recurrence,
          startDate: trajets.startDate,
          endDate: trajets.endDate,
          chauffeurFirstName: chauffeurs.firstName,
          chauffeurLastName: chauffeurs.lastName,
          vehiculeName: vehicules.name,
          createdAt: trajets.createdAt,
        })
        .from(trajets)
        .leftJoin(chauffeurs, eq(trajets.chauffeurId, chauffeurs.id))
        .leftJoin(vehicules, eq(trajets.vehiculeId, vehicules.id))
        .where(
          and(
            eq(trajets.circuitId, input.circuitId),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        );
    }),

  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: trajets.id,
        name: trajets.name,
        direction: trajets.direction,
        departureTime: trajets.departureTime,
        recurrence: trajets.recurrence,
        startDate: trajets.startDate,
        endDate: trajets.endDate,
        circuitId: trajets.circuitId,
        circuitName: circuits.name,
        etablissementName: etablissements.name,
        etablissementCity: etablissements.city,
        chauffeurId: trajets.chauffeurId,
        chauffeurFirstName: chauffeurs.firstName,
        chauffeurLastName: chauffeurs.lastName,
        vehiculeId: trajets.vehiculeId,
        vehiculeName: vehicules.name,
        createdAt: trajets.createdAt,
      })
      .from(trajets)
      .leftJoin(circuits, eq(trajets.circuitId, circuits.id))
      .leftJoin(etablissements, eq(circuits.etablissementId, etablissements.id))
      .leftJoin(chauffeurs, eq(trajets.chauffeurId, chauffeurs.id))
      .leftJoin(vehicules, eq(trajets.vehiculeId, vehicules.id))
      .where(
        and(eq(trajets.tenantId, ctx.tenantId), isNull(trajets.deletedAt)),
      )
      .limit(500);
  }),

  getById: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({
          id: trajets.id,
          name: trajets.name,
          direction: trajets.direction,
          departureTime: trajets.departureTime,
          recurrence: trajets.recurrence,
          startDate: trajets.startDate,
          endDate: trajets.endDate,
          notes: trajets.notes,
          circuitId: trajets.circuitId,
          circuitName: circuits.name,
          etablissementName: etablissements.name,
          etablissementCity: etablissements.city,
          chauffeurId: trajets.chauffeurId,
          chauffeurFirstName: chauffeurs.firstName,
          chauffeurLastName: chauffeurs.lastName,
          vehiculeId: trajets.vehiculeId,
          vehiculeName: vehicules.name,
          vehiculeLicensePlate: vehicules.licensePlate,
          createdAt: trajets.createdAt,
          updatedAt: trajets.updatedAt,
        })
        .from(trajets)
        .leftJoin(circuits, eq(trajets.circuitId, circuits.id))
        .leftJoin(etablissements, eq(circuits.etablissementId, etablissements.id))
        .leftJoin(chauffeurs, eq(trajets.chauffeurId, chauffeurs.id))
        .leftJoin(vehicules, eq(trajets.vehiculeId, vehicules.id))
        .where(
          and(
            eq(trajets.id, input.id),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .limit(1);

      return result[0] ?? null;
    }),

  create: tenantProcedure
    .input(trajetSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(trajets)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          circuitId: input.circuitId,
          direction: input.direction,
          startDate: new Date().toISOString().split("T")[0]!,
        })
        .returning();

      const created = result[0];
      if (created) {
        await autoCreateEtablissementArret(ctx, created.id, input.circuitId);
      }

      return created;
    }),

  createFull: tenantProcedure
    .input(trajetDetailSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(trajets)
        .values({
          tenantId: ctx.tenantId,
          name: input.name,
          circuitId: input.circuitId,
          direction: input.direction,
          chauffeurId: input.chauffeurId ?? null,
          vehiculeId: input.vehiculeId ?? null,
          departureTime: input.departureTime || null,
          recurrence: input.recurrence ?? null,
          startDate: input.startDate,
          endDate: input.endDate || null,
          notes: input.notes || null,
        })
        .returning();

      const created = result[0];
      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Echec de la creation",
        });
      }

      await autoCreateEtablissementArret(ctx, created.id, input.circuitId);

      return created;
    }),

  update: tenantProcedure
    .input(z.object({ id: z.string().uuid(), data: trajetSchema }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(trajets)
        .set({
          name: input.data.name,
          circuitId: input.data.circuitId,
          direction: input.data.direction,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(trajets.id, input.id),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  updateDetail: tenantProcedure
    .input(z.object({ id: z.string().uuid(), data: trajetDetailSchema }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(trajets)
        .set({
          name: input.data.name,
          circuitId: input.data.circuitId,
          direction: input.data.direction,
          chauffeurId: input.data.chauffeurId ?? null,
          vehiculeId: input.data.vehiculeId ?? null,
          departureTime: input.data.departureTime || null,
          recurrence: input.data.recurrence ?? null,
          startDate: input.data.startDate,
          endDate: input.data.endDate || null,
          notes: input.data.notes || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(trajets.id, input.id),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(trajets)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(trajets.id, input.id),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  // --- Occurrences ---

  generateOccurrences: tenantProcedure
    .input(
      z.object({
        trajetId: z.string().uuid(),
        fromDate: z.string(),
        toDate: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch the trajet
      const trajet = await ctx.db
        .select()
        .from(trajets)
        .where(
          and(
            eq(trajets.id, input.trajetId),
            eq(trajets.tenantId, ctx.tenantId),
            isNull(trajets.deletedAt),
          ),
        )
        .limit(1);

      const t = trajet[0];
      if (!t) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trajet non trouve" });
      }

      const recurrence = t.recurrence as {
        frequency: string;
        daysOfWeek: number[];
      } | null;
      if (!recurrence || !recurrence.daysOfWeek?.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ce trajet n'a pas de recurrence configuree",
        });
      }

      // Calculate dates
      const start = new Date(
        Math.max(
          new Date(input.fromDate).getTime(),
          new Date(t.startDate).getTime(),
        ),
      );
      const endTrajet = t.endDate ? new Date(t.endDate) : null;
      const end = endTrajet
        ? new Date(Math.min(new Date(input.toDate).getTime(), endTrajet.getTime()))
        : new Date(input.toDate);

      const dates: string[] = [];
      const current = new Date(start);
      while (current <= end) {
        // JS getDay: 0=Sunday, convert to ISO: 1=Monday...7=Sunday
        const isoDay = current.getDay() === 0 ? 7 : current.getDay();
        if (recurrence.daysOfWeek.includes(isoDay)) {
          dates.push(current.toISOString().split("T")[0]!);
        }
        current.setDate(current.getDate() + 1);
      }

      if (dates.length === 0) {
        return { inserted: 0 };
      }

      // Bulk insert with ON CONFLICT DO NOTHING
      const values = dates.map((d) => ({
        tenantId: ctx.tenantId,
        trajetId: input.trajetId,
        date: d,
        status: "planifie" as const,
      }));

      const result = await ctx.db
        .insert(trajetOccurrences)
        .values(values)
        .onConflictDoNothing({
          target: [trajetOccurrences.trajetId, trajetOccurrences.date],
        })
        .returning();

      return { inserted: result.length };
    }),

  listOccurrences: tenantProcedure
    .input(
      z.object({
        fromDate: z.string(),
        toDate: z.string(),
        trajetId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(trajetOccurrences.tenantId, ctx.tenantId),
        gte(trajetOccurrences.date, input.fromDate),
        lte(trajetOccurrences.date, input.toDate),
      ];

      if (input.trajetId) {
        conditions.push(eq(trajetOccurrences.trajetId, input.trajetId));
      }

      return ctx.db
        .select({
          id: trajetOccurrences.id,
          trajetId: trajetOccurrences.trajetId,
          date: trajetOccurrences.date,
          status: trajetOccurrences.status,
          overrideChauffeurId: trajetOccurrences.chauffeurId,
          overrideVehiculeId: trajetOccurrences.vehiculeId,
          overrideDepartureTime: trajetOccurrences.departureTime,
          overrideNotes: trajetOccurrences.notes,
          // Trajet parent info
          trajetName: trajets.name,
          trajetDirection: trajets.direction,
          trajetDepartureTime: trajets.departureTime,
          trajetChauffeurId: trajets.chauffeurId,
          trajetVehiculeId: trajets.vehiculeId,
          // Joined info
          circuitName: circuits.name,
          chauffeurFirstName: chauffeurs.firstName,
          chauffeurLastName: chauffeurs.lastName,
          vehiculeName: vehicules.name,
        })
        .from(trajetOccurrences)
        .innerJoin(trajets, eq(trajetOccurrences.trajetId, trajets.id))
        .leftJoin(circuits, eq(trajets.circuitId, circuits.id))
        .leftJoin(
          chauffeurs,
          eq(
            sql`COALESCE(${trajetOccurrences.chauffeurId}, ${trajets.chauffeurId})`,
            chauffeurs.id,
          ),
        )
        .leftJoin(
          vehicules,
          eq(
            sql`COALESCE(${trajetOccurrences.vehiculeId}, ${trajets.vehiculeId})`,
            vehicules.id,
          ),
        )
        .where(and(...conditions))
        .limit(1000);
    }),

  updateOccurrence: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: occurrenceOverrideSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(trajetOccurrences)
        .set({
          chauffeurId: input.data.chauffeurId,
          vehiculeId: input.data.vehiculeId,
          departureTime: input.data.departureTime,
          status: input.data.status,
          notes: input.data.notes,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(trajetOccurrences.id, input.id),
            eq(trajetOccurrences.tenantId, ctx.tenantId),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),

  cancelOccurrence: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(trajetOccurrences)
        .set({
          status: "annule",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(trajetOccurrences.id, input.id),
            eq(trajetOccurrences.tenantId, ctx.tenantId),
          ),
        )
        .returning();

      return result[0] ?? null;
    }),
});

// Helper: auto-create an "etablissement" stop when creating a trajet
async function autoCreateEtablissementArret(
  ctx: { db: typeof import("@scomap/db").db; tenantId: string },
  trajetId: string,
  circuitId: string,
) {
  // Fetch the circuit's etablissement
  const circuit = await ctx.db
    .select({
      etablissementId: circuits.etablissementId,
      etablissementName: etablissements.name,
      etablissementAddress: etablissements.address,
      etablissementCity: etablissements.city,
      etablissementPostalCode: etablissements.postalCode,
      etablissementLatitude: etablissements.latitude,
      etablissementLongitude: etablissements.longitude,
    })
    .from(circuits)
    .leftJoin(etablissements, eq(circuits.etablissementId, etablissements.id))
    .where(eq(circuits.id, circuitId))
    .limit(1);

  const c = circuit[0];
  if (!c?.etablissementId) return;

  await ctx.db.insert(arrets).values({
    tenantId: ctx.tenantId,
    trajetId,
    type: "etablissement",
    etablissementId: c.etablissementId,
    name: c.etablissementName ?? "Etablissement",
    address: [c.etablissementAddress, c.etablissementPostalCode, c.etablissementCity]
      .filter(Boolean)
      .join(", "),
    latitude: c.etablissementLatitude ?? null,
    longitude: c.etablissementLongitude ?? null,
    orderIndex: 0,
  });
}
