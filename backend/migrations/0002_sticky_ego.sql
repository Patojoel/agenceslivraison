CREATE UNIQUE INDEX "sessions_token_digest_unique" ON "sessions" USING btree ("token_digest");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_digest_format" CHECK ("sessions"."token_digest" ~ '^[a-f0-9]{64}$');--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_version_positive" CHECK ("sessions"."version" > 0);