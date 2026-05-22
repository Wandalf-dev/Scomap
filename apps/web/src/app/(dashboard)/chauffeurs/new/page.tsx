import type { Metadata } from "next";
import { ChauffeurCreateClient } from "@/components/chauffeurs/chauffeur-create-client";

export const metadata: Metadata = { title: "Nouveau chauffeur" };

export default function ChauffeurNewPage() {
  return <ChauffeurCreateClient />;
}
