-- Profil métier du tenant : "departement" (AO) ou "transporteur".
-- Conditionne la vue planning par défaut (timeline pour les transporteurs).
ALTER TABLE "tenants" ADD COLUMN "type" varchar(20) NOT NULL DEFAULT 'departement';
