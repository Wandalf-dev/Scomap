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
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    setSuggestions([]);
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query || query.length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

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
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query]);

  return { suggestions, isLoading, clear };
}
