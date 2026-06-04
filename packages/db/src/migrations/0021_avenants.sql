CREATE TABLE IF NOT EXISTS "avenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"display_id" integer NOT NULL,
	"circuit_id" uuid,
	"effective_date" date NOT NULL,
	"end_date" date,
	"reason" text NOT NULL,
	"status" varchar(20) DEFAULT 'brouillon' NOT NULL,
	"applied_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "avenants_tenant_display_id_unique" UNIQUE("tenant_id","display_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "avenant_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"avenant_id" uuid NOT NULL,
	"usager_id" uuid NOT NULL,
	"type" varchar(30) NOT NULL,
	"usager_circuit_id" uuid,
	"usager_address_id" uuid,
	"previous_value" jsonb,
	"new_value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "avenants" ADD CONSTRAINT "avenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "avenants" ADD CONSTRAINT "avenants_circuit_id_circuits_id_fk" FOREIGN KEY ("circuit_id") REFERENCES "public"."circuits"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "avenants" ADD CONSTRAINT "avenants_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "avenant_changes" ADD CONSTRAINT "avenant_changes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "avenant_changes" ADD CONSTRAINT "avenant_changes_avenant_id_avenants_id_fk" FOREIGN KEY ("avenant_id") REFERENCES "public"."avenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "avenant_changes" ADD CONSTRAINT "avenant_changes_usager_id_usagers_id_fk" FOREIGN KEY ("usager_id") REFERENCES "public"."usagers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "avenant_changes" ADD CONSTRAINT "avenant_changes_usager_circuit_id_usager_circuits_id_fk" FOREIGN KEY ("usager_circuit_id") REFERENCES "public"."usager_circuits"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "avenant_changes" ADD CONSTRAINT "avenant_changes_usager_address_id_usager_addresses_id_fk" FOREIGN KEY ("usager_address_id") REFERENCES "public"."usager_addresses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "avenants_circuit_idx" ON "avenants" ("circuit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "avenants_status_effective_idx" ON "avenants" ("tenant_id","status","effective_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "avenant_changes_avenant_idx" ON "avenant_changes" ("avenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "avenant_changes_usager_idx" ON "avenant_changes" ("usager_id");
