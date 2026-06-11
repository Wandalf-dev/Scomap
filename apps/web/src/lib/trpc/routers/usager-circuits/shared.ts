import { and, or, lte, gte, isNull } from "drizzle-orm";
import { usagerCircuits } from "@scomap/db/schema";

/** SQL condition: the assignment version active on the given date. */
export function activeOnDate(dateStr: string) {
  return and(
    isNull(usagerCircuits.deletedAt),
    or(
      isNull(usagerCircuits.validFrom),
      lte(usagerCircuits.validFrom, dateStr),
    ),
    or(isNull(usagerCircuits.validTo), gte(usagerCircuits.validTo, dateStr)),
  );
}

export const todayStr = () => new Date().toISOString().slice(0, 10);
