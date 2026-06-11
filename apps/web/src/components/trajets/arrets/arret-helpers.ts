import type { Modifier } from "@dnd-kit/core";
import type { ArretRow } from "./types";

// Rows live in a table: lock the drag to the vertical axis AND keep it within
// the list container so a row can't be dragged out of its block.
export const restrictToVerticalAxis: Modifier = ({
  transform,
  draggingNodeRect,
  containerNodeRect,
}) => {
  const next = { ...transform, x: 0 };
  if (!draggingNodeRect || !containerNodeRect) return next;
  if (draggingNodeRect.top + next.y < containerNodeRect.top) {
    next.y = containerNodeRect.top - draggingNodeRect.top;
  } else if (draggingNodeRect.bottom + next.y > containerNodeRect.bottom) {
    next.y = containerNodeRect.bottom - draggingNodeRect.bottom;
  }
  return next;
};

export function isEtablissement(arret: ArretRow) {
  return arret.type === "etablissement";
}

export function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  return String(seconds);
}

export function formatKm(km: number | null) {
  if (km == null) return "—";
  return km.toFixed(3);
}

export function formatGps(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return "—";
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
