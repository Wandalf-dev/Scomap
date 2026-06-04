import type { Metadata } from "next";
import { AvenantCreateClient } from "@/components/avenants/avenant-create-client";

export const metadata: Metadata = { title: "Nouvel avenant" };

export default async function AvenantNewPage({
  searchParams,
}: {
  searchParams: Promise<{ usagerId?: string }>;
}) {
  const { usagerId } = await searchParams;
  return <AvenantCreateClient usagerId={usagerId ?? null} />;
}
