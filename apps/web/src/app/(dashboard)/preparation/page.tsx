import type { Metadata } from "next";
import { PreparationClient } from "@/components/preparation/preparation-client";

export const metadata: Metadata = { title: "Préparation de rentrée" };

export default function PreparationPage() {
  return <PreparationClient />;
}
