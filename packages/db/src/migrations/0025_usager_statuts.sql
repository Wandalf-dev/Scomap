-- Statuts usager repris de Transcolaire (codes 0→5) :
-- non_controle, controle, modifie, en_attente, refuse_annule, a_reconduire.
-- Remplace l'ancien jeu (brouillon/en_attente/actif/suspendu/refuse/archive) avec mapping.
-- Idempotent : sûr à rejouer (les anciennes valeurs disparaissent après la 1re passe).
UPDATE "usagers" SET "status" = CASE "status"
  WHEN 'brouillon'  THEN 'non_controle'
  WHEN 'actif'      THEN 'controle'
  WHEN 'suspendu'   THEN 'a_reconduire'
  WHEN 'refuse'     THEN 'refuse_annule'
  WHEN 'archive'    THEN 'refuse_annule'
  ELSE "status"
END
WHERE "status" IN ('brouillon', 'actif', 'suspendu', 'refuse', 'archive');

-- Le statut par défaut d'un nouvel usager est « Non contrôlé ».
ALTER TABLE "usagers" ALTER COLUMN "status" SET DEFAULT 'non_controle';
