ALTER TABLE "arrets" ADD COLUMN "distance_km" double precision;--> statement-breakpoint
ALTER TABLE "arrets" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "arrets" ADD COLUMN "time_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trajets" ADD COLUMN "etat" varchar(20);--> statement-breakpoint
ALTER TABLE "trajets" ADD COLUMN "peages" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trajets" ADD COLUMN "km_a_charge" double precision;--> statement-breakpoint
ALTER TABLE "trajets" ADD COLUMN "total_distance_km" double precision;--> statement-breakpoint
ALTER TABLE "trajets" ADD COLUMN "total_duration_seconds" integer;