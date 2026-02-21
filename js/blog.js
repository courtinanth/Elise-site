// ==========================================
// ELISE & MIND — Integration blog (front public)
// Lecture des articles depuis Supabase
// ==========================================

const BLOG_SUPABASE_URL = 'https://fnihtzsynbpcvbztwsku.supabase.co';
const BLOG_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuaWh0enN5bmJwY3ZienR3c2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NDI1NTIsImV4cCI6MjA4NzIxODU1Mn0.vl0Z_Jg8x4vkawxXaW0m2EzuaZdSsQMo-flzH7rxy6c';

// Client Supabase pour le front (lecture seule, articles publies)
const blogSupabase = window.supabase
    ? window.supabase.createClient(BLOG_SUPABASE_URL, BLOG_SUPABASE_KEY)
    : null;

// ==========================================
// FONCTIONS PUBLIQUES
// ==========================================

/**
 * Recuperer la liste des articles publies
 * @param {Object} options - Options de filtrage
 * @param {string} options.collectionSlug - Filtrer par slug de collection
 * @param {number} options.limit - Nombre max d'articles (defaut: 20)
 * @param {number} options.page - Page courante (defaut: 1)
 * @returns {Promise<{articles: Array, total: number}>}
 */
async function getArticles(options = {}) {
    const { collectionSlug, limit = 20, page = 1 } = options;

    try {
        let query = blogSupabase
            .from('articles')
            .select('id, title, slug, excerpt, featured_image, status, meta_title, meta_description, is_indexed, published_at, collection_id, collections(name, slug)', { count: 'exact' })
            .eq('status', 'published')
            .order('published_at', { ascending: false });

        // Filtrer par collection si specifie
        if (collectionSlug) {
            const { data: col } = await blogSupabase
                .from('collections')
                .select('id')
                .eq('slug', collectionSlug)
                .single();

            if (col) {
                query = query.eq('collection_id', col.id);
            } else {
                return { articles: [], total: 0 };
            }
        }

        // Pagination
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;

        if (error) throw error;

        return {
            articles: data || [],
            total: count || 0
        };
    } catch (err) {
        console.error('Erreur chargement articles:', err);
        return { articles: [], total: 0 };
    }
}

/**
 * Recuperer un article par son slug
 * @param {string} slug - Le slug de l'article
 * @returns {Promise<Object|null>}
 */
async function getArticleBySlug(slug) {
    try {
        const { data, error } = await blogSupabase
            .from('articles')
            .select('*, collections(name, slug)')
            .eq('slug', slug)
            .eq('status', 'published')
            .single();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Erreur chargement article:', err);
        return null;
    }
}

/**
 * Recuperer toutes les collections
 * @returns {Promise<Array>}
 */
async function getCollections() {
    try {
        const { data, error } = await blogSupabase
            .from('collections')
            .select('id, name, slug, description')
            .order('name');

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Erreur chargement collections:', err);
        return [];
    }
}

// ==========================================
// GESTION SEO DYNAMIQUE
// ==========================================

/**
 * Appliquer les meta donnees SEO d'un article a la page
 * @param {Object} article - L'article avec ses meta donnees
 */
function applyArticleSeo(article) {
    if (!article) return;

    // Titre de la page
    const pageTitle = article.meta_title || article.title;
    document.title = `${pageTitle} — Elise & Mind`;

    // Meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
        metaDesc.content = article.meta_description || article.excerpt || '';
    } else {
        const meta = document.createElement('meta');
        meta.name = 'description';
        meta.content = article.meta_description || article.excerpt || '';
        document.head.appendChild(meta);
    }

    // Gestion noindex
    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (article.is_indexed === false) {
        if (!robotsMeta) {
            robotsMeta = document.createElement('meta');
            robotsMeta.name = 'robots';
            document.head.appendChild(robotsMeta);
        }
        robotsMeta.content = 'noindex, nofollow';
    } else if (robotsMeta) {
        robotsMeta.content = 'index, follow';
    }

    // Open Graph
    setMetaProperty('og:title', pageTitle);
    setMetaProperty('og:description', article.meta_description || article.excerpt || '');
    setMetaProperty('og:url', `https://eliseandmind.com/blog/${article.slug}`);
    if (article.featured_image) {
        setMetaProperty('og:image', article.featured_image);
    }
    setMetaProperty('og:type', 'article');

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
    }
    canonical.href = `https://eliseandmind.com/blog/${article.slug}`;
}

/**
 * Helper : creer ou mettre a jour une meta property
 */
function setMetaProperty(property, content) {
    let meta = document.querySelector(`meta[property="${property}"]`);
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.appendChild(meta);
    }
    meta.content = content;
}

// ==========================================
// RENDU HTML — CARTE D'ARTICLE
// ==========================================

/**
 * Generer le HTML d'une carte d'article pour la liste
 * @param {Object} article
 * @returns {string} HTML
 */
function renderArticleCard(article) {
    const date = new Date(article.published_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const collectionName = article.collections?.name || '';
    const image = article.featured_image
        ? `<img src="${article.featured_image}" alt="${article.title}" loading="lazy">`
        : '';

    return `
        <article class="blog-card">
            ${image ? `<a href="/blog/${article.slug}" class="blog-card-image">${image}</a>` : ''}
            <div class="blog-card-content">
                ${collectionName ? `<span class="blog-card-category">${collectionName}</span>` : ''}
                <h2><a href="/blog/${article.slug}">${article.title}</a></h2>
                ${article.excerpt ? `<p>${article.excerpt}</p>` : ''}
                <div class="blog-card-meta">
                    <time datetime="${article.published_at}">${date}</time>
                </div>
            </div>
        </article>
    `;
}

/**
 * Generer le HTML du contenu complet d'un article
 * @param {Object} article
 * @returns {string} HTML
 */
function renderArticleContent(article) {
    const date = new Date(article.published_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    return `
        <article class="blog-article">
            <header class="blog-article-header">
                ${article.collections?.name ? `<span class="blog-article-category">${article.collections.name}</span>` : ''}
                <h1>${article.title}</h1>
                <time datetime="${article.published_at}">${date}</time>
            </header>
            ${article.featured_image ? `
                <div class="blog-article-image">
                    <img src="${article.featured_image}" alt="${article.title}">
                </div>
            ` : ''}
            <div class="blog-article-body">
                ${article.content || ''}
            </div>
        </article>
    `;
}

// ==========================================
// INITIALISATION AUTOMATIQUE
// ==========================================

// Si la page contient un conteneur blog, initialiser automatiquement
document.addEventListener('DOMContentLoaded', async () => {
    // Liste d'articles
    const listContainer = document.getElementById('blog-articles-list');
    if (listContainer) {
        const collectionSlug = listContainer.dataset.collection || '';
        const limit = parseInt(listContainer.dataset.limit) || 20;

        const { articles } = await getArticles({ collectionSlug, limit });

        if (articles.length > 0) {
            listContainer.innerHTML = articles.map(renderArticleCard).join('');
        } else {
            listContainer.innerHTML = '<p class="blog-empty">Aucun article pour le moment.</p>';
        }
    }

    // Article individuel (detection par slug dans l'URL)
    const articleContainer = document.getElementById('blog-article-content');
    if (articleContainer) {
        // Extraire le slug depuis l'URL : /blog/mon-slug
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const slugIndex = pathParts.indexOf('blog');
        const slug = slugIndex !== -1 ? pathParts[slugIndex + 1] : null;

        if (slug) {
            const article = await getArticleBySlug(slug);
            if (article) {
                articleContainer.innerHTML = renderArticleContent(article);
                applyArticleSeo(article);
            } else {
                articleContainer.innerHTML = '<p class="blog-empty">Article introuvable.</p>';
            }
        }
    }
});
