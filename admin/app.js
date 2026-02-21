// ==========================================
// BACKOFFICE ELISE & MIND — Application principale
// Authentification, routing, vues, CRUD
// ==========================================

// === ÉTAT GLOBAL ===
let currentUser = null;
let isAdmin = false;
let currentPage = 1;
const ITEMS_PER_PAGE = 20;

// === INITIALISATION ===
document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        // Écouter les changements d'authentification
        supabase.auth.onAuthStateChange(handleAuthChange);

        // Vérifier s'il y a une session existante
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            await processLogin(session);
        } else {
            showView('login');
        }
    } catch (err) {
        console.error('Erreur d\'initialisation:', err);
        showView('login');
    }

    // Écouter les changements de route
    window.addEventListener('hashchange', handleRoute);
}

// ==========================================
// AUTHENTIFICATION
// ==========================================

async function handleAuthChange(event, session) {
    if (event === 'SIGNED_IN' && session && !currentUser) {
        await processLogin(session);
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        isAdmin = false;
        showView('login');
    }
}

async function signInWithGoogle() {
    const loginBtn = document.getElementById('btn-google-login');
    const loginLoading = document.getElementById('login-loading');
    const loginError = document.getElementById('login-error');

    loginBtn.classList.add('hidden');
    loginLoading.classList.remove('hidden');
    loginError.classList.add('hidden');

    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/admin/'
            }
        });

        if (error) throw error;
    } catch (err) {
        console.error('Erreur de connexion:', err);
        loginBtn.classList.remove('hidden');
        loginLoading.classList.add('hidden');
        showLoginError('Erreur lors de la connexion. Veuillez reessayer.');
    }
}

async function signOut() {
    try {
        // Arrêter l'auto-save si actif
        if (typeof stopAutoSave === 'function') stopAutoSave();
        // Détruire TinyMCE si actif
        if (typeof destroyTinyMCE === 'function') destroyTinyMCE();

        await supabase.auth.signOut();
        currentUser = null;
        isAdmin = false;
        window.location.hash = '';
        showView('login');
    } catch (err) {
        console.error('Erreur de deconnexion:', err);
        showToast('Erreur lors de la deconnexion', 'error');
    }
}

async function processLogin(session) {
    const email = session.user.email;

    // Vérifier si l'email est dans la liste des admins autorisés
    const authorized = await checkAdminStatus(email);

    if (!authorized) {
        showLoginError('Acces non autorise. Votre compte (' + escapeHtml(email) + ') n\'est pas dans la liste des administrateurs.');
        await supabase.auth.signOut();
        return;
    }

    currentUser = session.user;
    isAdmin = true;

    // Afficher l'interface admin
    document.getElementById('user-email').textContent = email;
    showView('admin');

    // Router vers la bonne page
    if (!window.location.hash || window.location.hash === '#' || window.location.hash.includes('access_token')) {
        window.location.hash = '#dashboard';
    } else {
        handleRoute();
    }
}

async function checkAdminStatus(email) {
    try {
        const { data, error } = await supabase
            .from('allowed_admins')
            .select('email')
            .eq('email', email)
            .single();

        if (error || !data) return false;
        return true;
    } catch {
        return false;
    }
}

function showLoginError(message) {
    const errorDiv = document.getElementById('login-error');
    const loginBtn = document.getElementById('btn-google-login');
    const loginLoading = document.getElementById('login-loading');

    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    loginBtn.classList.remove('hidden');
    loginLoading.classList.add('hidden');
}

// ==========================================
// ROUTEUR (hash-based)
// ==========================================

function handleRoute() {
    if (!isAdmin) return;

    const hash = window.location.hash.slice(1) || 'dashboard';
    const parts = hash.split('/');
    const view = parts[0];
    const action = parts[1];
    const id = parts[2];

    // Mettre à jour la navigation active
    updateActiveNav(view);

    // Rendre la vue appropriée
    switch (view) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'articles':
            if (action === 'new') {
                renderEditor(null);
            } else if (action === 'edit' && id) {
                renderEditor(id);
            } else {
                renderArticlesList();
            }
            break;
        case 'collections':
            renderCollections();
            break;
        case 'media':
            renderMedia();
            break;
        default:
            renderDashboard();
    }
}

function updateActiveNav(view) {
    // Retirer toutes les classes active
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelectorAll('.nav-group').forEach(group => {
        group.classList.remove('open');
    });

    // Ajouter la classe active au bon item
    const activeItem = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
        const group = activeItem.closest('.nav-group');
        if (group) group.classList.add('open');
    }
}

// ==========================================
// GESTION DES VUES
// ==========================================

function showView(view) {
    const loginView = document.getElementById('login-view');
    const adminShell = document.getElementById('admin-shell');

    if (view === 'login') {
        loginView.classList.remove('hidden');
        adminShell.classList.add('hidden');
    } else {
        loginView.classList.add('hidden');
        adminShell.classList.remove('hidden');
    }
}

function toggleSidebar() {
    document.getElementById('admin-sidebar').classList.toggle('open');
}

function toggleNavGroup(event, groupId) {
    const group = document.getElementById(groupId);
    if (group) {
        group.classList.toggle('open');
    }
}

// Fermer la sidebar sur mobile quand on clique un lien
document.addEventListener('click', (e) => {
    if (e.target.closest('.nav-item') || e.target.closest('.nav-subitem')) {
        if (window.innerWidth <= 768) {
            document.getElementById('admin-sidebar').classList.remove('open');
        }
    }
});

// ==========================================
// VUE : TABLEAU DE BORD
// ==========================================

async function renderDashboard() {
    const main = document.getElementById('main-content');
    main.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Chargement...</div>';

    try {
        // Charger les statistiques en parallèle
        const [totalRes, publishedRes, draftRes, recentRes] = await Promise.all([
            supabase.from('articles').select('id', { count: 'exact', head: true }),
            supabase.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'published'),
            supabase.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
            supabase.from('articles').select('id, title, status, updated_at, slug').order('updated_at', { ascending: false }).limit(5)
        ]);

        const totalCount = totalRes.count || 0;
        const publishedCount = publishedRes.count || 0;
        const draftCount = draftRes.count || 0;
        const recentArticles = recentRes.data || [];

        main.innerHTML = `
            <div class="page-header">
                <h1>Tableau de bord</h1>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${totalCount}</div>
                    <div class="stat-label">Articles au total</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${publishedCount}</div>
                    <div class="stat-label">Articles publies</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${draftCount}</div>
                    <div class="stat-label">Brouillons</div>
                </div>
            </div>

            <div class="recent-section">
                <h3>Derniers articles modifies</h3>
                ${recentArticles.length > 0 ? `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Titre</th>
                                <th>Statut</th>
                                <th>Derniere modification</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recentArticles.map(a => `
                                <tr>
                                    <td class="table-title">
                                        <a href="#articles/edit/${a.id}">${escapeHtml(a.title)}</a>
                                    </td>
                                    <td>
                                        <span class="badge ${a.status === 'published' ? 'badge-published' : 'badge-draft'}">
                                            ${a.status === 'published' ? 'Publie' : 'Brouillon'}
                                        </span>
                                    </td>
                                    <td class="text-muted">${formatDate(a.updated_at)}</td>
                                    <td>
                                        <div class="actions-cell">
                                            <button class="btn-icon" onclick="window.location.hash='#articles/edit/${a.id}'" title="Modifier">&#9998;</button>
                                            ${a.status === 'published' ? `<a href="/blog/${a.slug}" target="_blank" class="btn-icon" title="Voir">&#128065;</a>` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<div class="empty-state"><div class="empty-icon">&#x1F4DD;</div><p>Aucun article pour le moment</p><a href="#articles/new" class="btn btn-primary">Creer votre premier article</a></div>'}
            </div>
        `;
    } catch (err) {
        console.error('Erreur dashboard:', err);
        main.innerHTML = '<div class="empty-state"><p>Erreur lors du chargement du tableau de bord</p></div>';
    }
}

// ==========================================
// VUE : LISTE DES ARTICLES
// ==========================================

async function renderArticlesList() {
    const main = document.getElementById('main-content');
    main.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Chargement...</div>';

    // Charger les collections pour le filtre
    const { data: collections } = await supabase.from('collections').select('id, name').order('name');

    main.innerHTML = `
        <div class="page-header">
            <h1>Articles</h1>
            <a href="#articles/new" class="btn btn-primary">+ Nouvel article</a>
        </div>

        <div class="filters-bar">
            <input type="text" id="search-articles" class="search-input" placeholder="Rechercher par titre..." oninput="debounceSearch()">
            <select id="filter-status" class="filter-select" onchange="loadArticlesView()">
                <option value="">Tous les statuts</option>
                <option value="published">Publies</option>
                <option value="draft">Brouillons</option>
            </select>
            <select id="filter-collection" class="filter-select" onchange="loadArticlesView()">
                <option value="">Toutes les collections</option>
                ${(collections || []).map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
            </select>
        </div>

        <div id="articles-table-container">
            <div class="loading-spinner"><div class="spinner"></div> Chargement...</div>
        </div>

        <div id="articles-pagination"></div>
    `;

    currentPage = 1;
    await loadArticlesView();
}

// Debounce pour la recherche
let searchTimeout = null;
function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentPage = 1;
        loadArticlesView();
    }, 300);
}

async function loadArticlesView() {
    const container = document.getElementById('articles-table-container');
    const paginationDiv = document.getElementById('articles-pagination');
    if (!container) return;

    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    const search = document.getElementById('search-articles')?.value || '';
    const status = document.getElementById('filter-status')?.value || '';
    const collection = document.getElementById('filter-collection')?.value || '';

    try {
        let query = supabase
            .from('articles')
            .select('id, title, slug, status, collection_id, created_at, updated_at, collections(name)', { count: 'exact' });

        if (status) query = query.eq('status', status);
        if (collection) query = query.eq('collection_id', collection);
        if (search) query = query.ilike('title', `%${search}%`);

        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        const { data: articles, count, error } = await query
            .order('updated_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        if (!articles || articles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">&#x1F4CB;</div>
                    <p>${search ? 'Aucun article ne correspond a votre recherche' : 'Aucun article'}</p>
                    <a href="#articles/new" class="btn btn-primary">Creer un article</a>
                </div>
            `;
            paginationDiv.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Titre</th>
                        <th>Collection</th>
                        <th>Statut</th>
                        <th>Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${articles.map(a => `
                        <tr>
                            <td class="table-title">
                                <a href="#articles/edit/${a.id}">${escapeHtml(a.title)}</a>
                            </td>
                            <td class="text-muted">${a.collections?.name ? escapeHtml(a.collections.name) : '—'}</td>
                            <td>
                                <span class="badge ${a.status === 'published' ? 'badge-published' : 'badge-draft'}">
                                    ${a.status === 'published' ? 'Publie' : 'Brouillon'}
                                </span>
                            </td>
                            <td class="text-muted">${formatDate(a.updated_at)}</td>
                            <td>
                                <div class="actions-cell">
                                    <button class="btn-icon" onclick="window.location.hash='#articles/edit/${a.id}'" title="Modifier">&#9998;</button>
                                    ${a.status === 'published' ? `<a href="/blog/${a.slug}" target="_blank" class="btn-icon" title="Voir sur le site">&#128065;</a>` : ''}
                                    <button class="btn-icon danger" onclick="confirmDeleteArticle('${a.id}', '${escapeHtml(a.title).replace(/'/g, "\\'")}')" title="Supprimer">&#128465;</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Pagination
        const totalPages = Math.ceil(count / ITEMS_PER_PAGE);
        if (totalPages > 1) {
            paginationDiv.innerHTML = renderPagination(currentPage, totalPages, 'goToArticlesPage');
        } else {
            paginationDiv.innerHTML = '';
        }
    } catch (err) {
        console.error('Erreur chargement articles:', err);
        container.innerHTML = '<div class="empty-state"><p>Erreur lors du chargement des articles</p></div>';
    }
}

function goToArticlesPage(page) {
    currentPage = page;
    loadArticlesView();
    document.getElementById('main-content').scrollTop = 0;
}

async function confirmDeleteArticle(id, title) {
    showConfirm(
        `Etes-vous sur de vouloir supprimer l'article "${title}" ? Cette action est irreversible.`,
        async () => {
            try {
                const { error } = await supabase.from('articles').delete().eq('id', id);
                if (error) throw error;
                showToast('Article supprime', 'success');
                loadArticlesView();
            } catch (err) {
                console.error('Erreur suppression:', err);
                showToast('Erreur lors de la suppression', 'error');
            }
        }
    );
}

// ==========================================
// VUE : COLLECTIONS
// ==========================================

async function renderCollections() {
    const main = document.getElementById('main-content');
    main.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Chargement...</div>';

    try {
        // Charger les collections avec le nombre d'articles
        const { data: collections, error } = await supabase
            .from('collections')
            .select('id, name, slug, description, created_at')
            .order('name');

        if (error) throw error;

        // Compter les articles par collection
        let articleCounts = {};
        if (collections && collections.length > 0) {
            const { data: counts } = await supabase
                .from('articles')
                .select('collection_id');
            if (counts) {
                counts.forEach(a => {
                    if (a.collection_id) {
                        articleCounts[a.collection_id] = (articleCounts[a.collection_id] || 0) + 1;
                    }
                });
            }
        }

        main.innerHTML = `
            <div class="page-header">
                <h1>Collections</h1>
                <button class="btn btn-primary" onclick="showCollectionModal()">+ Nouvelle collection</button>
            </div>

            ${collections && collections.length > 0 ? `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nom</th>
                            <th>Slug</th>
                            <th>Articles</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${collections.map(c => `
                            <tr>
                                <td class="table-title">${escapeHtml(c.name)}</td>
                                <td class="text-muted">${escapeHtml(c.slug)}</td>
                                <td>${articleCounts[c.id] || 0}</td>
                                <td>
                                    <div class="actions-cell">
                                        <button class="btn-icon" onclick="showCollectionModal('${c.id}')" title="Modifier">&#9998;</button>
                                        <button class="btn-icon danger" onclick="confirmDeleteCollection('${c.id}', '${escapeHtml(c.name).replace(/'/g, "\\'")}', ${articleCounts[c.id] || 0})" title="Supprimer">&#128465;</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : `
                <div class="empty-state">
                    <div class="empty-icon">&#x1F4C1;</div>
                    <p>Aucune collection pour le moment</p>
                    <button class="btn btn-primary" onclick="showCollectionModal()">Creer une collection</button>
                </div>
            `}
        `;
    } catch (err) {
        console.error('Erreur collections:', err);
        main.innerHTML = '<div class="empty-state"><p>Erreur lors du chargement des collections</p></div>';
    }
}

async function showCollectionModal(collectionId) {
    let collection = null;

    if (collectionId) {
        const { data } = await supabase
            .from('collections')
            .select('*')
            .eq('id', collectionId)
            .single();
        collection = data;
    }

    const isEdit = !!collection;

    showModal(`
        <div class="modal-header">
            <h3>${isEdit ? 'Modifier la collection' : 'Nouvelle collection'}</h3>
            <button class="modal-close" onclick="hideModal()">&times;</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Nom</label>
                <input type="text" id="collection-name" class="form-input" value="${isEdit ? escapeHtml(collection.name) : ''}" placeholder="Ex: Anxiete, Developpement personnel..." oninput="updateCollectionSlug()">
            </div>
            <div class="form-group">
                <label class="form-label">Slug</label>
                <input type="text" id="collection-slug" class="form-input" value="${isEdit ? escapeHtml(collection.slug) : ''}" placeholder="anxiete">
                <div class="form-hint">URL : eliseandmind.com/blog/collection/<span id="collection-slug-preview">${isEdit ? collection.slug : '...'}</span></div>
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="collection-desc" class="form-textarea" rows="3" placeholder="Description de la collection...">${isEdit ? escapeHtml(collection.description || '') : ''}</textarea>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-outline" onclick="hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="saveCollection('${collectionId || ''}')">${isEdit ? 'Mettre a jour' : 'Creer'}</button>
        </div>
    `);
}

function updateCollectionSlug() {
    const name = document.getElementById('collection-name')?.value || '';
    const slug = slugify(name);
    const slugInput = document.getElementById('collection-slug');
    const slugPreview = document.getElementById('collection-slug-preview');
    if (slugInput) slugInput.value = slug;
    if (slugPreview) slugPreview.textContent = slug || '...';
}

async function saveCollection(collectionId) {
    const name = document.getElementById('collection-name')?.value?.trim();
    const slug = document.getElementById('collection-slug')?.value?.trim();
    const description = document.getElementById('collection-desc')?.value?.trim();

    if (!name || !slug) {
        showToast('Le nom et le slug sont obligatoires', 'error');
        return;
    }

    try {
        const data = { name, slug, description };

        if (collectionId) {
            const { error } = await supabase.from('collections').update(data).eq('id', collectionId);
            if (error) throw error;
            showToast('Collection mise a jour', 'success');
        } else {
            const { error } = await supabase.from('collections').insert(data);
            if (error) throw error;
            showToast('Collection creee', 'success');
        }

        hideModal();
        renderCollections();
    } catch (err) {
        console.error('Erreur sauvegarde collection:', err);
        if (err.message?.includes('duplicate') || err.code === '23505') {
            showToast('Ce slug est deja utilise par une autre collection', 'error');
        } else {
            showToast('Erreur lors de la sauvegarde', 'error');
        }
    }
}

async function confirmDeleteCollection(id, name, articleCount) {
    if (articleCount > 0) {
        showToast(`Impossible de supprimer : ${articleCount} article(s) utilise(nt) cette collection. Deplacez-les d'abord.`, 'warning');
        return;
    }

    showConfirm(
        `Etes-vous sur de vouloir supprimer la collection "${name}" ?`,
        async () => {
            try {
                const { error } = await supabase.from('collections').delete().eq('id', id);
                if (error) throw error;
                showToast('Collection supprimee', 'success');
                renderCollections();
            } catch (err) {
                console.error('Erreur suppression collection:', err);
                showToast('Erreur lors de la suppression', 'error');
            }
        }
    );
}

// ==========================================
// VUE : MÉDIATHÈQUE
// ==========================================

async function renderMedia() {
    const main = document.getElementById('main-content');
    main.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Chargement...</div>';

    try {
        const { data: mediaItems, error } = await supabase
            .from('media')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        main.innerHTML = `
            <div class="page-header">
                <h1>Mediatheque</h1>
            </div>

            <div class="media-upload-zone" id="media-upload-zone"
                 ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleMediaDrop(event)">
                <div class="upload-icon">&#x1F4E4;</div>
                <p>Glissez-deposez vos images ici</p>
                <button class="btn btn-outline mt-1" onclick="document.getElementById('media-file-input').click()">
                    Choisir des fichiers
                </button>
                <input type="file" id="media-file-input" accept="image/*" multiple style="display:none" onchange="handleMediaUpload(this.files)">
            </div>

            <div id="media-grid" class="media-grid">
                ${mediaItems && mediaItems.length > 0 ? mediaItems.map(m => `
                    <div class="media-card" onclick="showMediaDetail('${m.id}')">
                        <img src="${escapeHtml(m.url)}" alt="${escapeHtml(m.alt_text || m.filename || '')}" loading="lazy">
                        <div class="media-card-info">
                            <div class="filename">${escapeHtml(m.filename || 'Image')}</div>
                            <div class="date">${formatDate(m.created_at)}</div>
                        </div>
                    </div>
                `).join('') : '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">&#x1F5BC;</div><p>Aucun media pour le moment</p></div>'}
            </div>
        `;
    } catch (err) {
        console.error('Erreur mediatheque:', err);
        main.innerHTML = '<div class="empty-state"><p>Erreur lors du chargement de la mediatheque</p></div>';
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('dragover');
}

async function handleMediaDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        await handleMediaUpload(files);
    }
}

async function handleMediaUpload(files) {
    if (!files || files.length === 0) return;

    for (const file of files) {
        // Vérifier que c'est une image
        if (!file.type.startsWith('image/')) {
            showToast(`${file.name} n'est pas une image`, 'warning');
            continue;
        }

        // Vérifier la taille (max 5 Mo)
        if (file.size > 5 * 1024 * 1024) {
            showToast(`${file.name} est trop volumineux (max 5 Mo)`, 'warning');
            continue;
        }

        try {
            showToast(`Upload de ${file.name}...`, 'info');

            // Nom unique avec timestamp
            const ext = file.name.split('.').pop();
            const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

            // Upload vers Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('media')
                .upload(uniqueName, file, {
                    contentType: file.type,
                    cacheControl: '31536000'
                });

            if (uploadError) throw uploadError;

            // Obtenir l'URL publique
            const { data: urlData } = supabase.storage.from('media').getPublicUrl(uniqueName);
            const publicUrl = urlData.publicUrl;

            // Enregistrer dans la table media
            const { error: dbError } = await supabase.from('media').insert({
                url: publicUrl,
                filename: file.name,
                alt_text: '',
                uploaded_by: currentUser.email
            });

            if (dbError) throw dbError;

            showToast(`${file.name} uploade avec succes`, 'success');
        } catch (err) {
            console.error('Erreur upload:', err);
            showToast(`Erreur lors de l'upload de ${file.name}`, 'error');
        }
    }

    // Recharger la grille
    renderMedia();
}

async function showMediaDetail(mediaId) {
    const { data: media, error } = await supabase
        .from('media')
        .select('*')
        .eq('id', mediaId)
        .single();

    if (error || !media) {
        showToast('Media introuvable', 'error');
        return;
    }

    showModal(`
        <div class="modal-header">
            <h3>Details du media</h3>
            <button class="modal-close" onclick="hideModal()">&times;</button>
        </div>
        <div class="modal-body">
            <div class="media-detail">
                <div class="media-detail-preview">
                    <img src="${escapeHtml(media.url)}" alt="${escapeHtml(media.alt_text || '')}">
                </div>
                <div class="media-detail-info">
                    <div class="form-group">
                        <label class="form-label">Nom du fichier</label>
                        <div class="text-muted">${escapeHtml(media.filename || 'N/A')}</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Date d'upload</label>
                        <div class="text-muted">${formatDate(media.created_at)}</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">URL</label>
                        <div class="media-url-field">
                            <input type="text" class="form-input" value="${escapeHtml(media.url)}" readonly id="media-url-copy">
                            <button class="btn btn-outline btn-sm" onclick="copyMediaUrl()">Copier</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Texte alternatif</label>
                        <input type="text" id="media-alt-text" class="form-input" value="${escapeHtml(media.alt_text || '')}" placeholder="Description de l'image">
                    </div>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-danger-outline btn-sm" onclick="confirmDeleteMedia('${media.id}', '${escapeHtml(media.filename || '').replace(/'/g, "\\'")}')">Supprimer</button>
            <button class="btn btn-outline" onclick="hideModal()">Fermer</button>
            <button class="btn btn-primary" onclick="updateMediaAlt('${media.id}')">Enregistrer</button>
        </div>
    `);
}

function copyMediaUrl() {
    const input = document.getElementById('media-url-copy');
    if (input) {
        navigator.clipboard.writeText(input.value).then(() => {
            showToast('URL copiee dans le presse-papiers', 'success');
        }).catch(() => {
            input.select();
            document.execCommand('copy');
            showToast('URL copiee', 'success');
        });
    }
}

async function updateMediaAlt(mediaId) {
    const altText = document.getElementById('media-alt-text')?.value?.trim();

    try {
        const { error } = await supabase
            .from('media')
            .update({ alt_text: altText })
            .eq('id', mediaId);

        if (error) throw error;
        showToast('Texte alternatif mis a jour', 'success');
        hideModal();
    } catch (err) {
        console.error('Erreur mise a jour alt:', err);
        showToast('Erreur lors de la mise a jour', 'error');
    }
}

async function confirmDeleteMedia(id, filename) {
    showConfirm(
        `Etes-vous sur de vouloir supprimer "${filename}" ? Cette action est irreversible.`,
        async () => {
            try {
                // Récupérer l'URL pour extraire le nom du fichier dans le storage
                const { data: media } = await supabase
                    .from('media')
                    .select('url')
                    .eq('id', id)
                    .single();

                if (media) {
                    // Extraire le nom du fichier depuis l'URL
                    const urlParts = media.url.split('/');
                    const storageFilename = urlParts[urlParts.length - 1];

                    // Supprimer du storage
                    await supabase.storage.from('media').remove([storageFilename]);
                }

                // Supprimer de la base de données
                const { error } = await supabase.from('media').delete().eq('id', id);
                if (error) throw error;

                showToast('Media supprime', 'success');
                hideModal();
                renderMedia();
            } catch (err) {
                console.error('Erreur suppression media:', err);
                showToast('Erreur lors de la suppression', 'error');
            }
        }
    );
}

// ==========================================
// COMPOSANTS UI : TOASTS
// ==========================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    const icons = {
        success: '&#10004;',
        error: '&#10006;',
        warning: '&#9888;',
        info: '&#8505;'
    };

    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    // Auto-suppression après 4 secondes
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==========================================
// COMPOSANTS UI : MODALES
// ==========================================

function showModal(html) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    content.innerHTML = html;
    overlay.classList.remove('hidden');
}

function hideModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

function handleModalOverlayClick(e) {
    if (e.target === e.currentTarget) {
        hideModal();
    }
}

function showConfirm(message, onConfirm) {
    showModal(`
        <div class="modal-header">
            <h3>Confirmation</h3>
            <button class="modal-close" onclick="hideModal()">&times;</button>
        </div>
        <div class="modal-body">
            <p>${message}</p>
        </div>
        <div class="modal-footer">
            <button class="btn btn-outline" onclick="hideModal()">Annuler</button>
            <button class="btn btn-danger" id="confirm-action-btn">Confirmer</button>
        </div>
    `);

    document.getElementById('confirm-action-btn').onclick = () => {
        hideModal();
        onConfirm();
    };
}

// ==========================================
// COMPOSANTS UI : PAGINATION
// ==========================================

function renderPagination(current, total, callbackName) {
    let html = '<div class="pagination">';

    html += `<button onclick="${callbackName}(${current - 1})" ${current <= 1 ? 'disabled' : ''}>&laquo; Precedent</button>`;

    // Afficher les numéros de pages
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);

    if (start > 1) {
        html += `<button onclick="${callbackName}(1)">1</button>`;
        if (start > 2) html += '<button disabled>...</button>';
    }

    for (let i = start; i <= end; i++) {
        html += `<button onclick="${callbackName}(${i})" class="${i === current ? 'active' : ''}">${i}</button>`;
    }

    if (end < total) {
        if (end < total - 1) html += '<button disabled>...</button>';
        html += `<button onclick="${callbackName}(${total})">${total}</button>`;
    }

    html += `<button onclick="${callbackName}(${current + 1})" ${current >= total ? 'disabled' : ''}>Suivant &raquo;</button>`;
    html += '</div>';

    return html;
}

// ==========================================
// UTILITAIRES
// ==========================================

function slugify(text) {
    if (!text) return '';
    return text
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')    // Supprimer les caractères spéciaux
        .replace(/[\s_]+/g, '-')          // Espaces en tirets
        .replace(/-+/g, '-')             // Tirets multiples en un seul
        .replace(/^-+|-+$/g, '');         // Tirets en début/fin
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}
