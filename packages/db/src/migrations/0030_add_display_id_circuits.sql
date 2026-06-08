-- N° lisible séquentiel par tenant pour les circuits (façon usagers/trajets).
-- tenant_counters existe déjà (créé en 0020).
ALTER TABLE "circuits" ADD COLUMN "display_id" integer;

-- Backfill : numérotation par tenant selon l'ordre de création.
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at, id) AS rn
  FROM "circuits"
)
UPDATE "circuits" c
SET display_id = numbered.rn
FROM numbered
WHERE c.id = numbered.id;

-- Initialise tenant_counters pour les circuits (max display_id par tenant).
INSERT INTO "tenant_counters" (tenant_id, entity, last_value)
SELECT tenant_id, 'circuits', COALESCE(MAX(display_id), 0)
FROM "circuits"
GROUP BY tenant_id
ON CONFLICT (tenant_id, entity) DO NOTHING;

-- NOT NULL + unicité par tenant.
ALTER TABLE "circuits" ALTER COLUMN "display_id" SET NOT NULL;
CREATE UNIQUE INDEX "circuits_tenant_display_id_idx" ON "circuits" ("tenant_id","display_id");
