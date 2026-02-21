// ==========================================
// BACKOFFICE ELISE & MIND — Configuration Supabase
// ==========================================

const SUPABASE_URL = 'https://fnihtzsynbpcvbztwsku.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuaWh0enN5bmJwY3ZienR3c2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NDI1NTIsImV4cCI6MjA4NzIxODU1Mn0.vl0Z_Jg8x4vkawxXaW0m2EzuaZdSsQMo-flzH7rxy6c';

// Création du client Supabase (disponible globalement)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// URL de base du storage pour les images
const STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/media`;
