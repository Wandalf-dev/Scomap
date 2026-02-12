ALTER TABLE "trajets" ALTER COLUMN "start_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "circuits" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "circuits" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "trajets" ADD COLUMN "route_geometry" jsonb;