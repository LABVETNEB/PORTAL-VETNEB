CREATE TABLE IF NOT EXISTS "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinic_id" integer NOT NULL,
	"created_by_admin_user_id" integer,
	"token" varchar(128) NOT NULL,
	"patient_name" varchar(255),
	"patient_email" varchar(255),
	"description" text,
	"amount_in_cents" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'ARS' NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_link_id" integer NOT NULL,
	"provider" varchar(50) DEFAULT 'manual' NOT NULL,
	"provider_reference" varchar(255),
	"status" varchar(30) NOT NULL,
	"amount_in_cents" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'ARS' NOT NULL,
	"raw_payload" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_created_by_admin_user_id_admin_users_id_fk" FOREIGN KEY ("created_by_admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_link_id_payment_links_id_fk" FOREIGN KEY ("payment_link_id") REFERENCES "public"."payment_links"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_users_email_idx" ON "admin_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_users_is_active_idx" ON "admin_users" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_links_clinic_id_idx" ON "payment_links" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_links_token_idx" ON "payment_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_links_status_idx" ON "payment_links" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_links_expires_at_idx" ON "payment_links" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_transactions_payment_link_id_idx" ON "payment_transactions" USING btree ("payment_link_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_transactions_provider_reference_idx" ON "payment_transactions" USING btree ("provider_reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_transactions_status_idx" ON "payment_transactions" USING btree ("status");
