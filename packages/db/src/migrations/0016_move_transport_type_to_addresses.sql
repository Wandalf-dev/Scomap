ALTER TABLE "usager_addresses" ADD COLUMN "transport_type" varchar(30);
ALTER TABLE "usagers" DROP COLUMN IF EXISTS "transport_type";
