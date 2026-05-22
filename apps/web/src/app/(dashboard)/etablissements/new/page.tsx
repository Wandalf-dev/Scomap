import type { Metadata } from "next";
import { EtablissementCreateClient } from "@/components/etablissements/etablissement-create-client";

export const metadata: Metadata = { title: "Nouvel établissement" };

export default function EtablissementNewPage() {
  return <EtablissementCreateClient />;
}
