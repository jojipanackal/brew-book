CREATE TYPE "public"."attendance_status" AS ENUM('office', 'wfh', 'leave');--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"period" "drink_period" NOT NULL,
	"status" "attendance_status" DEFAULT 'office' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_user_id_date_period_unique" UNIQUE("user_id","date","period")
);--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_date_idx" ON "attendance" USING btree ("date");--> statement-breakpoint
INSERT INTO "attendance" ("id", "user_id", "date", "period", "status")
SELECT gen_random_uuid()::text, "id", CURRENT_DATE, period, 'leave'::"attendance_status"
FROM "user" CROSS JOIN (VALUES ('morning'::"drink_period"), ('evening'::"drink_period")) AS periods(period)
WHERE "is_on_leave" = true;
