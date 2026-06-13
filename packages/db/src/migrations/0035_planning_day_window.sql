-- Planning: configurable day window (hours) for the scheduler "jour" view,
-- mirroring the legacy HEUREDEBJOURNEE / HEUREFINJOURNEE parameters.
ALTER TABLE "tenant_settings" ADD COLUMN "planning_day_start" integer NOT NULL DEFAULT 5;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "planning_day_end" integer NOT NULL DEFAULT 21;
