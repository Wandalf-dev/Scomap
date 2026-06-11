export interface ArretRow {
  id: string;
  trajetId: string;
  type: string | null;
  usagerAddressId: string | null;
  etablissementId: string | null;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  orderIndex: number;
  arrivalTime: string | null;
  waitTime: number | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  timeLocked: boolean;
  usagerId: string | null;
  usagerFirstName: string | null;
  usagerLastName: string | null;
  usagerAddressType: string | null;
  etablissementName: string | null;
  etablissementCity: string | null;
}
