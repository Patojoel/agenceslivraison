ALTER TABLE "agencies" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_valid_status" CHECK ("agencies"."status" IN ('draft', 'submitted'));