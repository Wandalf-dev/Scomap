-- Add display_id to trajets (per-tenant sequential N°, façon Transcolaire).
-- tenant_counters already exists (created in 0020).
ALTER TABLE "trajets" ADD COLUMN "display_id" integer;

-- Backfill: assign per-tenant sequence numbered by creation order
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at, id) AS rn
  FROM "trajets"
)
UPDATE "trajets" t
SET display_id = numbered.rn
FROM numbered
WHERE t.id = numbered.id;

-- Initialize tenant_counters for trajets based on max display_id per tenant
INSERT INTO "tenant_counters" (tenant_id, entity, last_value)
SELECT tenant_id, 'trajets', COALESCE(MAX(display_id), 0)
FROM "trajets"
GROUP BY tenant_id
ON CONFLICT (tenant_id, entity) DO NOTHING;

-- Enforce NOT NULL + per-tenant uniqueness
ALTER TABLE "trajets" ALTER COLUMN "display_id" SET NOT NULL;
CREATE UNIQUE INDEX "trajets_tenant_display_id_idx" ON "trajets" ("tenant_id","display_id");
