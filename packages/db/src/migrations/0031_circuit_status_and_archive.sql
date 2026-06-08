-- Circuits : statut de validation (façon usager) + archivage (cycle de vie),
-- en remplacement du booléen is_active ambigu.
ALTER TABLE "circuits"
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT 'non_controle';
ALTER TABLE "circuits"
  ADD COLUMN "archived_at" timestamp with time zone;

-- is_active devient inutile (l'archivage est désormais explicite et manuel).
ALTER TABLE "circuits" DROP COLUMN IF EXISTS "is_active";

-- Usagers : archivage (historisation), distinct du statut métier et du soft-delete.
ALTER TABLE "usagers"
  ADD COLUMN "archived_at" timestamp with time zone;
