CREATE TABLE "usager_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usager_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"label" varchar(50),
	"civility" varchar(5),
	"responsible_last_name" varchar(100),
	"responsible_first_name" varchar(100),
	"address" text,
	"city" varchar(100),
	"postal_code" varchar(10),
	"latitude" double precision,
	"longitude" double precision,
	"phone" varchar(20),
	"mobile" varchar(20),
	"email" varchar(255),
	"observations" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usagers" ADD COLUMN "code" varchar(50);--> statement-breakpoint
ALTER TABLE "usagers" ADD COLUMN "gender" varchar(1);--> statement-breakpoint
ALTER TABLE "usager_addresses" ADD CONSTRAINT "usager_addresses_usager_id_usagers_id_fk" FOREIGN KEY ("usager_id") REFERENCES "public"."usagers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usager_addresses" ADD CONSTRAINT "usager_addresses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usagers" DROP COLUMN "addresses";--> statement-breakpoint
ALTER TABLE "usagers" DROP COLUMN "parent_name";--> statement-breakpoint
ALTER TABLE "usagers" DROP COLUMN "parent_phone";--> statement-breakpoint
ALTER TABLE "usagers" DROP COLUMN "parent_email";--> statement-breakpoint
ALTER TABLE "usager_addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "usager_addresses" USING ("tenant_id" = (current_setting('app.tenant_id'))::uuid);