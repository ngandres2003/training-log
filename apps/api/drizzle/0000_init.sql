CREATE TABLE "custom_exercises" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" bigint NOT NULL,
	"name" text NOT NULL,
	"primary_muscle" text NOT NULL,
	"secondary_muscles" text[] NOT NULL,
	"equipment" text NOT NULL,
	"tracking_type" text NOT NULL,
	"image_url" text,
	CONSTRAINT "custom_exercises_tracking_type_check" CHECK ("custom_exercises"."tracking_type" in ('weight_reps', 'reps', 'time'))
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" bigint NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"is_cycle" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_exercises" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" bigint NOT NULL,
	"routine_id" uuid NOT NULL,
	"exercise_id" text NOT NULL,
	"order" integer NOT NULL,
	"rest_sec" integer,
	"note" text NOT NULL,
	"superset_group" text
);
--> statement-breakpoint
CREATE TABLE "routine_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" bigint NOT NULL,
	"routine_exercise_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"type" text NOT NULL,
	"target_reps_min" integer,
	"target_reps_max" integer,
	"target_weight" double precision,
	"target_duration_sec" integer
);
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" bigint NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"folder_id" uuid,
	"notes" text NOT NULL,
	"order" integer NOT NULL,
	"archived" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" bigint NOT NULL,
	"display_name" text NOT NULL,
	"unit" text NOT NULL,
	"weekly_goal" integer NOT NULL,
	"default_rest_sec" integer NOT NULL,
	"week_start" text NOT NULL,
	"theme" text NOT NULL,
	"preload_previous" boolean NOT NULL,
	"sound_on" boolean NOT NULL,
	"vibration_on" boolean NOT NULL,
	"keep_screen_on" boolean NOT NULL,
	"onboarded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sync_counters" (
	"user_id" text PRIMARY KEY NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_exercises" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" bigint NOT NULL,
	"workout_id" uuid NOT NULL,
	"exercise_id" text NOT NULL,
	"routine_exercise_id" uuid,
	"order" integer NOT NULL,
	"note" text NOT NULL,
	"superset_group" text
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" bigint NOT NULL,
	"workout_exercise_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"type" text NOT NULL,
	"weight" double precision,
	"reps" integer,
	"duration_sec" integer,
	"rpe" double precision,
	"completed" boolean NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" bigint NOT NULL,
	"routine_id" uuid,
	"name" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"status" text NOT NULL,
	"energy" integer,
	"tags" text[] NOT NULL,
	"note" text NOT NULL,
	"rest_ends_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "custom_exercises_user_version_idx" ON "custom_exercises" USING btree ("user_id","version");--> statement-breakpoint
CREATE INDEX "folders_user_version_idx" ON "folders" USING btree ("user_id","version");--> statement-breakpoint
CREATE INDEX "routine_exercises_user_version_idx" ON "routine_exercises" USING btree ("user_id","version");--> statement-breakpoint
CREATE INDEX "routine_sets_user_version_idx" ON "routine_sets" USING btree ("user_id","version");--> statement-breakpoint
CREATE INDEX "routines_user_version_idx" ON "routines" USING btree ("user_id","version");--> statement-breakpoint
CREATE INDEX "settings_user_version_idx" ON "settings" USING btree ("user_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "settings_user_unique" ON "settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workout_exercises_user_version_idx" ON "workout_exercises" USING btree ("user_id","version");--> statement-breakpoint
CREATE INDEX "workout_sets_user_version_idx" ON "workout_sets" USING btree ("user_id","version");--> statement-breakpoint
CREATE INDEX "workouts_user_version_idx" ON "workouts" USING btree ("user_id","version");