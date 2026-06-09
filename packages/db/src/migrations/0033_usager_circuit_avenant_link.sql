-- Lien vers l'avenant ayant créé cette version d'affectation (null = association
-- directe / composition de base). Miroir de trajets.created_by_avenant_id : permet
-- d'annuler proprement le versioning d'AFFECTATION lors de l'annulation d'un
-- avenant (soft-delete des versions créées par l'avenant + réouverture des
-- versions qu'il avait clôturées). FK posée en SQL (cohérent avec trajets).
ALTER TABLE "usager_circuits" ADD COLUMN "created_by_avenant_id" uuid;
ALTER TABLE "usager_circuits"
  ADD CONSTRAINT "usager_circuits_created_by_avenant_id_fk"
  FOREIGN KEY ("created_by_avenant_id") REFERENCES "avenants"("id")
  ON DELETE SET NULL;
