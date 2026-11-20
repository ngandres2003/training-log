ALTER TABLE "settings" ALTER COLUMN "default_rest_sec" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN "rest_sec" integer;