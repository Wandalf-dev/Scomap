-- Fiche trajet du jour: the day's stops become a MATERIALIZED copy
-- (kind 'base' = copy of a base arrêt, 'add' = day-only extra point),
-- so they can be reordered, re-timed and routed like the trajet's own stops.
ALTER TABLE "trajet_occurrence_arrets" ADD COLUMN "order_index" integer;--> statement-breakpoint
ALTER TABLE "trajet_occurrence_arrets" ADD COLUMN "wait_time" integer;--> statement-breakpoint
ALTER TABLE "trajet_occurrence_arrets" ADD COLUMN "distance_km" double precision;--> statement-breakpoint
ALTER TABLE "trajet_occurrence_arrets" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "trajet_occurrence_arrets" ADD COLUMN "time_locked" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "trajet_occurrences" ADD COLUMN "total_distance_km" double precision;--> statement-breakpoint
ALTER TABLE "trajet_occurrences" ADD COLUMN "total_duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "trajet_occurrences" ADD COLUMN "route_geometry" jsonb;
