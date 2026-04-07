CREATE INDEX IF NOT EXISTS reports_clinic_id_idx
ON reports(clinic_id);

CREATE INDEX IF NOT EXISTS reports_clinic_upload_date_idx
ON reports(clinic_id, upload_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS reports_clinic_study_type_idx
ON reports(clinic_id, study_type);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS reports_patient_name_trgm_idx
ON reports USING gin (patient_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS reports_file_name_trgm_idx
ON reports USING gin (file_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS reports_study_type_trgm_idx
ON reports USING gin (study_type gin_trgm_ops);
