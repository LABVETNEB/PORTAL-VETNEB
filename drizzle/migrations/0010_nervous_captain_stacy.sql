CREATE TABLE IF NOT EXISTS "active_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinic_user_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"last_access" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "active_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_user_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"last_access" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clinic_public_profiles" (
	"clinic_id" integer PRIMARY KEY NOT NULL,
	"display_name" varchar(255),
	"avatar_storage_path" varchar(512),
	"about_text" text,
	"specialty_text" text,
	"services_text" text,
	"email" varchar(255),
	"phone" varchar(50),
	"locality" varchar(255),
	"country" varchar(255),
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clinic_public_search" (
	"clinic_id" integer PRIMARY KEY NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"avatar_storage_path" varchar(512),
	"about_text" text,
	"specialty_text" text,
	"services_text" text,
	"email" varchar(255),
	"phone" varchar(50),
	"locality" varchar(255),
	"country" varchar(255),
	"is_public" boolean DEFAULT false NOT NULL,
	"has_required_public_fields" boolean DEFAULT false NOT NULL,
	"is_search_eligible" boolean DEFAULT false NOT NULL,
	"profile_quality_score" integer DEFAULT 0 NOT NULL,
	"search_text" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clinic_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinic_id" integer NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"auth_pro_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clinic_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clinics" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_email" varchar(255),
	"contact_phone" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "particular_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"particular_token_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"last_access" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "particular_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "particular_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinic_id" integer NOT NULL,
	"report_id" integer,
	"created_by_admin_id" integer,
	"created_by_clinic_user_id" integer,
	"token_hash" varchar(64) NOT NULL,
	"token_last4" varchar(4) NOT NULL,
	"tutor_last_name" varchar(255) NOT NULL,
	"pet_name" varchar(255) NOT NULL,
	"pet_age" varchar(100) NOT NULL,
	"pet_breed" varchar(255) NOT NULL,
	"pet_sex" varchar(50) NOT NULL,
	"pet_species" varchar(100) NOT NULL,
	"sample_location" text NOT NULL,
	"sample_evolution" text NOT NULL,
	"details_lesion" text,
	"extraction_date" timestamp NOT NULL,
	"shipping_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "particular_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinic_id" integer NOT NULL,
	"upload_date" timestamp,
	"study_type" varchar(100),
	"patient_name" varchar(255),
	"file_name" varchar(255),
	"storage_path" varchar(255) NOT NULL,
	"preview_url" text,
	"download_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reports_storage_path_unique" UNIQUE("storage_path")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "study_tracking_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinic_id" integer NOT NULL,
	"report_id" integer,
	"particular_token_id" integer,
	"created_by_admin_id" integer,
	"created_by_clinic_user_id" integer,
	"reception_at" timestamp NOT NULL,
	"estimated_delivery_at" timestamp NOT NULL,
	"estimated_delivery_auto_calculated_at" timestamp NOT NULL,
	"estimated_delivery_was_manually_adjusted" boolean DEFAULT false NOT NULL,
	"current_stage" varchar(40) DEFAULT 'reception' NOT NULL,
	"processing_at" timestamp,
	"evaluation_at" timestamp,
	"report_development_at" timestamp,
	"delivered_at" timestamp,
	"special_stain_required" boolean DEFAULT false NOT NULL,
	"special_stain_notified_at" timestamp,
	"payment_url" text,
	"admin_contact_email" varchar(255),
	"admin_contact_phone" varchar(50),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "study_tracking_cases_report_id_unique" UNIQUE("report_id"),
	CONSTRAINT "study_tracking_cases_particular_token_id_unique" UNIQUE("particular_token_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "study_tracking_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"study_tracking_case_id" integer NOT NULL,
	"clinic_id" integer NOT NULL,
	"report_id" integer,
	"particular_token_id" integer,
	"type" varchar(80) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "active_sessions" ADD CONSTRAINT "active_sessions_clinic_user_id_clinic_users_id_fk" FOREIGN KEY ("clinic_user_id") REFERENCES "public"."clinic_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clinic_public_profiles" ADD CONSTRAINT "clinic_public_profiles_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clinic_public_search" ADD CONSTRAINT "clinic_public_search_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clinic_users" ADD CONSTRAINT "clinic_users_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "particular_sessions" ADD CONSTRAINT "particular_sessions_particular_token_id_particular_tokens_id_fk" FOREIGN KEY ("particular_token_id") REFERENCES "public"."particular_tokens"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "particular_tokens" ADD CONSTRAINT "particular_tokens_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "particular_tokens" ADD CONSTRAINT "particular_tokens_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "particular_tokens" ADD CONSTRAINT "particular_tokens_created_by_admin_id_admin_users_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "particular_tokens" ADD CONSTRAINT "particular_tokens_created_by_clinic_user_id_clinic_users_id_fk" FOREIGN KEY ("created_by_clinic_user_id") REFERENCES "public"."clinic_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "study_tracking_cases" ADD CONSTRAINT "study_tracking_cases_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "study_tracking_cases" ADD CONSTRAINT "study_tracking_cases_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "study_tracking_cases" ADD CONSTRAINT "study_tracking_cases_particular_token_id_particular_tokens_id_fk" FOREIGN KEY ("particular_token_id") REFERENCES "public"."particular_tokens"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "study_tracking_cases" ADD CONSTRAINT "study_tracking_cases_created_by_admin_id_admin_users_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "study_tracking_cases" ADD CONSTRAINT "study_tracking_cases_created_by_clinic_user_id_clinic_users_id_fk" FOREIGN KEY ("created_by_clinic_user_id") REFERENCES "public"."clinic_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "study_tracking_notifications" ADD CONSTRAINT "study_tracking_notifications_study_tracking_case_id_study_tracking_cases_id_fk" FOREIGN KEY ("study_tracking_case_id") REFERENCES "public"."study_tracking_cases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "study_tracking_notifications" ADD CONSTRAINT "study_tracking_notifications_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "study_tracking_notifications" ADD CONSTRAINT "study_tracking_notifications_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "study_tracking_notifications" ADD CONSTRAINT "study_tracking_notifications_particular_token_id_particular_tokens_id_fk" FOREIGN KEY ("particular_token_id") REFERENCES "public"."particular_tokens"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "active_sessions_token_hash_idx" ON "active_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "active_sessions_clinic_user_id_idx" ON "active_sessions" USING btree ("clinic_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_sessions_token_hash_idx" ON "admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_sessions_admin_user_id_idx" ON "admin_sessions" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clinic_public_profiles_is_public_idx" ON "clinic_public_profiles" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clinic_public_profiles_country_idx" ON "clinic_public_profiles" USING btree ("country");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clinic_public_profiles_locality_idx" ON "clinic_public_profiles" USING btree ("locality");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clinic_public_search_is_public_idx" ON "clinic_public_search" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clinic_public_search_is_search_eligible_idx" ON "clinic_public_search" USING btree ("is_search_eligible");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clinic_public_search_profile_quality_score_idx" ON "clinic_public_search" USING btree ("profile_quality_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clinic_public_search_updated_at_idx" ON "clinic_public_search" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "particular_sessions_token_hash_idx" ON "particular_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "particular_sessions_particular_token_id_idx" ON "particular_sessions" USING btree ("particular_token_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "particular_tokens_token_hash_idx" ON "particular_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "particular_tokens_clinic_id_idx" ON "particular_tokens" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "particular_tokens_report_id_idx" ON "particular_tokens" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "particular_tokens_clinic_created_at_idx" ON "particular_tokens" USING btree ("clinic_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_clinic_id_idx" ON "reports" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_clinic_upload_date_idx" ON "reports" USING btree ("clinic_id","upload_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_clinic_study_type_idx" ON "reports" USING btree ("clinic_id","study_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "study_tracking_cases_clinic_id_idx" ON "study_tracking_cases" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "study_tracking_cases_current_stage_idx" ON "study_tracking_cases" USING btree ("current_stage");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "study_tracking_cases_estimated_delivery_at_idx" ON "study_tracking_cases" USING btree ("estimated_delivery_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "study_tracking_cases_created_at_idx" ON "study_tracking_cases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "study_tracking_notifications_case_id_idx" ON "study_tracking_notifications" USING btree ("study_tracking_case_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "study_tracking_notifications_clinic_id_idx" ON "study_tracking_notifications" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "study_tracking_notifications_particular_token_id_idx" ON "study_tracking_notifications" USING btree ("particular_token_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "study_tracking_notifications_unread_idx" ON "study_tracking_notifications" USING btree ("is_read","created_at");