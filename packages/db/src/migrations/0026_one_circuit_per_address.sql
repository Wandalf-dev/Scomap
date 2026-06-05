-- Cohérence : un seul circuit ACTIF par (usager, adresse).
-- Complète l'index (usager, circuit) ouvert existant par une unicité sur la
-- version ouverte PAR ADRESSE. Un changement de circuit sur une adresse déjà
-- affectée passe par un avenant ; l'association d'une adresse LIBRE reste directe.
-- Coexiste avec les avenants : seule la version ouverte (valid_to null) compte,
-- l'ancienne version close (valid_to renseigné) n'entre pas dans l'index.
-- usager_address_id peut être null (set null à la suppression d'adresse) → exclu.
CREATE UNIQUE INDEX IF NOT EXISTS "usager_circuits_open_address_idx"
  ON "usager_circuits" ("usager_id", "usager_address_id")
  WHERE "valid_to" IS NULL AND "deleted_at" IS NULL AND "usager_address_id" IS NOT NULL;
