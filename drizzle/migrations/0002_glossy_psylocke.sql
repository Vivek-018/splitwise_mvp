CREATE TABLE "monthly_balance_report_sent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"report_period" varchar(7) NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_balance_report_sent_user_id_report_period_unique" UNIQUE("user_id","report_period")
);
--> statement-breakpoint
ALTER TABLE "monthly_balance_report_sent" ADD CONSTRAINT "monthly_balance_report_sent_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;