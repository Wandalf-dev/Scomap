-- Type de transport remonté au niveau usager (3 catégories) + distance domicile↔établissement.
-- Inverse de 0016 : on reconsolide le mode de transport sur l'usager (modèle Transcolaire bd1.D1TYPETRAN,
-- mais 1 type par usager) et on ajoute la distance, socle du futur remboursement kilométrique.
ALTER TABLE "usagers" ADD COLUMN IF NOT EXISTS "transport_type" varchar(30);
ALTER TABLE "usagers" ADD COLUMN IF NOT EXISTS "distance_km" double precision;

-- Reprise depuis l'adresse principale (position 1), avec reclassement des 7 anciens types vers 3 catégories.
UPDATE "usagers" u
SET "transport_type" = CASE a."transport_type"
  WHEN 'taxi_collectif'      THEN 'taxi_collectif_individuel'
  WHEN 'taxi_individuel'     THEN 'taxi_collectif_individuel'
  WHEN 'vehicule_adapte'     THEN 'taxi_collectif_individuel'
  WHEN 'transport_collectif' THEN 'taxi_collectif_individuel'
  WHEN 'ambulance_vsl'       THEN 'taxi_collectif_individuel'
  WHEN 'transport_en_commun' THEN 'transport_commun'
  WHEN 'vehicule_personnel'  THEN 'transport_famille'
  ELSE NULL
END
FROM "usager_addresses" a
WHERE a."usager_id" = u."id"
  AND a."position" = 1
  AND a."transport_type" IS NOT NULL;

-- Le type ne vit plus au niveau adresse.
ALTER TABLE "usager_addresses" DROP COLUMN IF EXISTS "transport_type";
