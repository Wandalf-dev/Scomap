-- Refactoring: arrets belong to trajets (not circuits), circuits have etablissementId
-- TRUNCATE test data for clean migration

TRUNCATE arrets, trajet_occurrences, trajets, circuits CASCADE;

-- 1. Add etablissement_id to circuits (NOT NULL)
ALTER TABLE "circuits" ADD COLUMN "etablissement_id" uuid NOT NULL REFERENCES "etablissements"("id") ON DELETE CASCADE;

-- 2. Drop old circuit_id FK from arrets, add trajet_id FK
ALTER TABLE "arrets" DROP CONSTRAINT IF EXISTS "arrets_circuit_id_circuits_id_fk";
ALTER TABLE "arrets" DROP COLUMN IF EXISTS "circuit_id";
ALTER TABLE "arrets" ADD COLUMN "trajet_id" uuid NOT NULL REFERENCES "trajets"("id") ON DELETE CASCADE;
