-- Résolution par date des avenants : on date-versionne l'affectation
-- usager<->circuit et on borne la présence de l'usager sur un trajet.
-- Colonnes nullables → backfill-safe (null = toujours actif / version courante).

ALTER TABLE "usager_circuits" ADD COLUMN IF NOT EXISTS "valid_from" date;--> statement-breakpoint
ALTER TABLE "usager_circuits" ADD COLUMN IF NOT EXISTS "valid_to" date;--> statement-breakpoint
ALTER TABLE "usager_circuits" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint

ALTER TABLE "arrets" ADD COLUMN IF NOT EXISTS "valid_from" date;--> statement-breakpoint
ALTER TABLE "arrets" ADD COLUMN IF NOT EXISTS "valid_to" date;--> statement-breakpoint

-- Remplace l'unicité (usager, circuit) par une unicité de la SEULE version
-- ouverte (valid_to null) : une affectation peut désormais avoir un historique
-- de versions datées, mais une seule courante.
DROP INDEX IF EXISTS "usager_circuits_usager_circuit_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usager_circuits_open_version_idx"
  ON "usager_circuits" ("usager_id", "circuit_id")
  WHERE "valid_to" IS NULL AND "deleted_at" IS NULL;
