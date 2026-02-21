-- =============================================
-- BACKOFFICE ELISE & MIND
-- Script SQL complet pour Supabase
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- =============================================

-- =============================================
-- 1. TABLE DES ADMINISTRATEURS AUTORISÉS
-- =============================================
CREATE TABLE IF NOT EXISTS allowed_admins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Insérer les emails autorisés
INSERT INTO allowed_admins (email) VALUES
    ('contact@eliseandmind.com'),
    ('courtin.lppdg@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- =============================================
-- 2. TABLE DES COLLECTIONS (CATÉGORIES)
-- =============================================
CREATE TABLE IF NOT EXISTS collections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

-- =============================================
-- 3. TABLE DES ARTICLES
-- =============================================
CREATE TABLE IF NOT EXISTS articles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    slug text UNIQUE NOT NULL,
    content text,
    excerpt text,
    featured_image text,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    is_indexed boolean DEFAULT true,
    meta_title text,
    meta_description text,
    collection_id uuid REFERENCES collections(id) ON DELETE SET NULL,
    author_email text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    published_at timestamptz
);

-- =============================================
-- 4. TABLE DES MÉDIAS
-- =============================================
CREATE TABLE IF NOT EXISTS media (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url text NOT NULL,
    filename text,
    alt_text text,
    uploaded_by text,
    created_at timestamptz DEFAULT now()
);

-- =============================================
-- 5. FONCTION DE VÉRIFICATION ADMIN
-- SECURITY DEFINER pour bypasser le RLS sur allowed_admins
-- =============================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM allowed_admins
        WHERE email = (auth.jwt()->>'email')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 6. TRIGGER DE MISE À JOUR AUTOMATIQUE (updated_at)
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_updated_at
    BEFORE UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 7. INDEX POUR LES PERFORMANCES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_collection ON articles(collection_id);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_updated_at ON articles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_collections_slug ON collections(slug);
CREATE INDEX IF NOT EXISTS idx_media_uploaded_by ON media(uploaded_by);

-- =============================================
-- 8. ROW LEVEL SECURITY — ARTICLES
-- =============================================
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Lecture publique : uniquement les articles publiés
CREATE POLICY "articles_public_read" ON articles
    FOR SELECT
    USING (status = 'published');

-- Lecture admin : tous les articles (y compris brouillons)
CREATE POLICY "articles_admin_read" ON articles
    FOR SELECT
    USING (is_admin());

-- Création admin
CREATE POLICY "articles_admin_insert" ON articles
    FOR INSERT
    WITH CHECK (is_admin());

-- Modification admin
CREATE POLICY "articles_admin_update" ON articles
    FOR UPDATE
    USING (is_admin());

-- Suppression admin
CREATE POLICY "articles_admin_delete" ON articles
    FOR DELETE
    USING (is_admin());

-- =============================================
-- 9. ROW LEVEL SECURITY — COLLECTIONS
-- =============================================
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Lecture publique (nécessaire pour le front)
CREATE POLICY "collections_public_read" ON collections
    FOR SELECT
    USING (true);

-- CRUD admin
CREATE POLICY "collections_admin_insert" ON collections
    FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY "collections_admin_update" ON collections
    FOR UPDATE
    USING (is_admin());

CREATE POLICY "collections_admin_delete" ON collections
    FOR DELETE
    USING (is_admin());

-- =============================================
-- 10. ROW LEVEL SECURITY — ALLOWED_ADMINS
-- =============================================
ALTER TABLE allowed_admins ENABLE ROW LEVEL SECURITY;

-- Seuls les utilisateurs authentifiés peuvent vérifier la liste
CREATE POLICY "admins_authenticated_read" ON allowed_admins
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- =============================================
-- 11. ROW LEVEL SECURITY — MEDIA
-- =============================================
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- Lecture publique (URLs d'images)
CREATE POLICY "media_public_read" ON media
    FOR SELECT
    USING (true);

-- Upload admin
CREATE POLICY "media_admin_insert" ON media
    FOR INSERT
    WITH CHECK (is_admin());

-- Suppression admin
CREATE POLICY "media_admin_delete" ON media
    FOR DELETE
    USING (is_admin());

-- =============================================
-- 12. STORAGE — POLITIQUES DU BUCKET "media"
-- IMPORTANT : Créer d'abord le bucket via le Dashboard Supabase :
--   Storage > New bucket > Nom: "media" > Public: ON
-- Puis exécuter ces politiques :
-- =============================================

-- Lecture publique des fichiers
CREATE POLICY "storage_media_public_read" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'media');

-- Upload par les admins uniquement
CREATE POLICY "storage_media_admin_upload" ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'media' AND is_admin());

-- Mise à jour par les admins
CREATE POLICY "storage_media_admin_update" ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'media' AND is_admin());

-- Suppression par les admins
CREATE POLICY "storage_media_admin_delete" ON storage.objects
    FOR DELETE
    USING (bucket_id = 'media' AND is_admin());
