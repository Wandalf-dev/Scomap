ALTER TABLE "arrets" ADD COLUMN "type" varchar(20);--> statement-breakpoint
ALTER TABLE "arrets" ADD COLUMN "usager_address_id" uuid;--> statement-breakpoint
ALTER TABLE "arrets" ADD COLUMN "etablissement_id" uuid;--> statement-breakpoint
ALTER TABLE "arrets" ADD CONSTRAINT "arrets_usager_address_id_usager_addresses_id_fk" FOREIGN KEY ("usager_address_id") REFERENCES "public"."usager_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrets" ADD CONSTRAINT "arrets_etablissement_id_etablissements_id_fk" FOREIGN KEY ("etablissement_id") REFERENCES "public"."etablissements"("id") ON DELETE set null ON UPDATE no action;