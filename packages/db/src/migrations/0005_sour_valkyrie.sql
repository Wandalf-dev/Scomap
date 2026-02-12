-- Backfill type for existing rows that have NULL
UPDATE "arrets" SET "type" = 'usager' WHERE "type" IS NULL;--> statement-breakpoint
ALTER TABLE "arrets" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
-- Add tenant_id as nullable first, backfill from circuits, then set NOT NULL
ALTER TABLE "arrets" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
UPDATE "arrets" SET "tenant_id" = "circuits"."tenant_id" FROM "circuits" WHERE "arrets"."circuit_id" = "circuits"."id";--> statement-breakpoint
ALTER TABLE "arrets" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "arrets" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "arrets" ADD CONSTRAINT "arrets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;