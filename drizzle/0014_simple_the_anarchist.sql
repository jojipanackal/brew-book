CREATE TYPE "public"."user_tag_type" AS ENUM('Tech', 'CRM');--> statement-breakpoint
CREATE TABLE "user_tag" (
	"user_id" text NOT NULL,
	"tag" "user_tag_type" NOT NULL,
	CONSTRAINT "user_tag_user_id_tag_pk" PRIMARY KEY("user_id","tag")
);
--> statement-breakpoint
ALTER TABLE "user_tag" ADD CONSTRAINT "user_tag_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_tag_tag_idx" ON "user_tag" USING btree ("tag");
