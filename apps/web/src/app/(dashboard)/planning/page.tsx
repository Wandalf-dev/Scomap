import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { PlanningClient } from "@/components/planning/planning-client";
import { formatDateISO } from "@/lib/utils/date-helpers";

export const metadata: Metadata = { title: "Planning" };

// The default view is the scheduler's "jour" (today): prefetch exactly that
// range so the first paint needs no client refetch.
// formatDateISO: local-time components (toISOString would shift the day in UTC+ timezones)
function getTodayRange() {
  const today = formatDateISO(new Date());
  return { fromDate: today, toDate: today };
}

export default async function PlanningPage() {
  const queryClient = getQueryClient();
  const { fromDate, toDate } = getTodayRange();

  await queryClient.prefetchQuery(
    trpc.trajets.listOccurrences.queryOptions({ fromDate, toDate }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PlanningClient />
    </HydrationBoundary>
  );
}
