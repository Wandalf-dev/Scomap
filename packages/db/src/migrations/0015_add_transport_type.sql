-- Move transport_type from usagers to usager_addresses
ALTER TABLE "usager_addresses" ADD COLUMN "transport_type" varchar(30);
ALTER TABLE "usagers" DROP COLUMN IF EXISTS "transport_type";
