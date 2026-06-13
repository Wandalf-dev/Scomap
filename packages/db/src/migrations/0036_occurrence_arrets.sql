-- Per-day stop exceptions of a trajet occurrence (fiche trajet du jour):
-- 'exclude' hides a base arrêt that day, 'add' inserts an extra stop.
CREATE TABLE "trajet_occurrence_arrets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "trajet_id" uuid NOT NULL REFERENCES "trajets"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "kind" varchar(10) NOT NULL,
  "base_arret_id" uuid REFERENCES "arrets"("id") ON DELETE CASCADE,
  "type" varchar(20),
  "usager_address_id" uuid REFERENCES "usager_addresses"("id") ON DELETE CASCADE,
  "etablissement_id" uuid REFERENCES "etablissements"("id") ON DELETE CASCADE,
  "name" varchar(255),
  "address" text,
  "latitude" double precision,
  "longitude" double precision,
  "arrival_time" varchar(5),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "toa_trajet_date_idx" ON "trajet_occurrence_arrets" ("trajet_id", "date");--> statement-breakpoint
CREATE UNIQUE INDEX "toa_exclusion_unique_idx" ON "trajet_occurrence_arrets" ("trajet_id", "date", "base_arret_id");
