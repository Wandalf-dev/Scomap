// --- Types ---

export interface CircuitListItem {
  id: string;
  name: string;
  etablissementName: string | null;
  etablissementCity: string | null;
  startDate: string | null;
  endDate: string | null;
  usagerCount: number;
}

export interface CircuitSuggestionReason {
  kind: string;
  label: string;
  detail: string;
  distanceM?: number;
}

export interface CircuitSuggestion {
  circuitId: string;
  score: number;
  reasons: CircuitSuggestionReason[];
}

export interface PreviewCircuit {
  id: string;
  name: string;
  etablissementName: string | null;
  etablissementCity: string | null;
}

export interface AddressItem {
  id: string;
  type: string | null;
  position: number;
  address: string | null;
  city: string | null;
}

export interface EtablissementPoint {
  name: string;
  latitude: number;
  longitude: number;
}

export interface SelectedAddressPoint {
  label: string;
  latitude: number;
  longitude: number;
}
