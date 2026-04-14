BEGIN;

CREATE TABLE IF NOT EXISTS study_tracking_cases (
  id serial PRIMARY KEY,
  clinic_id integer NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  report_id integer UNIQUE REFERENCES reports(id) ON DELETE SET NULL,
  particular_token_id integer UNIQUE REFERENCES particular_tokens(id) ON DELETE SET NULL,
  created_by_admin_id integer REFERENCES admin_users(id) ON DELETE SET NULL,
  created_by_clinic_user_id integer REFERENCES clinic_users(id) ON DELETE SET NULL,
  reception_at timestamp NOT NULL,
  estimated_delivery_at timestamp NOT NULL,
  estimated_delivery_auto_calculated_at timestamp NOT NULL,
  estimated_delivery_was_manually_adjusted boolean NOT NULL DEFAULT false,
  current_stage varchar(40) NOT NULL DEFAULT 'reception',
  processing_at timestamp,
  evaluation_at timestamp,
  report_development_at timestamp,
  delivered_at timestamp,
  special_stain_required boolean NOT NULL DEFAULT false,
  special_stain_notified_at timestamp,
  payment_url text,
  admin_contact_email varchar(255),
  admin_contact_phone varchar(50),
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS study_tracking_cases_clinic_id_idx
ON study_tracking_cases(clinic_id);

CREATE INDEX IF NOT EXISTS study_tracking_cases_current_stage_idx
ON study_tracking_cases(current_stage);

CREATE INDEX IF NOT EXISTS study_tracking_cases_estimated_delivery_at_idx
ON study_tracking_cases(estimated_delivery_at);

CREATE INDEX IF NOT EXISTS study_tracking_cases_created_at_idx
ON study_tracking_cases(created_at DESC);

CREATE TABLE IF NOT EXISTS study_tracking_notifications (
  id serial PRIMARY KEY,
  study_tracking_case_id integer NOT NULL REFERENCES study_tracking_cases(id) ON DELETE CASCADE,
  clinic_id integer NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  report_id integer REFERENCES reports(id) ON DELETE SET NULL,
  particular_token_id integer REFERENCES particular_tokens(id) ON DELETE SET NULL,
  type varchar(80) NOT NULL,
  title varchar(255) NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS study_tracking_notifications_case_id_idx
ON study_tracking_notifications(study_tracking_case_id);

CREATE INDEX IF NOT EXISTS study_tracking_notifications_clinic_id_idx
ON study_tracking_notifications(clinic_id);

CREATE INDEX IF NOT EXISTS study_tracking_notifications_particular_token_id_idx
ON study_tracking_notifications(particular_token_id);

CREATE INDEX IF NOT EXISTS study_tracking_notifications_unread_idx
ON study_tracking_notifications(is_read, created_at DESC);

COMMIT;
