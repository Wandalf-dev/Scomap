-- Le code (référence client) est un attribut du circuit, partagé par ses
-- trajets (aller/retour) — pas un attribut propre au trajet.
ALTER TABLE "circuits" ADD COLUMN "code" varchar(50);
ALTER TABLE "trajets" DROP COLUMN IF EXISTS "code";
