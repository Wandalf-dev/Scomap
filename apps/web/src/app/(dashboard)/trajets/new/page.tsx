import type { Metadata } from "next";
import { TrajetCreateClient } from "@/components/trajets/trajet-create-client";

export const metadata: Metadata = { title: "Nouveau trajet" };

export default function TrajetNewPage() {
  return <TrajetCreateClient />;
}
