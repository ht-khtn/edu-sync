-- Ensure bucket exists + fix Storage RLS policies for olympia-assets

-- Bucket (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('olympia-assets', 'olympia-assets', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

-- Drop legacy policies (if any)
DROP POLICY IF EXISTS "Public read olympia-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload olympia-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update olympia-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete olympia-assets" ON storage.objects;

-- Public read (anon + authenticated)
CREATE POLICY "Public read olympia-assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'olympia-assets');

-- Authenticated users can upload their own objects
CREATE POLICY "Authenticated upload olympia-assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'olympia-assets'
  AND auth.uid() = owner
);

-- Authenticated users can update their own objects (needed when upload() uses upsert)
CREATE POLICY "Authenticated update olympia-assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'olympia-assets'
  AND auth.uid() = owner
)
WITH CHECK (
  bucket_id = 'olympia-assets'
  AND auth.uid() = owner
);

-- Authenticated users can delete their own objects
CREATE POLICY "Authenticated delete olympia-assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'olympia-assets'
  AND auth.uid() = owner
);
