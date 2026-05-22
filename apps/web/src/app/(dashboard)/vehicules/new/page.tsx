import type { Metadata } from "next";
import { VehiculeCreateClient } from "@/components/vehicules/vehicule-create-client";

export const metadata: Metadata = { title: "Nouveau véhicule" };

export default function VehiculeNewPage() {
  return <VehiculeCreateClient />;
}
