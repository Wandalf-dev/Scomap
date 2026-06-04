-- Numérotation des avenants PAR circuit (Avenant n°1, n°2… du circuit).
ALTER TABLE "avenants" ADD COLUMN IF NOT EXISTS "circuit_sequence" integer;
