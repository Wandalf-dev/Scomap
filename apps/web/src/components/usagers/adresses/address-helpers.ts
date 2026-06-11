import {
  ADDRESS_TYPES,
  ADDRESS_TYPE_LABELS,
} from "@/lib/validators/usager-address";
import type { DayEntry } from "@/lib/types/day-entry";
import type { UsagerAddress } from "@scomap/db/schema";

export type DraftDays = { aller: DayEntry[]; retour: DayEntry[] };

export function getPositionLabel(position: number): string {
  return position === 1 ? "Adresse principale" : `Adresse ${position}`;
}

export function getTypeLabel(type: string | null): string {
  if (!type) return "";
  return ADDRESS_TYPE_LABELS[type as keyof typeof ADDRESS_TYPE_LABELS] ?? type;
}

export function buildDaysData(a: UsagerAddress) {
  return {
    position: a.position,
    type: (a.type ?? "") as typeof ADDRESS_TYPES[number] | "",
    civility: a.civility ?? "",
    responsibleLastName: a.responsibleLastName ?? "",
    responsibleFirstName: a.responsibleFirstName ?? "",
    address: a.address ?? "",
    city: a.city ?? "",
    postalCode: a.postalCode ?? "",
    latitude: a.latitude ?? null,
    longitude: a.longitude ?? null,
    phone: a.phone ?? "",
    mobile: a.mobile ?? "",
    secondaryPhone: a.secondaryPhone ?? "",
    secondaryMobile: a.secondaryMobile ?? "",
    email: a.email ?? "",
    authorizedPerson: a.authorizedPerson ?? "",
    observations: a.observations ?? "",
  };
}
