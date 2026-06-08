-- Code client optionnel sur le trajet (référence métier, non obligatoire).
ALTER TABLE "trajets" ADD COLUMN "code" varchar(50);

-- Lien vers l'avenant ayant créé le trajet (null = association directe).
ALTER TABLE "trajets" ADD COLUMN "created_by_avenant_id" uuid;
ALTER TABLE "trajets"
  ADD CONSTRAINT "trajets_created_by_avenant_id_fk"
  FOREIGN KEY ("created_by_avenant_id") REFERENCES "avenants"("id")
  ON DELETE SET NULL;
