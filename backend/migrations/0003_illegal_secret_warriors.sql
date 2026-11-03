CREATE TABLE "identity_audit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_type" text;--> statement-breakpoint
ALTER TABLE "identity_audit" ADD CONSTRAINT "identity_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_credentials_complete" CHECK (("users"."email" IS NULL AND "users"."password_hash" IS NULL AND "users"."account_type" IS NULL) OR ("users"."email" IS NOT NULL AND "users"."password_hash" IS NOT NULL AND "users"."account_type" IN ('individual', 'merchant')));