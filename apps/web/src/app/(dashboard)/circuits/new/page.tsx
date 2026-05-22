import type { Metadata } from "next";
import { CircuitCreateClient } from "@/components/circuits/circuit-create-client";

export const metadata: Metadata = { title: "Nouveau circuit" };

export default function CircuitNewPage() {
  return <CircuitCreateClient />;
}
