-- 20260101000014_profiles_and_avatars.sql
-- Personal profile fields and private-by-folder avatar storage.

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS display_title TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE profiles
    DROP CONSTRAINT IF EXISTS profiles_bio_length;
ALTER TABLE profiles
    ADD CONSTRAINT profiles_bio_length CHECK (bio IS NULL OR char_length(bio) <= 200);

CREATE OR REPLACE FUNCTION protect_profile_permissions()
RETURNS TRIGGER AS $$
BEGIN
    IF auth_role() <> 'admin' AND (
        NEW.role IS DISTINCT FROM OLD.role OR
        NEW.branch_id IS DISTINCT FROM OLD.branch_id OR
        NEW.is_active IS DISTINCT FROM OLD.is_active OR
        NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR
        NEW.email IS DISTINCT FROM OLD.email OR
        NEW.full_name IS DISTINCT FROM OLD.full_name
    ) THEN
        RAISE EXCEPTION 'Only Admin can change protected profile fields.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_profiles_protect_permissions ON profiles;
CREATE TRIGGER trg_profiles_protect_permissions
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION protect_profile_permissions();

-- Public image delivery is intentional; writes remain restricted to the owner's folder.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
CREATE POLICY "Avatar images are publicly readable"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
        AND (metadata->>'mimetype') IN ('image/jpeg', 'image/png', 'image/webp')
        AND COALESCE((metadata->>'size')::bigint, 0) <= 2097152
    );

DROP POLICY IF EXISTS "Users can replace their own avatar" ON storage.objects;
CREATE POLICY "Users can replace their own avatar"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update personal profile fields" ON profiles;
CREATE POLICY "Users can update personal profile fields" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can read public profile fields" ON profiles;
CREATE POLICY "Users can read public profile fields" ON profiles
    FOR SELECT TO authenticated
    USING (is_active = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT TO authenticated
    USING (auth_role() = 'admin');
