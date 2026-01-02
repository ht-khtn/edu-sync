-- Add asset URL columns to question_set_items (safe for existing DB)

ALTER TABLE olympia.question_set_items
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS audio_url text;
