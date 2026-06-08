import type { Metadata } from "next";
import { PrepaUsagersClient } from "@/components/preparation/prepa-usagers-client";

export const metadata: Metadata = { title: "Usagers en préparation" };

export default function PreparationUsagersPage() {
  return <PrepaUsagersClient />;
}
