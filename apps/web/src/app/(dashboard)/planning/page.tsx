import { HydrationBoundary } from "@tanstack/react-query";
import { trpc, getQueryClient, dehydrate } from "@/lib/trpc/server";
import { PlanningClient } from "@/components/planning/planning-client";

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(now);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    fromDate: start.toISOString().split("T")[0]!,
    toDate: end.toISOString().split("T")[0]!,
  };
}

export default async function PlanningPage() {
  const queryClient = getQueryClient();
  const { fromDate, toDate } = getWeekRange();

  await queryClient.prefetchQuery(
    trpc.trajets.listOccurrences.queryOptions({ fromDate, toDate }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PlanningClient />
    </HydrationBoundary>
  );
}
