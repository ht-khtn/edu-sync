-- Storage RLS policies for olympia-assets bucket

-- NOTE: storage.objects has RLS enabled by default in Supabase.

-- Public read (guest can load images/audio if bucket is not set public)
CREATE POLICY IF NOT EXISTS "Public read olympia-assets"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'olympia-assets');

-- Authenticated users can upload new objects
CREATE POLICY IF NOT EXISTS "Authenticated upload olympia-assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'olympia-assets');

-- Authenticated users can update (needed when upload() uses upsert)
CREATE POLICY IF NOT EXISTS "Authenticated update olympia-assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'olympia-assets')
WITH CHECK (bucket_id = 'olympia-assets');
