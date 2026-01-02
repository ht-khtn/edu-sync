-- Storage RLS policies for olympia-assets bucket

-- NOTE: storage.objects has RLS enabled by default in Supabase.

-- Public read (guest can load images/audio if bucket is not set public)
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_policies
		WHERE schemaname = 'storage'
			AND tablename = 'objects'
			AND policyname = 'Public read olympia-assets'
	) THEN
		CREATE POLICY "Public read olympia-assets"
		ON storage.objects
		FOR SELECT
		TO anon
		USING (bucket_id = 'olympia-assets');
	END IF;
END $$;

-- Authenticated users can upload new objects
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_policies
		WHERE schemaname = 'storage'
			AND tablename = 'objects'
			AND policyname = 'Authenticated upload olympia-assets'
	) THEN
		CREATE POLICY "Authenticated upload olympia-assets"
		ON storage.objects
		FOR INSERT
		TO authenticated
		WITH CHECK (bucket_id = 'olympia-assets');
	END IF;
END $$;

-- Authenticated users can update (needed when upload() uses upsert)
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_policies
		WHERE schemaname = 'storage'
			AND tablename = 'objects'
			AND policyname = 'Authenticated update olympia-assets'
	) THEN
		CREATE POLICY "Authenticated update olympia-assets"
		ON storage.objects
		FOR UPDATE
		TO authenticated
		USING (bucket_id = 'olympia-assets')
		WITH CHECK (bucket_id = 'olympia-assets');
	END IF;
END $$;
