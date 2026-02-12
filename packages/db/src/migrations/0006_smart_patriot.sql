CREATE TABLE "trajet_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trajet_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" varchar(20) DEFAULT 'planifie' NOT NULL,
	"chauffeur_id" uuid,
	"vehicule_id" uuid,
	"departure_time" varchar(5),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trajets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"circuit_id" uuid NOT NULL,
	"chauffeur_id" uuid,
	"vehicule_id" uuid,
	"name" varchar(255) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"departure_time" varchar(5),
	"recurrence" jsonb,
	"start_date" date NOT NULL,
	"end_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "trajet_occurrences" ADD CONSTRAINT "trajet_occurrences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trajet_occurrences" ADD CONSTRAINT "trajet_occurrences_trajet_id_trajets_id_fk" FOREIGN KEY ("trajet_id") REFERENCES "public"."trajets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trajet_occurrences" ADD CONSTRAINT "trajet_occurrences_chauffeur_id_chauffeurs_id_fk" FOREIGN KEY ("chauffeur_id") REFERENCES "public"."chauffeurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trajet_occurrences" ADD CONSTRAINT "trajet_occurrences_vehicule_id_vehicules_id_fk" FOREIGN KEY ("vehicule_id") REFERENCES "public"."vehicules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trajets" ADD CONSTRAINT "trajets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trajets" ADD CONSTRAINT "trajets_circuit_id_circuits_id_fk" FOREIGN KEY ("circuit_id") REFERENCES "public"."circuits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trajets" ADD CONSTRAINT "trajets_chauffeur_id_chauffeurs_id_fk" FOREIGN KEY ("chauffeur_id") REFERENCES "public"."chauffeurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trajets" ADD CONSTRAINT "trajets_vehicule_id_vehicules_id_fk" FOREIGN KEY ("vehicule_id") REFERENCES "public"."vehicules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trajet_occurrences_trajet_date_idx" ON "trajet_occurrences" USING btree ("trajet_id","date");--> statement-breakpoint
CREATE INDEX "trajet_occurrences_date_idx" ON "trajet_occurrences" USING btree ("date");