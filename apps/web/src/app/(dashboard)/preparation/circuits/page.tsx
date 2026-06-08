import type { Metadata } from "next";
import { PrepaCircuitsClient } from "@/components/preparation/prepa-circuits-client";

export const metadata: Metadata = { title: "Circuits en préparation" };

export default function PreparationCircuitsPage() {
  return <PrepaCircuitsClient />;
}
