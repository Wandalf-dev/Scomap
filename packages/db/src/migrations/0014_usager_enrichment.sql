-- Usagers: add new fields
ALTER TABLE "usagers" ADD COLUMN "secondary_etablissement_id" uuid;
ALTER TABLE "usagers" ADD COLUMN "status" varchar(20) NOT NULL DEFAULT 'brouillon';
ALTER TABLE "usagers" ADD COLUMN "regime" varchar(30);
ALTER TABLE "usagers" ADD COLUMN "transport_end_date" date;
ALTER TABLE "usagers" ADD COLUMN "transport_particularity" text;
ALTER TABLE "usagers" ADD COLUMN "specificity" text;

-- Usagers: add FK for secondary etablissement
ALTER TABLE "usagers" ADD CONSTRAINT "usagers_secondary_etablissement_id_etablissements_id_fk" FOREIGN KEY ("secondary_etablissement_id") REFERENCES "public"."etablissements"("id") ON DELETE set null ON UPDATE no action;

-- Usager addresses: rename label to type
ALTER TABLE "usager_addresses" RENAME COLUMN "label" TO "type";

-- Usager addresses: add new fields
ALTER TABLE "usager_addresses" ADD COLUMN "secondary_phone" varchar(20);
ALTER TABLE "usager_addresses" ADD COLUMN "secondary_mobile" varchar(20);
ALTER TABLE "usager_addresses" ADD COLUMN "authorized_person" varchar(200);

-- Usager circuits: add new fields
ALTER TABLE "usager_circuits" ADD COLUMN "arrival_notification" boolean NOT NULL DEFAULT false;
ALTER TABLE "usager_circuits" ADD COLUMN "authorization_alone" boolean NOT NULL DEFAULT false;
