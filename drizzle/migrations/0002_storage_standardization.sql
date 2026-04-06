ALTER TABLE clinics RENAME COLUMN drive_folder_id TO storage_folder_path;
ALTER TABLE reports RENAME COLUMN drive_file_id TO storage_path;
ALTER TABLE reports ALTER COLUMN storage_path SET NOT NULL;
