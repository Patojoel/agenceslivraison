ALTER TABLE "agencies" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_version_positive" CHECK ("agencies"."version" > 0);