CREATE TABLE "agency_invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agency_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_digest" text NOT NULL,
	"created_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "agency_invitations_role" CHECK ("agency_invitations"."role" IN ('admin', 'agent')),
	CONSTRAINT "agency_invitations_digest" CHECK ("agency_invitations"."token_digest" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "agency_invitations" ADD CONSTRAINT "agency_invitations_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_invitations" ADD CONSTRAINT "agency_invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agency_invitations_token_unique" ON "agency_invitations" USING btree ("token_digest");