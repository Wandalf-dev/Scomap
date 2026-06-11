"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface AddressSuggestion {
  label: string;
  address: string;
  city: string;
  postalCode: string;
  latitude: number;
  longitude: number;
}

export function useAddressAutocomplete(query: string) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  /** Erreur réseau / service indisponible lors de la dernière recherche. */
  const [error, setError] = useState(false);
  /** Recherche aboutie (≥ 3 caractères) mais aucune adresse trouvée. */
  const [noResults, setNoResults] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    setSuggestions([]);
    setError(false);
    setNoResults(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query || query.length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      setError(false);
      setNoResults(false);
      return;
    }

    setIsLoading(true);
    setError(false);
    setNoResults(false);

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
        const data = await res.json();

        const results: AddressSuggestion[] = data.features.map(
          (f: {
            properties: {
              label: string;
              name: string;
              city: string;
              postcode: string;
            };
            geometry: { coordinates: [number, number] };
          }) => ({
            label: f.properties.label,
            address: f.properties.name,
            city: f.properties.city,
            postalCode: f.properties.postcode,
            latitude: f.geometry.coordinates[1],
            longitude: f.geometry.coordinates[0],
          }),
        );

        setSuggestions(results);
        setNoResults(results.length === 0);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSuggestions([]);
        setError(true);
      } finally {
        // Une requête annulée signifie qu'une plus récente est en cours :
        // on ne coupe pas l'indicateur de chargement dans ce cas.
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query]);

  return { suggestions, isLoading, error, noResults, clear };
}
