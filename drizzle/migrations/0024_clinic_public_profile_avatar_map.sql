ALTER TABLE clinic_public_profiles
  ADD COLUMN IF NOT EXISTS public_address varchar(160),
  ADD COLUMN IF NOT EXISTS map_link varchar(2048);

ALTER TABLE clinic_public_search
  ADD COLUMN IF NOT EXISTS public_address varchar(160),
  ADD COLUMN IF NOT EXISTS map_link varchar(2048);

UPDATE clinic_public_search AS search
SET
  public_address = profile.public_address,
  map_link = profile.map_link
FROM clinic_public_profiles AS profile
WHERE
  search.clinic_id = profile.clinic_id
  AND (
    search.public_address IS DISTINCT FROM profile.public_address
    OR search.map_link IS DISTINCT FROM profile.map_link
  );
