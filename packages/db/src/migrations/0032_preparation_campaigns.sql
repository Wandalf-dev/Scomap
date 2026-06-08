-- Préparation de rentrée : campagne (espace de travail isolé) + rattachement
-- des copies via preparation_campaign_id (null = production).

CREATE TABLE IF NOT EXISTS "preparation_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "label" varchar(255) NOT NULL,
  "school_year_label" varchar(50),
  "target_start_date" date,
  "target_end_date" date,
  "status" varchar(20) NOT NULL DEFAULT 'en_cours',
  "activated_at" timestamp with time zone,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

-- Au plus une campagne « en cours » par tenant.
CREATE UNIQUE INDEX "preparation_campaigns_one_open_per_tenant_idx"
  ON "preparation_campaigns" ("tenant_id")
  WHERE status = 'en_cours' AND deleted_at IS NULL;

-- Rattachement des entités à une campagne (null = production).
ALTER TABLE "circuits" ADD COLUMN "preparation_campaign_id" uuid;
ALTER TABLE "circuits" ADD COLUMN "source_id" uuid;
ALTER TABLE "usagers" ADD COLUMN "preparation_campaign_id" uuid;
ALTER TABLE "usagers" ADD COLUMN "source_id" uuid;
ALTER TABLE "usager_circuits" ADD COLUMN "preparation_campaign_id" uuid;
ALTER TABLE "trajets" ADD COLUMN "preparation_campaign_id" uuid;
ALTER TABLE "arrets" ADD COLUMN "preparation_campaign_id" uuid;
ALTER TABLE "avenants" ADD COLUMN "preparation_campaign_id" uuid;

-- FK vers la campagne (CASCADE : si une campagne est supprimée, ses brouillons
-- partent avec — ils ne « fuient » jamais en production).
ALTER TABLE "circuits" ADD CONSTRAINT "circuits_preparation_campaign_id_fk"
  FOREIGN KEY ("preparation_campaign_id") REFERENCES "preparation_campaigns"("id") ON DELETE CASCADE;
ALTER TABLE "usagers" ADD CONSTRAINT "usagers_preparation_campaign_id_fk"
  FOREIGN KEY ("preparation_campaign_id") REFERENCES "preparation_campaigns"("id") ON DELETE CASCADE;
ALTER TABLE "usager_circuits" ADD CONSTRAINT "usager_circuits_preparation_campaign_id_fk"
  FOREIGN KEY ("preparation_campaign_id") REFERENCES "preparation_campaigns"("id") ON DELETE CASCADE;
ALTER TABLE "trajets" ADD CONSTRAINT "trajets_preparation_campaign_id_fk"
  FOREIGN KEY ("preparation_campaign_id") REFERENCES "preparation_campaigns"("id") ON DELETE CASCADE;
ALTER TABLE "arrets" ADD CONSTRAINT "arrets_preparation_campaign_id_fk"
  FOREIGN KEY ("preparation_campaign_id") REFERENCES "preparation_campaigns"("id") ON DELETE CASCADE;
ALTER TABLE "avenants" ADD CONSTRAINT "avenants_preparation_campaign_id_fk"
  FOREIGN KEY ("preparation_campaign_id") REFERENCES "preparation_campaigns"("id") ON DELETE CASCADE;

-- Index pour les listes scoping par campagne.
CREATE INDEX "circuits_tenant_campaign_idx" ON "circuits" ("tenant_id","preparation_campaign_id");
CREATE INDEX "usagers_tenant_campaign_idx" ON "usagers" ("tenant_id","preparation_campaign_id");
