import { z } from "zod";
import { eq, and, isNull, sql } from "drizzle-orm";
import {
  usagerCircuits,
  circuits,
  etablissements,
  usagers,
  usagerAddresses,
  avenants,
  avenantChanges,
} from "@scomap/db/schema";
import { tenantProcedure } from "../../init";
import { normalizeDays } from "@/lib/types/day-entry";
import { activeOnDate, todayStr } from "./shared";

export const listByUsager = tenantProcedure
  .input(z.object({ usagerId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select({
        id: usagerCircuits.id,
        usagerId: usagerCircuits.usagerId,
        circuitId: usagerCircuits.circuitId,
        usagerAddressId: usagerCircuits.usagerAddressId,
        // Start of this assignment version (null = since the beginning:
        // the usager then starts at their transport start date).
        validFrom: usagerCircuits.validFrom,
        arrivalNotification: usagerCircuits.arrivalNotification,
        authorizationAlone: usagerCircuits.authorizationAlone,
        circuitName: circuits.name,
        etablissementName: etablissements.name,
        etablissementCity: etablissements.city,
        addressType: usagerAddresses.type,
        addressCity: usagerAddresses.city,
        addressAddress: usagerAddresses.address,
        // Days read from the assignment VERSION (resolved by date),
        // not from the address — the version is the source of truth.
        daysAller: usagerCircuits.daysAller,
        daysRetour: usagerCircuits.daysRetour,
      })
      .from(usagerCircuits)
      .innerJoin(circuits, eq(usagerCircuits.circuitId, circuits.id))
      .leftJoin(
        etablissements,
        eq(circuits.etablissementId, etablissements.id),
      )
      .leftJoin(
        usagerAddresses,
        eq(usagerCircuits.usagerAddressId, usagerAddresses.id),
      )
      .where(
        and(
          eq(usagerCircuits.usagerId, input.usagerId),
          eq(usagerCircuits.tenantId, ctx.tenantId),
          // OPEN versions (current or upcoming) — consistent with the
          // "one active circuit per address" guard and the partial unique index.
          // A future assignment (valid_from > today) already occupies the
          // address: it must therefore appear here.
          isNull(usagerCircuits.validTo),
          isNull(usagerCircuits.deletedAt),
        ),
      );

    return rows.map((row) => ({
      ...row,
      daysAller: normalizeDays(row.daysAller),
      daysRetour: normalizeDays(row.daysRetour),
    }));
  });

export const listByCircuit = tenantProcedure
  .input(
    z.object({
      circuitId: z.string().uuid(),
      // Resolution date (default: today). An avenant date yields the circuit's
      // usagers/PEC composition as of that date.
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      // true = all OPEN assignments (current + upcoming), for the circuit's
      // usager list (a future usager must appear there). Default (false) =
      // composition active on the date (recap).
      openOnly: z.boolean().optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select({
        id: usagerCircuits.id,
        usagerId: usagerCircuits.usagerId,
        circuitId: usagerCircuits.circuitId,
        usagerAddressId: usagerCircuits.usagerAddressId,
        validFrom: usagerCircuits.validFrom,
        usagerFirstName: usagers.firstName,
        usagerLastName: usagers.lastName,
        usagerCode: usagers.code,
        transportStartDate: usagers.transportStartDate,
        addressType: usagerAddresses.type,
        addressCity: usagerAddresses.city,
        addressAddress: usagerAddresses.address,
        addressLatitude: usagerAddresses.latitude,
        addressLongitude: usagerAddresses.longitude,
        addressCivility: usagerAddresses.civility,
        responsibleFirstName: usagerAddresses.responsibleFirstName,
        responsibleLastName: usagerAddresses.responsibleLastName,
        addressPhone: usagerAddresses.phone,
        addressMobile: usagerAddresses.mobile,
        arrivalNotification: usagerCircuits.arrivalNotification,
        authorizationAlone: usagerCircuits.authorizationAlone,
        daysAller: usagerCircuits.daysAller,
        daysRetour: usagerCircuits.daysRetour,
        avenantCount: sql<number>`(select count(*) from ${avenantChanges} ac join ${avenants} a on a.id = ac.avenant_id where ac.usager_id = ${usagerCircuits.usagerId} and a.circuit_id = ${usagerCircuits.circuitId} and a.deleted_at is null)::int`,
      })
      .from(usagerCircuits)
      .innerJoin(usagers, eq(usagerCircuits.usagerId, usagers.id))
      .leftJoin(
        usagerAddresses,
        eq(usagerCircuits.usagerAddressId, usagerAddresses.id),
      )
      .where(
        and(
          eq(usagerCircuits.circuitId, input.circuitId),
          eq(usagerCircuits.tenantId, ctx.tenantId),
          // openOnly: all open versions (current + future);
          // otherwise composition active on the date (default: today).
          input.openOnly
            ? and(
                isNull(usagerCircuits.validTo),
                isNull(usagerCircuits.deletedAt),
              )
            : activeOnDate(input.date ?? todayStr()),
        ),
      );

    return rows.map((row) => ({
      ...row,
      daysAller: normalizeDays(row.daysAller),
      daysRetour: normalizeDays(row.daysRetour),
    }));
  });

export const countByCircuit = tenantProcedure
  .input(z.object({ circuitId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const result = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(usagerCircuits)
      .where(
        and(
          eq(usagerCircuits.circuitId, input.circuitId),
          eq(usagerCircuits.tenantId, ctx.tenantId),
          activeOnDate(todayStr()),
        ),
      );
    return result[0]?.count ?? 0;
  });
