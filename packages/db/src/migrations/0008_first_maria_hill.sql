CREATE TABLE "usager_circuits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"usager_id" uuid NOT NULL,
	"circuit_id" uuid NOT NULL,
	"days_aller" jsonb,
	"days_retour" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usager_circuits" ADD CONSTRAINT "usager_circuits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usager_circuits" ADD CONSTRAINT "usager_circuits_usager_id_usagers_id_fk" FOREIGN KEY ("usager_id") REFERENCES "public"."usagers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usager_circuits" ADD CONSTRAINT "usager_circuits_circuit_id_circuits_id_fk" FOREIGN KEY ("circuit_id") REFERENCES "public"."circuits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "usager_circuits_usager_circuit_idx" ON "usager_circuits" USING btree ("usager_id","circuit_id");