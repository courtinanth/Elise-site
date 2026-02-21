#!/usr/bin/env node
// ==========================================
// ELISE & MIND — Build script pour pre-rendu du blog
// Genere des pages HTML statiques depuis Supabase
// Usage : node build-blog.js
// ==========================================

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://fnihtzsynbpcvbztwsku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuaWh0enN5bmJwY3ZienR3c2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NDI1NTIsImV4cCI6MjA4NzIxODU1Mn0.vl0Z_Jg8x4vkawxXaW0m2EzuaZdSsQMo-flzH7rxy6c';
const SITE_URL = 'https://eliseandmind.com';
const ROOT = __dirname;

const BADGE_COLORS = [
    { bg: '#E8D5C4', text: '#6B4A2E' },
    { bg: '#D4E8D9', text: '#4A6B50' },
    { bg: '#D4D8E8', text: '#4A5070' },
    { bg: '#F4D4D4', text: '#8B4A4A' },
    { bg: '#E8E4D4', text: '#6B654A' },
    { bg: '#D4E4E8', text: '#4A6B70' },
    { bg: '#E8D4E8', text: '#704A70' },
    { bg: '#D4E8E4', text: '#4A706B' },
    { bg: '#F0DDD4', text: '#7A5A4A' },
    { bg: '#DCD4E8', text: '#5A4A70' },
];

// ==========================================
// SUPABASE REST API
// ==========================================

async function supabaseGet(table, params = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Accept': 'application/json',
            'Prefer': 'count=exact'
        }
    });
    if (!res.ok) throw new Error(`Supabase error: ${res.status} ${await res.text()}`);
    const total = res.headers.get('content-range');
    const data = await res.json();
    return { data, total };
}

async function fetchCollections() {
    const { data } = await supabaseGet('collections', 'select=id,name,slug,description&order=created_at.asc');
    return data || [];
}

async function fetchArticles() {
    const { data } = await supabaseGet(
        'articles',
        'select=id,title,slug,excerpt,content,featured_image,status,meta_title,meta_description,is_indexed,published_at,updated_at,collection_id,collections(id,name,slug)&status=eq.published&order=published_at.desc'
    );
    return data || [];
}

// ==========================================
// HELPERS
// ==========================================

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getCollectionColor(collections, collectionSlug) {
    const index = collections.findIndex(c => c.slug === collectionSlug);
    return BADGE_COLORS[Math.max(0, index) % BADGE_COLORS.length];
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}

function buildArticleUrl(article) {
    const collectionSlug = article.collections?.slug || 'blog';
    return `/blog/${collectionSlug}/${article.slug}`;
}

// Extraire les H2 du contenu HTML et ajouter des IDs
function processH2s(htmlContent) {
    if (!htmlContent) return { content: htmlContent || '', headings: [] };
    const headings = [];
    let index = 0;
    const content = htmlContent.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (match, attrs, text) => {
        const id = `section-${index}`;
        const plainText = text.replace(/<[^>]*>/g, '').trim();
        headings.push({ id, text: plainText });
        index++;
        return `<h2${attrs} id="${id}">${text}</h2>`;
    });
    return { content, headings };
}

function buildTocHtml(headings) {
    if (headings.length === 0) return '';
    const items = headings.map((h, i) =>
        `<li><a href="#${h.id}" class="blog-toc-link" data-target="${h.id}">${escapeHtml(h.text)}</a></li>`
    ).join('\n                            ');
    return items;
}

// ==========================================
// GENERATION HTML — PAGE ARTICLE
// ==========================================

function generateArticlePage(template, article, collections, allArticles) {
    const pageTitle = article.meta_title || article.title;
    const fullTitle = `${escapeHtml(pageTitle)} — Elise & Mind`;
    const description = escapeHtml(article.meta_description || article.excerpt || '');
    const articleUrl = `${SITE_URL}${buildArticleUrl(article)}`;
    const image = article.featured_image || `${SITE_URL}/images/logo-elise-mind.webp`;
    const date = formatDate(article.published_at);
    const collectionName = article.collections?.name || '';
    const collectionSlug = article.collections?.slug || '';
    const badgeColor = getCollectionColor(collections, collectionSlug);
    const robotsContent = article.is_indexed === false ? 'noindex, nofollow' : 'index, follow';

    // Traiter le contenu : extraire H2s et ajouter des IDs
    const { content: processedContent, headings } = processH2s(article.content);
    const tocItems = buildTocHtml(headings);
    const hasToc = headings.length > 0;

    // 3 derniers articles (hors courant) pour la sidebar
    const latestArticles = allArticles
        .filter(a => a.id !== article.id)
        .slice(0, 3);

    const sidebarArticlesHtml = latestArticles.map(a => {
        const url = buildArticleUrl(a);
        const colSlug = a.collections?.slug || '';
        const colColor = getCollectionColor(collections, colSlug);
        return `
                            <a href="${url}" class="blog-sidebar-article">
                                ${a.featured_image ? `<img src="${a.featured_image}" alt="${escapeHtml(a.title)}" loading="lazy">` : ''}
                                <div class="blog-sidebar-article-info">
                                    ${a.collections?.name ? `<span class="article-tag article-tag-xs" style="background-color:${colColor.bg};color:${colColor.text}">${escapeHtml(a.collections.name)}</span>` : ''}
                                    <span class="blog-sidebar-article-title">${escapeHtml(a.title)}</span>
                                </div>
                            </a>`;
    }).join('');

    // Breadcrumb
    let breadcrumbHtml = `
        <a href="/">Accueil</a>
        <span class="breadcrumb-sep">/</span>
        <a href="/mes-conseils">Mes Conseils</a>`;
    if (collectionName && collectionSlug) {
        breadcrumbHtml += `
        <span class="breadcrumb-sep">/</span>
        <a href="/mes-conseils?collection=${collectionSlug}">${escapeHtml(collectionName)}</a>`;
    }
    breadcrumbHtml += `
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">${escapeHtml(article.title)}</span>`;

    // Contenu de l'article complet
    const articleHtml = `
        <div class="container">
            <header class="blog-article-header">
                ${collectionName
                    ? `<a href="/mes-conseils?collection=${collectionSlug}" class="article-tag" style="background-color:${badgeColor.bg};color:${badgeColor.text}">${escapeHtml(collectionName)}</a>`
                    : ''}
                <h1>${escapeHtml(article.title)}</h1>
                <time datetime="${article.published_at}">${date}</time>
            </header>
            ${article.featured_image ? `
            <div class="blog-article-image">
                <img src="${article.featured_image}" alt="${escapeHtml(article.title)}">
            </div>` : ''}
            ${hasToc ? `
            <div class="blog-toc-mobile" id="blog-toc-mobile">
                <nav class="blog-toc-nav" aria-label="Sommaire de l'article">
                    <h2 class="blog-toc-title" id="blog-toc-mobile-toggle">Sommaire</h2>
                    <ol class="blog-toc-list" id="blog-toc-list-mobile">
                        ${tocItems}
                    </ol>
                </nav>
            </div>` : ''}
            <div class="blog-article-layout">
                ${hasToc ? `
                <aside class="blog-toc" id="blog-toc">
                    <nav class="blog-toc-nav" aria-label="Sommaire de l'article">
                        <h2 class="blog-toc-title">Sommaire</h2>
                        <ol class="blog-toc-list" id="blog-toc-list">
                            ${tocItems}
                        </ol>
                    </nav>
                </aside>` : `
                <aside class="blog-toc" id="blog-toc" style="display:none"></aside>`}
                <div class="blog-article-body">
                    ${processedContent}
                </div>
                <aside class="blog-sidebar-right" id="blog-sidebar-right">
                    <div class="blog-sidebar-sticky">
                        <div class="blog-sidebar-latest" id="blog-sidebar-latest">
                            <h3 class="blog-sidebar-title">Derniers articles</h3>
                            <div class="blog-sidebar-articles" id="blog-sidebar-articles">${sidebarArticlesHtml}</div>
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
        </div>`;

    // JSON-LD
    const jsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: article.title,
        description: article.meta_description || article.excerpt || '',
        image: image,
        url: articleUrl,
        datePublished: article.published_at,
        dateModified: article.updated_at || article.published_at,
        author: { '@type': 'Person', name: 'Elise', url: `${SITE_URL}/mon-histoire` },
        publisher: {
            '@type': 'Organization', name: 'Elise&Mind', url: SITE_URL,
            logo: { '@type': 'ImageObject', url: `${SITE_URL}/images/logo-elise-mind.webp` }
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
        inLanguage: 'fr',
        ...(collectionName ? { articleSection: collectionName } : {})
    });

    // Appliquer les remplacements sur le template
    let html = template;

    // Title
    html = html.replace(/<title>.*?<\/title>/, `<title>${fullTitle}</title>`);

    // Meta description
    html = html.replace(/<meta name="description" content="">/, `<meta name="description" content="${description}">`);

    // Robots
    html = html.replace(/<meta name="robots" content="[^"]*">/, `<meta name="robots" content="${robotsContent}">`);

    // Open Graph
    html = html.replace(/<meta property="og:title" content="">/, `<meta property="og:title" content="${escapeHtml(pageTitle)}">`);
    html = html.replace(/<meta property="og:description" content="">/, `<meta property="og:description" content="${description}">`);
    html = html.replace(/<meta property="og:url" content="">/, `<meta property="og:url" content="${articleUrl}">`);
    html = html.replace(/<meta property="og:image" content="">/, `<meta property="og:image" content="${image}">`);

    // Twitter
    html = html.replace(/<meta name="twitter:title" content="">/, `<meta name="twitter:title" content="${escapeHtml(pageTitle)}">`);
    html = html.replace(/<meta name="twitter:description" content="">/, `<meta name="twitter:description" content="${description}">`);
    html = html.replace(/<meta name="twitter:image" content="">/, `<meta name="twitter:image" content="${image}">`);

    // Canonical
    html = html.replace('</head>', `  <link rel="canonical" href="${articleUrl}">\n  <script type="application/ld+json">${jsonLd}</script>\n</head>`);

    // Breadcrumb
    html = html.replace(
        /<nav class="breadcrumb" id="breadcrumb" aria-label="Fil d'Ariane"><\/nav>/,
        `<nav class="breadcrumb" id="breadcrumb" aria-label="Fil d'Ariane">${breadcrumbHtml}</nav>`
    );

    // Article content — ajouter data-prerendered
    html = html.replace(
        /<article class="blog-article-page" id="blog-article-content">[\s\S]*?<\/article>/,
        `<article class="blog-article-page" id="blog-article-content" data-prerendered="true">${articleHtml}</article>`
    );

    return html;
}

// ==========================================
// GENERATION HTML — CARTES ARTICLES (liste)
// ==========================================

function generateArticleCards(articles, collections) {
    return articles.map(article => {
        const date = formatDate(article.published_at);
        const collectionName = article.collections?.name || '';
        const collectionSlug = article.collections?.slug || '';
        const articleUrl = buildArticleUrl(article);
        const badgeColor = getCollectionColor(collections, collectionSlug);

        const image = article.featured_image
            ? `<img src="${article.featured_image}" alt="${escapeHtml(article.title)}" loading="lazy">`
            : '';

        const badgeHtml = collectionName
            ? `<span class="article-tag" style="background-color:${badgeColor.bg};color:${badgeColor.text}">${escapeHtml(collectionName)}</span>`
            : '';

        return `
            <article class="article-carte reveal visible" data-categorie="${escapeHtml(collectionSlug)}">
                ${image ? `<a href="${articleUrl}" class="article-carte-image">${image}</a>` : ''}
                <div class="article-carte-contenu">
                    ${badgeHtml}
                    <span class="article-date">${date}</span>
                    <h3><a href="${articleUrl}">${escapeHtml(article.title)}</a></h3>
                    ${article.excerpt ? `<p>${escapeHtml(article.excerpt)}</p>` : ''}
                    <a href="${articleUrl}" class="lire-suite">Lire &rarr;</a>
                </div>
            </article>`;
    }).join('\n');
}

// ==========================================
// MAIN
// ==========================================

async function main() {
    console.log('=== Build blog — Elise&Mind ===\n');

    // 1. Charger les donnees depuis Supabase
    console.log('Chargement des collections...');
    const collections = await fetchCollections();
    console.log(`  ${collections.length} collection(s) trouvee(s)`);

    console.log('Chargement des articles...');
    const articles = await fetchArticles();
    console.log(`  ${articles.length} article(s) publie(s)\n`);

    if (articles.length === 0) {
        console.log('Aucun article a generer.');
        return;
    }

    // 2. Lire le template article
    const templatePath = path.join(ROOT, 'blog', 'index.html');
    const template = fs.readFileSync(templatePath, 'utf-8');
    console.log('Template article charge.\n');

    // 3. Generer les pages articles
    console.log('Generation des pages articles...');
    let generated = 0;

    for (const article of articles) {
        const collectionSlug = article.collections?.slug || 'blog';
        const dirPath = path.join(ROOT, 'blog', collectionSlug, article.slug);

        // Creer le repertoire
        fs.mkdirSync(dirPath, { recursive: true });

        // Generer le HTML
        const html = generateArticlePage(template, article, collections, articles);

        // Ecrire le fichier
        const filePath = path.join(dirPath, 'index.html');
        fs.writeFileSync(filePath, html, 'utf-8');

        generated++;
        console.log(`  [${generated}/${articles.length}] /blog/${collectionSlug}/${article.slug}/`);
    }

    console.log(`\n${generated} page(s) article generee(s).`);

    // 4. Pre-rendre la liste d'articles dans mes-conseils.html
    console.log('\nPre-rendu de la liste d\'articles (mes-conseils.html)...');
    const listPath = path.join(ROOT, 'mes-conseils.html');
    let listHtml = fs.readFileSync(listPath, 'utf-8');

    // Generer les cartes pour la premiere page (16 articles max)
    const firstPageArticles = articles.slice(0, 16);
    const cardsHtml = generateArticleCards(firstPageArticles, collections);

    // Remplacer le contenu du blogGrille (spinner + noscript → cartes pre-rendues)
    // On repere le bloc entre l'ouverture de blogGrille et le commentaire Pagination
    const grilleStart = listHtml.indexOf('<div class="blog-grille" id="blogGrille">');
    const paginationComment = listHtml.indexOf('<!-- Pagination -->', grilleStart);
    if (grilleStart !== -1 && paginationComment !== -1) {
        // Trouver le </div> qui ferme blogGrille (juste avant le commentaire pagination)
        const closingDiv = listHtml.lastIndexOf('</div>', paginationComment);
        if (closingDiv > grilleStart) {
            const before = listHtml.substring(0, grilleStart);
            const after = listHtml.substring(closingDiv + '</div>'.length);
            listHtml = before +
                `<div class="blog-grille" id="blogGrille" data-prerendered="true">\n${cardsHtml}\n            </div>` +
                after;
        }
    }

    fs.writeFileSync(listPath, listHtml, 'utf-8');
    console.log(`  ${firstPageArticles.length} carte(s) pre-rendues dans mes-conseils.html`);

    console.log('\n=== Build termine avec succes ===');
}

main().catch(err => {
    console.error('Erreur fatale:', err);
    process.exit(1);
});
