// ==========================================
// ELISE & MIND — Integration blog (front public)
// Lecture des articles depuis Supabase
// Collections dynamiques, pagination, articles associes
// ==========================================

const BLOG_SUPABASE_URL = 'https://fnihtzsynbpcvbztwsku.supabase.co';
const BLOG_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuaWh0enN5bmJwY3ZienR3c2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NDI1NTIsImV4cCI6MjA4NzIxODU1Mn0.vl0Z_Jg8x4vkawxXaW0m2EzuaZdSsQMo-flzH7rxy6c';

const blogSupabase = window.supabase
    ? window.supabase.createClient(BLOG_SUPABASE_URL, BLOG_SUPABASE_KEY)
    : null;

const ARTICLES_PER_PAGE = 16;

// ==========================================
// PALETTE DE COULEURS POUR LES BADGES
// ==========================================

const BADGE_COLORS = [
    { bg: '#E8D5C4', text: '#6B4A2E' },  // Beige/brun (Comprendre)
    { bg: '#D4E8D9', text: '#4A6B50' },  // Vert (Outils)
    { bg: '#D4D8E8', text: '#4A5070' },  // Bleu/lavande (Lifestyle)
    { bg: '#F4D4D4', text: '#8B4A4A' },  // Rose/corail
    { bg: '#E8E4D4', text: '#6B654A' },  // Jaune/or
    { bg: '#D4E4E8', text: '#4A6B70' },  // Sarcelle
    { bg: '#E8D4E8', text: '#704A70' },  // Violet
    { bg: '#D4E8E4', text: '#4A706B' },  // Menthe
    { bg: '#F0DDD4', text: '#7A5A4A' },  // Peche
    { bg: '#DCD4E8', text: '#5A4A70' },  // Mauve
];

// Cache pour l'association collection -> couleur
let collectionColorMap = {};

function getCollectionColor(collectionSlug, collectionIndex) {
    if (collectionColorMap[collectionSlug]) {
        return collectionColorMap[collectionSlug];
    }
    const color = BADGE_COLORS[collectionIndex % BADGE_COLORS.length];
    collectionColorMap[collectionSlug] = color;
    return color;
}

// ==========================================
// FONCTIONS PUBLIQUES
// ==========================================

async function getArticles(options = {}) {
    const { collectionSlug, limit = ARTICLES_PER_PAGE, page = 1 } = options;

    try {
        let query = blogSupabase
            .from('articles')
            .select('id, title, slug, excerpt, featured_image, status, meta_title, meta_description, is_indexed, published_at, collection_id, collections(id, name, slug)', { count: 'exact' })
            .eq('status', 'published')
            .order('published_at', { ascending: false });

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

async function getArticleBySlug(slug) {
    try {
        const { data, error } = await blogSupabase
            .from('articles')
            .select('*, collections(id, name, slug)')
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

async function getCollections() {
    try {
        const { data, error } = await blogSupabase
            .from('collections')
            .select('id, name, slug, description')
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Erreur chargement collections:', err);
        return [];
    }
}

// ==========================================
// ARTICLES ASSOCIES (4 plus proches semantiquement)
// ==========================================

async function getRelatedArticles(article, limit = 4) {
    try {
        // Strategie : meme collection d'abord, puis autres collections, tri par recence
        let related = [];

        // 1. Articles de la meme collection (hors article courant)
        if (article.collection_id) {
            const { data: sameCollection } = await blogSupabase
                .from('articles')
                .select('id, title, slug, excerpt, featured_image, published_at, collection_id, collections(id, name, slug)')
                .eq('status', 'published')
                .eq('collection_id', article.collection_id)
                .neq('id', article.id)
                .order('published_at', { ascending: false })
                .limit(limit);

            if (sameCollection) {
                related = related.concat(sameCollection);
            }
        }

        // 2. Si on n'a pas assez, completer avec d'autres collections
        if (related.length < limit) {
            const excludeIds = [article.id, ...related.map(a => a.id)];
            const remaining = limit - related.length;

            const { data: otherArticles } = await blogSupabase
                .from('articles')
                .select('id, title, slug, excerpt, featured_image, published_at, collection_id, collections(id, name, slug)')
                .eq('status', 'published')
                .not('id', 'in', `(${excludeIds.join(',')})`)
                .order('published_at', { ascending: false })
                .limit(remaining);

            if (otherArticles) {
                related = related.concat(otherArticles);
            }
        }

        return related.slice(0, limit);
    } catch (err) {
        console.error('Erreur articles associes:', err);
        return [];
    }
}

// ==========================================
// CONSTRUCTION DES URLS
// ==========================================

function buildArticleUrl(article) {
    const collectionSlug = article.collections?.slug || 'blog';
    return `/blog/${collectionSlug}/${article.slug}`;
}

// ==========================================
// GESTION SEO DYNAMIQUE
// ==========================================

function applyArticleSeo(article) {
    if (!article) return;

    const pageTitle = article.meta_title || article.title;
    const fullTitle = `${pageTitle} — Elise & Mind`;
    document.title = fullTitle;

    const description = article.meta_description || article.excerpt || '';
    const articleUrl = `https://eliseandmind.com${buildArticleUrl(article)}`;
    const image = article.featured_image || 'https://eliseandmind.com/images/logo-elise-mind.webp';

    // Meta description
    setMetaTag('name', 'description', description);

    // Robots
    if (article.is_indexed === false) {
        setMetaTag('name', 'robots', 'noindex, nofollow');
    } else {
        setMetaTag('name', 'robots', 'index, follow');
    }

    // Open Graph
    setMetaProperty('og:title', pageTitle);
    setMetaProperty('og:description', description);
    setMetaProperty('og:url', articleUrl);
    setMetaProperty('og:image', image);
    setMetaProperty('og:type', 'article');

    // Twitter
    setMetaTag('name', 'twitter:title', pageTitle);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', image);

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
    }
    canonical.href = articleUrl;

    // JSON-LD BlogPosting
    addArticleJsonLd(article, articleUrl, image);
}

function applyListSeo(page, collectionName) {
    const isFirstPage = page <= 1;
    let title = 'Conseils anxiété et hypersensibilité | Blog Elise&Mind';
    let url = 'https://eliseandmind.com/mes-conseils';

    if (collectionName) {
        title = `${collectionName} | Blog Elise&Mind`;
    }
    if (!isFirstPage) {
        title = `${title} — Page ${page}`;
        url += `?page=${page}`;
    }

    document.title = title;

    // Self-canonical pour la pagination
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
    }
    canonical.href = url;

    // Pagination rel links pour Google
    removeLinkRel('prev');
    removeLinkRel('next');
}

function removeLinkRel(rel) {
    const el = document.querySelector(`link[rel="${rel}"]`);
    if (el) el.remove();
}

function addArticleJsonLd(article, url, image) {
    // Supprimer l'ancien JSON-LD s'il existe
    const existing = document.getElementById('article-jsonld');
    if (existing) existing.remove();

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        'headline': article.title,
        'description': article.meta_description || article.excerpt || '',
        'image': image,
        'url': url,
        'datePublished': article.published_at,
        'dateModified': article.updated_at || article.published_at,
        'author': {
            '@type': 'Person',
            'name': 'Elise',
            'url': 'https://eliseandmind.com/mon-histoire'
        },
        'publisher': {
            '@type': 'Organization',
            'name': 'Elise&Mind',
            'url': 'https://eliseandmind.com',
            'logo': {
                '@type': 'ImageObject',
                'url': 'https://eliseandmind.com/images/logo-elise-mind.webp'
            }
        },
        'mainEntityOfPage': {
            '@type': 'WebPage',
            '@id': url
        },
        'inLanguage': 'fr'
    };

    if (article.collections?.name) {
        jsonLd.articleSection = article.collections.name;
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'article-jsonld';
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
}

// ==========================================
// HELPERS META
// ==========================================

function setMetaProperty(property, content) {
    let meta = document.querySelector(`meta[property="${property}"]`);
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.appendChild(meta);
    }
    meta.content = content;
}

function setMetaTag(attr, name, content) {
    let meta = document.querySelector(`meta[${attr}="${name}"]`);
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
    }
    meta.content = content;
}

// ==========================================
// RENDU HTML — CARTE D'ARTICLE (liste)
// ==========================================

function renderArticleCard(article, collections) {
    const date = article.published_at
        ? new Date(article.published_at).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric'
        })
        : '';

    const collectionName = article.collections?.name || '';
    const collectionSlug = article.collections?.slug || '';
    const articleUrl = buildArticleUrl(article);

    // Trouver l'index de la collection pour la couleur
    let colorIndex = 0;
    if (collections && collectionSlug) {
        colorIndex = collections.findIndex(c => c.slug === collectionSlug);
        if (colorIndex < 0) colorIndex = 0;
    }
    const badgeColor = getCollectionColor(collectionSlug, colorIndex);

    const image = article.featured_image
        ? `<img src="${article.featured_image}" alt="${escapeHtmlBlog(article.title)}" loading="lazy">`
        : '';

    const badgeHtml = collectionName
        ? `<span class="article-tag" style="background-color:${badgeColor.bg};color:${badgeColor.text}">${escapeHtmlBlog(collectionName)}</span>`
        : '';

    return `
        <article class="article-carte reveal" data-categorie="${escapeHtmlBlog(collectionSlug)}">
            ${image ? `<a href="${articleUrl}" class="article-carte-image">${image}</a>` : ''}
            <div class="article-carte-contenu">
                ${badgeHtml}
                <span class="article-date">${date}</span>
                <h3><a href="${articleUrl}">${escapeHtmlBlog(article.title)}</a></h3>
                ${article.excerpt ? `<p>${escapeHtmlBlog(article.excerpt)}</p>` : ''}
                <a href="${articleUrl}" class="lire-suite">Lire &rarr;</a>
            </div>
        </article>
    `;
}

// ==========================================
// RENDU HTML — ARTICLE COMPLET
// ==========================================

function renderArticleContent(article, collections) {
    const date = article.published_at
        ? new Date(article.published_at).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric'
        })
        : '';

    const collectionName = article.collections?.name || '';
    const collectionSlug = article.collections?.slug || '';

    let colorIndex = 0;
    if (collections && collectionSlug) {
        colorIndex = collections.findIndex(c => c.slug === collectionSlug);
        if (colorIndex < 0) colorIndex = 0;
    }
    const badgeColor = getCollectionColor(collectionSlug, colorIndex);

    return `
        <div class="container">
            <header class="blog-article-header">
                ${collectionName
                    ? `<a href="/mes-conseils?collection=${collectionSlug}" class="article-tag" style="background-color:${badgeColor.bg};color:${badgeColor.text}">${escapeHtmlBlog(collectionName)}</a>`
                    : ''}
                <h1>${escapeHtmlBlog(article.title)}</h1>
                <time datetime="${article.published_at}">${date}</time>
            </header>
            ${article.featured_image ? `
                <div class="blog-article-image">
                    <img src="${article.featured_image}" alt="${escapeHtmlBlog(article.title)}">
                </div>
            ` : ''}
            <div class="blog-toc-mobile" id="blog-toc-mobile">
                <nav class="blog-toc-nav" aria-label="Sommaire de l'article">
                    <h2 class="blog-toc-title" id="blog-toc-mobile-toggle">Sommaire</h2>
                    <ol class="blog-toc-list" id="blog-toc-list-mobile"></ol>
                </nav>
            </div>
            <div class="blog-article-layout">
                <aside class="blog-toc" id="blog-toc">
                    <nav class="blog-toc-nav" aria-label="Sommaire de l'article">
                        <h2 class="blog-toc-title">Sommaire</h2>
                        <ol class="blog-toc-list" id="blog-toc-list"></ol>
                    </nav>
                </aside>
                <div class="blog-article-body">
                    ${article.content || ''}
                </div>
                <aside class="blog-sidebar-right" id="blog-sidebar-right">
                    <div class="blog-sidebar-sticky">
                        <div class="blog-sidebar-latest" id="blog-sidebar-latest">
                            <h3 class="blog-sidebar-title">Derniers articles</h3>
                            <div class="blog-sidebar-articles" id="blog-sidebar-articles"></div>
                        </div>
                        <div class="blog-sidebar-cta">
                            <div class="blog-sidebar-cta-icon">
                                <img src="/images/favicon.webp" alt="" width="36" height="36">
                            </div>
                            <h3>Ta trousse de secours</h3>
                            <p>Télécharge gratuitement ma Fiche SOS anti-anxiété.</p>
                            <a href="/ressources.html" class="btn btn-primary btn-small">Télécharger &rarr;</a>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    `;
}

// ==========================================
// RENDU HTML — CARTE ARTICLE ASSOCIE
// ==========================================

function renderRelatedCard(article, collections) {
    const date = article.published_at
        ? new Date(article.published_at).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric'
        })
        : '';

    const collectionName = article.collections?.name || '';
    const collectionSlug = article.collections?.slug || '';
    const articleUrl = buildArticleUrl(article);

    let colorIndex = 0;
    if (collections && collectionSlug) {
        colorIndex = collections.findIndex(c => c.slug === collectionSlug);
        if (colorIndex < 0) colorIndex = 0;
    }
    const badgeColor = getCollectionColor(collectionSlug, colorIndex);

    const image = article.featured_image
        ? `<img src="${article.featured_image}" alt="${escapeHtmlBlog(article.title)}" loading="lazy">`
        : '';

    return `
        <article class="related-card">
            ${image ? `<a href="${articleUrl}" class="related-card-image">${image}</a>` : ''}
            <div class="related-card-content">
                ${collectionName
                    ? `<span class="article-tag article-tag-sm" style="background-color:${badgeColor.bg};color:${badgeColor.text}">${escapeHtmlBlog(collectionName)}</span>`
                    : ''}
                <h3><a href="${articleUrl}">${escapeHtmlBlog(article.title)}</a></h3>
                <time datetime="${article.published_at}">${date}</time>
            </div>
        </article>
    `;
}

// ==========================================
// RENDU — FILTRES DYNAMIQUES
// ==========================================

function renderCollectionFilters(collections, activeSlug) {
    let html = `<button class="filtre-btn ${!activeSlug ? 'active' : ''}" data-filtre="tous" onclick="filterByCollection('')">Tous</button>`;

    collections.forEach((col, index) => {
        const isActive = activeSlug === col.slug;
        const color = getCollectionColor(col.slug, index);
        html += `<button class="filtre-btn ${isActive ? 'active' : ''}" data-filtre="${escapeHtmlBlog(col.slug)}" onclick="filterByCollection('${escapeHtmlBlog(col.slug)}')" style="${isActive ? `background:${color.bg};color:${color.text};border-color:${color.bg}` : ''}">${escapeHtmlBlog(col.name)}</button>`;
    });

    return html;
}

// ==========================================
// RENDU — PAGINATION
// ==========================================

function renderBlogPagination(currentPage, totalPages, collectionSlug) {
    if (totalPages <= 1) return '';

    let html = '<nav class="blog-pagination" aria-label="Pagination des articles">';

    // Bouton precedent
    if (currentPage > 1) {
        html += `<a href="${buildPaginationUrl(currentPage - 1, collectionSlug)}" class="pagination-link pagination-prev" onclick="goToPage(${currentPage - 1}, '${collectionSlug || ''}'); return false;">&laquo; Precedent</a>`;
    }

    // Numeros de pages
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    if (start > 1) {
        html += `<a href="${buildPaginationUrl(1, collectionSlug)}" class="pagination-link" onclick="goToPage(1, '${collectionSlug || ''}'); return false;">1</a>`;
        if (start > 2) html += '<span class="pagination-dots">...</span>';
    }

    for (let i = start; i <= end; i++) {
        if (i === currentPage) {
            html += `<span class="pagination-link pagination-current" aria-current="page">${i}</span>`;
        } else {
            html += `<a href="${buildPaginationUrl(i, collectionSlug)}" class="pagination-link" onclick="goToPage(${i}, '${collectionSlug || ''}'); return false;">${i}</a>`;
        }
    }

    if (end < totalPages) {
        if (end < totalPages - 1) html += '<span class="pagination-dots">...</span>';
        html += `<a href="${buildPaginationUrl(totalPages, collectionSlug)}" class="pagination-link" onclick="goToPage(${totalPages}, '${collectionSlug || ''}'); return false;">${totalPages}</a>`;
    }

    // Bouton suivant
    if (currentPage < totalPages) {
        html += `<a href="${buildPaginationUrl(currentPage + 1, collectionSlug)}" class="pagination-link pagination-next" onclick="goToPage(${currentPage + 1}, '${collectionSlug || ''}'); return false;">Suivant &raquo;</a>`;
    }

    html += '</nav>';
    return html;
}

function buildPaginationUrl(page, collectionSlug) {
    let url = '/mes-conseils';
    const params = [];
    if (collectionSlug) params.push(`collection=${collectionSlug}`);
    if (page > 1) params.push(`page=${page}`);
    if (params.length > 0) url += '?' + params.join('&');
    return url;
}

// ==========================================
// RENDU — BREADCRUMB
// ==========================================

function renderBreadcrumb(article) {
    const collectionName = article.collections?.name || '';
    const collectionSlug = article.collections?.slug || '';

    let crumbs = `
        <a href="/">Accueil</a>
        <span class="breadcrumb-sep">/</span>
        <a href="/mes-conseils">Mes Conseils</a>
    `;

    if (collectionName && collectionSlug) {
        crumbs += `
            <span class="breadcrumb-sep">/</span>
            <a href="/mes-conseils?collection=${collectionSlug}">${escapeHtmlBlog(collectionName)}</a>
        `;
    }

    crumbs += `
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">${escapeHtmlBlog(article.title)}</span>
    `;

    return crumbs;
}

// ==========================================
// NAVIGATION & FILTRES
// ==========================================

// Variables globales pour l'etat de la liste
let currentBlogPage = 1;
let currentCollectionSlug = '';
let cachedCollections = [];

async function filterByCollection(slug) {
    currentCollectionSlug = slug;
    currentBlogPage = 1;

    // Mettre a jour l'URL sans recharger
    const url = buildPaginationUrl(1, slug);
    window.history.pushState({}, '', url);

    await loadBlogList();
}

async function goToPage(page, collectionSlug) {
    currentBlogPage = page;
    currentCollectionSlug = collectionSlug || '';

    const url = buildPaginationUrl(page, currentCollectionSlug);
    window.history.pushState({}, '', url);

    await loadBlogList();

    // Scroll vers le haut de la grille
    const grille = document.getElementById('blogGrille');
    if (grille) {
        grille.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ==========================================
// CHARGEMENT LISTE DES ARTICLES (mes-conseils)
// ==========================================

async function loadBlogList() {
    const grille = document.getElementById('blogGrille');
    const filtresContainer = document.getElementById('blogFiltres');
    const paginationContainer = document.getElementById('blogPagination');

    if (!grille) return;

    const isPrerendered = grille.hasAttribute('data-prerendered');
    const isInitialLoad = currentBlogPage <= 1 && !currentCollectionSlug;

    // Si pre-rendu et chargement initial (page 1, pas de filtre), garder le contenu
    // On charge quand meme les filtres et la pagination en arriere-plan
    if (isPrerendered && isInitialLoad) {
        // Retirer le flag pour les navigations suivantes
        grille.removeAttribute('data-prerendered');

        // Charger les collections pour les filtres
        if (cachedCollections.length === 0) {
            cachedCollections = await getCollections();
        }
        cachedCollections.forEach((col, index) => getCollectionColor(col.slug, index));

        if (filtresContainer) {
            filtresContainer.innerHTML = renderCollectionFilters(cachedCollections, currentCollectionSlug);
        }

        // Charger le total pour la pagination
        const { total } = await getArticles({ limit: ARTICLES_PER_PAGE, page: 1 });
        const totalPages = Math.ceil(total / ARTICLES_PER_PAGE);
        if (paginationContainer) {
            paginationContainer.innerHTML = renderBlogPagination(1, totalPages, '');
        }
        return;
    }

    // Mode dynamique : afficher un loader
    grille.innerHTML = '<div class="loading-spinner-blog"><div class="spinner-blog"></div><p>Chargement...</p></div>';

    // Charger les collections si pas en cache
    if (cachedCollections.length === 0) {
        cachedCollections = await getCollections();
    }

    // Initialiser le color map
    cachedCollections.forEach((col, index) => {
        getCollectionColor(col.slug, index);
    });

    // Afficher les filtres dynamiques
    if (filtresContainer) {
        filtresContainer.innerHTML = renderCollectionFilters(cachedCollections, currentCollectionSlug);
    }

    // Charger les articles
    const { articles, total } = await getArticles({
        collectionSlug: currentCollectionSlug || undefined,
        limit: ARTICLES_PER_PAGE,
        page: currentBlogPage
    });

    const totalPages = Math.ceil(total / ARTICLES_PER_PAGE);

    // Mettre a jour SEO
    const collectionName = currentCollectionSlug
        ? cachedCollections.find(c => c.slug === currentCollectionSlug)?.name || ''
        : '';
    applyListSeo(currentBlogPage, collectionName);

    // Afficher les articles
    if (articles.length > 0) {
        grille.innerHTML = articles.map(a => renderArticleCard(a, cachedCollections)).join('');

        // Declencher les animations reveal
        requestAnimationFrame(() => {
            const cartes = grille.querySelectorAll('.article-carte.reveal');
            let delay = 0;
            cartes.forEach(carte => {
                setTimeout(() => carte.classList.add('visible'), delay);
                delay += 80;
            });
        });
    } else {
        grille.innerHTML = '<p class="blog-empty">Aucun article pour le moment.</p>';
    }

    // Afficher la pagination
    if (paginationContainer) {
        paginationContainer.innerHTML = renderBlogPagination(currentBlogPage, totalPages, currentCollectionSlug);
    }
}

// ==========================================
// CHARGEMENT ARTICLE INDIVIDUEL (blog/[cat]/[slug])
// ==========================================

async function loadArticlePage() {
    const articleContainer = document.getElementById('blog-article-content');
    const relatedSection = document.getElementById('related-articles');
    const relatedGrid = document.getElementById('related-articles-grid');
    const breadcrumb = document.getElementById('breadcrumb');

    if (!articleContainer) return;

    const isPrerendered = articleContainer.hasAttribute('data-prerendered');

    // Extraire le slug depuis l'URL : /blog/[categorie]/[slug]
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const blogIndex = pathParts.indexOf('blog');

    if (blogIndex === -1) return;

    // Le slug de l'article est le dernier segment
    const articleSlug = pathParts[pathParts.length - 1];
    const categorySlug = pathParts.length > blogIndex + 2 ? pathParts[blogIndex + 1] : null;

    if (!articleSlug || articleSlug === 'blog') {
        if (!isPrerendered) {
            articleContainer.innerHTML = '<div class="container"><p class="blog-empty">Article introuvable.</p></div>';
        }
        return;
    }

    // Charger l'article depuis Supabase (necessaire pour les articles associes)
    const article = await getArticleBySlug(articleSlug);

    if (!article) {
        if (!isPrerendered) {
            articleContainer.innerHTML = '<div class="container"><p class="blog-empty">Article introuvable.</p></div>';
            document.title = 'Article introuvable — Elise & Mind';
        }
        return;
    }

    // Verifier que la categorie dans l'URL correspond
    if (categorySlug && article.collections?.slug && categorySlug !== article.collections.slug) {
        window.location.replace(buildArticleUrl(article));
        return;
    }

    // Charger les collections pour les couleurs
    const collections = await getCollections();
    collections.forEach((col, index) => {
        getCollectionColor(col.slug, index);
    });

    if (!isPrerendered) {
        // Mode dynamique (fallback) : generer le HTML
        articleContainer.innerHTML = renderArticleContent(article, collections);
        applyArticleSeo(article);
        if (breadcrumb) {
            breadcrumb.innerHTML = renderBreadcrumb(article);
        }
    }
    // Si pre-rendu, le contenu, les meta et le breadcrumb sont deja dans le HTML

    // Construire le sommaire (ajoute le scroll spy et les handlers de clic)
    buildTableOfContents();

    // Charger les 3 derniers articles pour la sidebar droite (mise a jour dynamique)
    loadSidebarLatestArticles(article, collections);

    // Charger et afficher les articles associes
    const related = await getRelatedArticles(article, 4);
    if (related.length > 0 && relatedSection && relatedGrid) {
        relatedGrid.innerHTML = related.map(a => renderRelatedCard(a, collections)).join('');
        relatedSection.style.display = '';
    }
}

// ==========================================
// SOMMAIRE (TOC) — Extraction des H2
// ==========================================

function buildTableOfContents() {
    const tocList = document.getElementById('blog-toc-list');
    const tocListMobile = document.getElementById('blog-toc-list-mobile');
    const articleBody = document.querySelector('.blog-article-body');
    if (!articleBody) return;

    const headings = articleBody.querySelectorAll('h2');
    if (headings.length === 0) {
        // Masquer les sommaires s'il n'y a pas de H2
        const toc = document.getElementById('blog-toc');
        const tocMobile = document.getElementById('blog-toc-mobile');
        if (toc) toc.style.display = 'none';
        if (tocMobile) tocMobile.style.display = 'none';
        return;
    }

    let html = '';
    headings.forEach((heading, index) => {
        const id = 'section-' + index;
        heading.id = id;
        html += `<li><a href="#${id}" class="blog-toc-link" data-target="${id}">${heading.textContent}</a></li>`;
    });

    // Remplir le TOC desktop et mobile
    if (tocList) tocList.innerHTML = html;
    if (tocListMobile) tocListMobile.innerHTML = html;

    // Scroll spy : surligner le lien actif au scroll (desktop)
    const allTocLinks = document.querySelectorAll('.blog-toc-link');
    const observerOptions = {
        rootMargin: '-100px 0px -60% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                allTocLinks.forEach(link => link.classList.remove('active'));
                document.querySelectorAll(`[data-target="${entry.target.id}"]`).forEach(link => {
                    link.classList.add('active');
                });
            }
        });
    }, observerOptions);

    headings.forEach(heading => observer.observe(heading));

    // Smooth scroll au clic (desktop + mobile)
    allTocLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.getElementById(link.dataset.target);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // Toggle mobile TOC
    const mobileToggle = document.getElementById('blog-toc-mobile-toggle');
    if (mobileToggle && tocListMobile) {
        mobileToggle.addEventListener('click', () => {
            mobileToggle.classList.toggle('open');
            tocListMobile.classList.toggle('open');
        });
    }
}

// ==========================================
// SIDEBAR — 3 derniers articles
// ==========================================

async function loadSidebarLatestArticles(currentArticle, collections) {
    const container = document.getElementById('blog-sidebar-articles');
    if (!container) return;

    try {
        const { data } = await blogSupabase
            .from('articles')
            .select('id, title, slug, featured_image, published_at, collection_id, collections(id, name, slug)')
            .eq('status', 'published')
            .neq('id', currentArticle.id)
            .order('published_at', { ascending: false })
            .limit(3);

        if (!data || data.length === 0) {
            container.closest('.blog-sidebar-latest').style.display = 'none';
            return;
        }

        container.innerHTML = data.map(article => {
            const url = buildArticleUrl(article);
            const collectionSlug = article.collections?.slug || '';
            let colorIndex = 0;
            if (collections && collectionSlug) {
                colorIndex = collections.findIndex(c => c.slug === collectionSlug);
                if (colorIndex < 0) colorIndex = 0;
            }
            const badgeColor = getCollectionColor(collectionSlug, colorIndex);

            return `
                <a href="${url}" class="blog-sidebar-article">
                    ${article.featured_image
                        ? `<img src="${article.featured_image}" alt="${escapeHtmlBlog(article.title)}" loading="lazy">`
                        : ''}
                    <div class="blog-sidebar-article-info">
                        ${article.collections?.name
                            ? `<span class="article-tag article-tag-xs" style="background-color:${badgeColor.bg};color:${badgeColor.text}">${escapeHtmlBlog(article.collections.name)}</span>`
                            : ''}
                        <span class="blog-sidebar-article-title">${escapeHtmlBlog(article.title)}</span>
                    </div>
                </a>
            `;
        }).join('');
    } catch (err) {
        console.error('Erreur chargement sidebar articles:', err);
    }
}

// ==========================================
// UTILITAIRE
// ==========================================

function escapeHtmlBlog(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// INITIALISATION AUTOMATIQUE
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    if (!blogSupabase) {
        console.error('Supabase client non disponible');
        return;
    }

    // Page liste d'articles (mes-conseils.html)
    const blogGrille = document.getElementById('blogGrille');
    if (blogGrille) {
        // Lire les parametres de l'URL
        const params = new URLSearchParams(window.location.search);
        currentBlogPage = parseInt(params.get('page')) || 1;
        currentCollectionSlug = params.get('collection') || '';

        await loadBlogList();

        // Gerer navigation avant/arriere du navigateur
        window.addEventListener('popstate', async () => {
            const params = new URLSearchParams(window.location.search);
            currentBlogPage = parseInt(params.get('page')) || 1;
            currentCollectionSlug = params.get('collection') || '';
            await loadBlogList();
        });
    }

    // Page article individuel (blog/index.html)
    const articleContainer = document.getElementById('blog-article-content');
    if (articleContainer && !blogGrille) {
        await loadArticlePage();
    }
});
