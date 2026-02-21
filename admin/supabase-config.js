// ==========================================
// BACKOFFICE ELISE & MIND — Configuration Supabase
// ==========================================

var SUPABASE_URL = 'https://fnihtzsynbpcvbztwsku.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuaWh0enN5bmJwY3ZienR3c2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NDI1NTIsImV4cCI6MjA4NzIxODU1Mn0.vl0Z_Jg8x4vkawxXaW0m2EzuaZdSsQMo-flzH7rxy6c';

// Remplacer la reference de la librairie CDN par le client initialise
// (le CDN declare 'var supabase' sur window, donc on ne peut pas utiliser const/let)
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// URL de base du storage pour les images
var STORAGE_URL = SUPABASE_URL + '/storage/v1/object/public/media';
