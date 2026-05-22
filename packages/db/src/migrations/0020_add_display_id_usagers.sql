-- Per-tenant atomic counter table
CREATE TABLE IF NOT EXISTS "tenant_counters" (
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "entity" varchar(50) NOT NULL,
  "last_value" bigint NOT NULL DEFAULT 0,
  PRIMARY KEY ("tenant_id", "entity")
);

-- Add display_id to usagers (nullable first, backfill, then NOT NULL + UNIQUE)
ALTER TABLE "usagers" ADD COLUMN "display_id" integer;

-- Backfill: assign per-tenant sequence numbered by creation order
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at, id) AS rn
  FROM "usagers"
)
UPDATE "usagers" u
SET display_id = numbered.rn
FROM numbered
WHERE u.id = numbered.id;

-- Initialize tenant_counters for usagers based on max display_id per tenant
INSERT INTO "tenant_counters" (tenant_id, entity, last_value)
SELECT tenant_id, 'usagers', COALESCE(MAX(display_id), 0)
FROM "usagers"
GROUP BY tenant_id
ON CONFLICT (tenant_id, entity) DO NOTHING;

-- Enforce NOT NULL + per-tenant uniqueness
ALTER TABLE "usagers" ALTER COLUMN "display_id" SET NOT NULL;
ALTER TABLE "usagers" ADD CONSTRAINT "usagers_tenant_display_id_unique" UNIQUE ("tenant_id", "display_id");
