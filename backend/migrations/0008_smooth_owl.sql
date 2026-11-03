ALTER TABLE "agencies" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "creation_key" uuid;--> statement-breakpoint
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agencies_creation_key_unique" ON "agencies" USING btree ("created_by","creation_key");--> statement-breakpoint
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_creation_metadata_complete" CHECK (("agencies"."created_by" IS NULL AND "agencies"."creation_key" IS NULL) OR ("agencies"."created_by" IS NOT NULL AND "agencies"."creation_key" IS NOT NULL));