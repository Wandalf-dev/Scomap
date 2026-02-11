CREATE TABLE "etablissement_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"etablissement_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"civility" varchar(5),
	"last_name" varchar(255) NOT NULL,
	"first_name" varchar(255),
	"function" varchar(255),
	"phone" varchar(20),
	"email" varchar(255),
	"observations" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "etablissements" ADD COLUMN "regime" varchar(10);--> statement-breakpoint
ALTER TABLE "etablissements" ADD COLUMN "color" varchar(7);--> statement-breakpoint
ALTER TABLE "etablissements" ADD COLUMN "website" varchar(255);--> statement-breakpoint
ALTER TABLE "etablissements" ADD COLUMN "manager_civility" varchar(5);--> statement-breakpoint
ALTER TABLE "etablissements" ADD COLUMN "manager_name" varchar(255);--> statement-breakpoint
ALTER TABLE "etablissements" ADD COLUMN "manager_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "etablissements" ADD COLUMN "manager_email" varchar(255);--> statement-breakpoint
ALTER TABLE "etablissements" ADD COLUMN "code_uai" varchar(20);--> statement-breakpoint
ALTER TABLE "etablissements" ADD COLUMN "observations" text;--> statement-breakpoint
ALTER TABLE "etablissement_contacts" ADD CONSTRAINT "etablissement_contacts_etablissement_id_etablissements_id_fk" FOREIGN KEY ("etablissement_id") REFERENCES "public"."etablissements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etablissement_contacts" ADD CONSTRAINT "etablissement_contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;