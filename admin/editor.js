// ==========================================
// BACKOFFICE ELISE & MIND — Editeur d'articles
// TinyMCE, slug, SEO, image, auto-save
// ==========================================

// === ÉTAT DE L'ÉDITEUR ===
let editorInstance = null;
let autoSaveTimer = null;
let hasUnsavedChanges = false;
let currentArticle = null;
let isNewArticle = true;

// ==========================================
// RENDU DE L'ÉDITEUR
// ==========================================

async function renderEditor(articleId) {
    const main = document.getElementById('main-content');
    main.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Chargement...</div>';

    // Arreter l'auto-save et TinyMCE precedents
    stopAutoSave();
    destroyTinyMCE();

    currentArticle = null;
    isNewArticle = !articleId;
    hasUnsavedChanges = false;

    // Charger les collections (avec slug pour l'apercu URL)
    const { data: collections } = await supabase
        .from('collections')
        .select('id, name, slug')
        .order('name');

    // Charger l'article si edition
    if (articleId) {
        const { data, error } = await supabase
            .from('articles')
            .select('*')
            .eq('id', articleId)
            .single();

        if (error || !data) {
            showToast('Article introuvable', 'error');
            window.location.hash = '#articles';
            return;
        }
        currentArticle = data;
    }

    const a = currentArticle || {};

    main.innerHTML = `
        <div class="page-header">
            <div class="flex gap-1" style="align-items:center">
                <a href="#articles" class="btn btn-outline btn-sm">&larr; Retour</a>
                <h1>${isNewArticle ? 'Nouvel article' : 'Modifier l\'article'}</h1>
            </div>
            <div class="autosave-indicator" id="autosave-status"></div>
        </div>

        <div class="editor-layout">
            <!-- === COLONNE PRINCIPALE === -->
            <div class="editor-main">
                <!-- Titre -->
                <input type="text" id="editor-title" class="form-input form-input-title"
                       placeholder="Entrez le titre de l'article"
                       value="${escapeHtml(a.title || '')}"
                       oninput="onTitleChange()">

                <!-- Extrait -->
                <div class="editor-block">
                    <div class="editor-block-header">Extrait</div>
                    <div class="editor-block-body">
                        <textarea id="editor-excerpt" class="form-textarea" rows="3"
                                  placeholder="Resume court de l'article (affiche dans les listes)..."
                                  oninput="markDirty()">${escapeHtml(a.excerpt || '')}</textarea>
                    </div>
                </div>

                <!-- Editeur de contenu (TinyMCE) -->
                <div class="tinymce-wrapper">
                    <textarea id="editor-content">${a.content || ''}</textarea>
                </div>
            </div>

            <!-- === SIDEBAR === -->
            <div class="editor-sidebar">
                <!-- Bloc Publication -->
                <div class="editor-block">
                    <div class="editor-block-header">Publication</div>
                    <div class="editor-block-body">
                        <div class="publish-actions">
                            <div class="form-group" style="margin-bottom:12px">
                                <label class="form-label">Statut</label>
                                <select id="editor-status" class="form-select" onchange="markDirty()">
                                    <option value="draft" ${a.status !== 'published' ? 'selected' : ''}>Brouillon</option>
                                    <option value="published" ${a.status === 'published' ? 'selected' : ''}>Publie</option>
                                </select>
                            </div>
                            <button class="btn btn-primary btn-lg" style="width:100%" onclick="saveCurrentArticle('auto')">
                                ${a.status === 'published' ? 'Mettre a jour' : 'Publier'}
                            </button>
                            <button class="btn btn-outline" style="width:100%" onclick="saveCurrentArticle('draft')">
                                Enregistrer en brouillon
                            </button>
                        </div>
                        ${!isNewArticle ? `
                            <div class="publish-meta mt-2">
                                <div>Cree le : ${formatDate(a.created_at)}</div>
                                <div>Modifie le : ${formatDate(a.updated_at)}</div>
                                ${a.published_at ? `<div>Publie le : ${formatDate(a.published_at)}</div>` : ''}
                            </div>
                            <div class="delete-link" onclick="confirmDeleteCurrentArticle()">Supprimer cet article</div>
                        ` : ''}
                    </div>
                </div>

                <!-- Bloc Slug -->
                <div class="editor-block">
                    <div class="editor-block-header">URL (Slug)</div>
                    <div class="editor-block-body">
                        <div class="form-group" style="margin-bottom:0">
                            <input type="text" id="editor-slug" class="form-input"
                                   value="${escapeHtml(a.slug || '')}"
                                   placeholder="mon-article"
                                   oninput="onSlugInput()">
                            <div class="slug-preview" id="slug-preview">
                                eliseandmind.com/blog/<span id="slug-collection-display">${getCollectionSlugForPreview(a.collection_id, collections)}</span>/<strong id="slug-display">${a.slug || '...'}</strong>
                                <span id="slug-status"></span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bloc SEO -->
                <div class="editor-block">
                    <div class="editor-block-header">SEO</div>
                    <div class="editor-block-body">
                        <div class="form-group">
                            <label class="form-label">Meta Title</label>
                            <input type="text" id="editor-meta-title" class="form-input"
                                   value="${escapeHtml(a.meta_title || '')}"
                                   placeholder="Titre pour les moteurs de recherche"
                                   oninput="onSeoChange()" maxlength="70">
                            <div class="char-counter" id="meta-title-counter">0/60</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Meta Description</label>
                            <textarea id="editor-meta-desc" class="form-textarea" rows="3"
                                      placeholder="Description pour les moteurs de recherche"
                                      oninput="onSeoChange()" maxlength="200">${escapeHtml(a.meta_description || '')}</textarea>
                            <div class="char-counter" id="meta-desc-counter">0/160</div>
                        </div>
                        <div class="form-group">
                            <div class="toggle-wrapper">
                                <label class="toggle">
                                    <input type="checkbox" id="editor-indexed" ${a.is_indexed !== false ? 'checked' : ''} onchange="markDirty()">
                                    <span class="toggle-slider"></span>
                                </label>
                                <span class="toggle-label">Indexer cet article</span>
                            </div>
                        </div>
                        <!-- Apercu Google -->
                        <div class="seo-preview" id="seo-preview">
                            <div class="seo-preview-title" id="seo-preview-title">Titre de l'article</div>
                            <div class="seo-preview-url" id="seo-preview-url">eliseandmind.com/blog/...</div>
                            <div class="seo-preview-desc" id="seo-preview-desc">Description de l'article...</div>
                        </div>
                    </div>
                </div>

                <!-- Bloc Image mise en avant -->
                <div class="editor-block">
                    <div class="editor-block-header">Image mise en avant</div>
                    <div class="editor-block-body">
                        <div id="featured-image-container">
                            ${a.featured_image ? `
                                <div class="featured-image-preview">
                                    <img src="${escapeHtml(a.featured_image)}" alt="">
                                    <button class="remove-image" onclick="removeFeaturedImage()">&times;</button>
                                </div>
                                <div class="alt-text-input">
                                    <input type="text" id="featured-alt" class="form-input" placeholder="Texte alternatif" value="">
                                </div>
                            ` : `
                                <div class="featured-image-zone" id="featured-image-zone"
                                     onclick="document.getElementById('featured-file-input').click()"
                                     ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleFeaturedDrop(event)">
                                    <div class="upload-icon">&#x1F5BC;</div>
                                    <p>Cliquez ou glissez une image</p>
                                </div>
                            `}
                        </div>
                        <input type="file" id="featured-file-input" accept="image/*" style="display:none" onchange="handleFeaturedUpload(this.files[0])">
                    </div>
                </div>

                <!-- Bloc Collection -->
                <div class="editor-block">
                    <div class="editor-block-header">Collection</div>
                    <div class="editor-block-body">
                        <select id="editor-collection" class="form-select" onchange="markDirty(); updateSlugCollectionPreview();">
                            <option value="">— Aucune collection —</option>
                            ${(collections || []).map(c =>
                                `<option value="${c.id}" data-slug="${escapeHtml(c.slug || slugify(c.name))}" ${a.collection_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
                            ).join('')}
                        </select>
                        <button class="btn btn-outline btn-sm mt-1" onclick="showQuickCollectionModal()">+ Nouvelle collection</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Initialiser TinyMCE
    await initTinyMCE();

    // Initialiser les compteurs SEO
    onSeoChange();

    // Démarrer l'auto-save
    startAutoSave();

    // Gérer les changements non sauvegardés
    window.onbeforeunload = () => {
        if (hasUnsavedChanges) return 'Vous avez des modifications non sauvegardees.';
    };
}

// ==========================================
// TINYMCE
// ==========================================

async function initTinyMCE() {
    try {
        const editors = await tinymce.init({
            selector: '#editor-content',
            height: 500,
            language: 'fr_FR',
            plugins: [
                'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
                'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                'insertdatetime', 'media', 'table', 'help', 'wordcount',
                'codesample', 'emoticons', 'preview'
            ],
            toolbar: [
                'undo redo | blocks | bold italic underline strikethrough | forecolor backcolor',
                'alignleft aligncenter alignright alignjustify | bullist numlist | outdent indent',
                'link image media | table blockquote codesample | hr | code fullscreen | removeformat help'
            ],
            menubar: 'file edit view insert format tools table help',
            branding: false,
            promotion: false,
            content_style: `
                body {
                    font-family: 'Inter', system-ui, sans-serif;
                    font-size: 16px;
                    line-height: 1.8;
                    color: #333;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                img { max-width: 100%; height: auto; border-radius: 8px; }
                blockquote { border-left: 4px solid #B8935A; padding-left: 16px; color: #666; font-style: italic; }
                a { color: #4A2C17; }
                table { border-collapse: collapse; width: 100%; }
                table td, table th { border: 1px solid #ddd; padding: 8px 12px; }
                table th { background: #f5f5f5; }
                pre { background: #f4f4f4; padding: 16px; border-radius: 8px; overflow-x: auto; }
                code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
            `,
            // Upload d'images vers Supabase Storage
            images_upload_handler: async (blobInfo) => {
                const file = blobInfo.blob();
                const ext = blobInfo.filename()?.split('.').pop() || 'png';
                const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

                const { error: uploadError } = await supabase.storage
                    .from('media')
                    .upload(uniqueName, file, {
                        contentType: file.type || 'image/png',
                        cacheControl: '31536000'
                    });

                if (uploadError) throw new Error('Erreur upload: ' + uploadError.message);

                const { data: urlData } = supabase.storage.from('media').getPublicUrl(uniqueName);

                // Enregistrer dans la table media
                await supabase.from('media').insert({
                    url: urlData.publicUrl,
                    filename: blobInfo.filename() || uniqueName,
                    alt_text: '',
                    uploaded_by: currentUser.email
                });

                return urlData.publicUrl;
            },
            automatic_uploads: true,
            file_picker_types: 'image',
            setup: (editor) => {
                editor.on('change input', () => {
                    markDirty();
                });
                editorInstance = editor;
            }
        });
    } catch (err) {
        console.error('Erreur initialisation TinyMCE:', err);
        showToast('Erreur lors du chargement de l\'editeur', 'error');
    }
}

function destroyTinyMCE() {
    if (editorInstance) {
        try {
            editorInstance.destroy();
        } catch (e) {
            // Ignorer les erreurs de destruction
        }
        editorInstance = null;
    }
    // Détruire toutes les instances restantes
    if (window.tinymce) {
        tinymce.remove();
    }
}

// ==========================================
// HELPER : SLUG COLLECTION POUR PREVIEW URL
// ==========================================

function getCollectionSlugForPreview(collectionId, collections) {
    if (!collectionId || !collections) return 'blog';
    const col = collections.find(c => c.id === collectionId);
    return col ? col.slug || 'blog' : 'blog';
}

function updateSlugCollectionPreview() {
    const collectionSelect = document.getElementById('editor-collection');
    const collectionDisplay = document.getElementById('slug-collection-display');
    if (!collectionSelect || !collectionDisplay) return;

    const selectedOption = collectionSelect.options[collectionSelect.selectedIndex];
    if (selectedOption && selectedOption.value) {
        // On utilise le slug stocke dans data-slug, ou on slugifie le texte
        const slug = selectedOption.dataset.slug || slugify(selectedOption.textContent);
        collectionDisplay.textContent = slug;
    } else {
        collectionDisplay.textContent = 'blog';
    }
    updateSeoPreview();
}

// ==========================================
// GESTION DU TITRE ET DU SLUG
// ==========================================

let slugManuallyEdited = false;

function onTitleChange() {
    markDirty();

    // Générer le slug automatiquement si pas encore édité manuellement
    if (!slugManuallyEdited || !document.getElementById('editor-slug').value) {
        const title = document.getElementById('editor-title').value;
        const slug = slugify(title);
        document.getElementById('editor-slug').value = slug;
        document.getElementById('slug-display').textContent = slug || '...';
        checkSlugUniqueness(slug);
    }

    // Mettre à jour l'aperçu SEO si meta title vide
    if (!document.getElementById('editor-meta-title').value) {
        updateSeoPreview();
    }
}

function onSlugInput() {
    slugManuallyEdited = true;
    markDirty();
    const slug = document.getElementById('editor-slug').value;
    document.getElementById('slug-display').textContent = slug || '...';
    debouncedSlugCheck(slug);
}

const debouncedSlugCheck = debounce((slug) => {
    checkSlugUniqueness(slug);
}, 500);

async function checkSlugUniqueness(slug) {
    const statusEl = document.getElementById('slug-status');
    if (!slug || !statusEl) return;

    try {
        let query = supabase
            .from('articles')
            .select('id')
            .eq('slug', slug);

        // Exclure l'article actuel en mode édition
        if (currentArticle?.id) {
            query = query.neq('id', currentArticle.id);
        }

        const { data } = await query;

        if (data && data.length > 0) {
            statusEl.textContent = ' \u274C';
            statusEl.title = 'Ce slug est deja utilise';
        } else {
            statusEl.textContent = ' \u2705';
            statusEl.title = 'Slug disponible';
        }
    } catch {
        statusEl.textContent = '';
    }
}

// ==========================================
// SEO
// ==========================================

function onSeoChange() {
    markDirty();
    updateSeoCounters();
    updateSeoPreview();
}

function updateSeoCounters() {
    const metaTitle = document.getElementById('editor-meta-title')?.value || '';
    const metaDesc = document.getElementById('editor-meta-desc')?.value || '';

    const titleCounter = document.getElementById('meta-title-counter');
    const descCounter = document.getElementById('meta-desc-counter');

    if (titleCounter) {
        const len = metaTitle.length;
        titleCounter.textContent = `${len}/60`;
        titleCounter.className = 'char-counter ' + (len === 0 ? '' : len <= 60 ? 'success' : 'danger');
    }

    if (descCounter) {
        const len = metaDesc.length;
        descCounter.textContent = `${len}/160`;
        descCounter.className = 'char-counter ' + (len === 0 ? '' : len <= 160 ? 'success' : 'danger');
    }
}

function updateSeoPreview() {
    const title = document.getElementById('editor-meta-title')?.value || document.getElementById('editor-title')?.value || 'Titre de l\'article';
    const slug = document.getElementById('editor-slug')?.value || '...';
    const collectionSlug = document.getElementById('slug-collection-display')?.textContent || 'blog';
    const desc = document.getElementById('editor-meta-desc')?.value || 'Description de l\'article...';

    const previewTitle = document.getElementById('seo-preview-title');
    const previewUrl = document.getElementById('seo-preview-url');
    const previewDesc = document.getElementById('seo-preview-desc');

    if (previewTitle) previewTitle.textContent = title;
    if (previewUrl) previewUrl.textContent = `eliseandmind.com/blog/${collectionSlug}/${slug}`;
    if (previewDesc) previewDesc.textContent = desc;
}

// ==========================================
// IMAGE MISE EN AVANT
// ==========================================

async function handleFeaturedDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) await handleFeaturedUpload(file);
}

async function handleFeaturedUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
        showToast('Veuillez selectionner une image', 'warning');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast('Image trop volumineuse (max 5 Mo)', 'warning');
        return;
    }

    try {
        showToast('Upload en cours...', 'info');

        const ext = file.name.split('.').pop();
        const uniqueName = `featured-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(uniqueName, file, {
                contentType: file.type,
                cacheControl: '31536000'
            });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('media').getPublicUrl(uniqueName);
        const publicUrl = urlData.publicUrl;

        // Enregistrer dans la table media
        await supabase.from('media').insert({
            url: publicUrl,
            filename: file.name,
            alt_text: '',
            uploaded_by: currentUser.email
        });

        // Mettre à jour l'affichage
        const container = document.getElementById('featured-image-container');
        container.innerHTML = `
            <div class="featured-image-preview">
                <img src="${escapeHtml(publicUrl)}" alt="">
                <button class="remove-image" onclick="removeFeaturedImage()">&times;</button>
            </div>
            <div class="alt-text-input mt-1">
                <input type="text" id="featured-alt" class="form-input" placeholder="Texte alternatif" value="">
            </div>
        `;

        // Stocker l'URL dans un attribut
        container.dataset.imageUrl = publicUrl;
        markDirty();
        showToast('Image mise en avant ajoutee', 'success');
    } catch (err) {
        console.error('Erreur upload image:', err);
        showToast('Erreur lors de l\'upload de l\'image', 'error');
    }
}

function removeFeaturedImage() {
    const container = document.getElementById('featured-image-container');
    container.innerHTML = `
        <div class="featured-image-zone" id="featured-image-zone"
             onclick="document.getElementById('featured-file-input').click()"
             ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleFeaturedDrop(event)">
            <div class="upload-icon">&#x1F5BC;</div>
            <p>Cliquez ou glissez une image</p>
        </div>
    `;
    container.dataset.imageUrl = '';
    markDirty();
}

// ==========================================
// SAUVEGARDE
// ==========================================

async function saveCurrentArticle(mode) {
    // mode: 'draft', 'auto' (utilise le statut choisi), ou 'autosave'

    const title = document.getElementById('editor-title')?.value?.trim();
    const slug = document.getElementById('editor-slug')?.value?.trim();

    if (!title) {
        if (mode !== 'autosave') showToast('Le titre est obligatoire', 'error');
        return;
    }

    if (!slug) {
        if (mode !== 'autosave') showToast('Le slug est obligatoire', 'error');
        return;
    }

    // Determiner le statut
    let status;
    if (mode === 'draft') {
        status = 'draft';
    } else {
        status = document.getElementById('editor-status')?.value || 'draft';
    }

    // Recuperer le contenu TinyMCE
    const content = editorInstance ? editorInstance.getContent() : '';

    // Recuperer l'image mise en avant
    const featuredContainer = document.getElementById('featured-image-container');
    const featuredImg = featuredContainer?.querySelector('.featured-image-preview img');
    const featuredImage = featuredContainer?.dataset?.imageUrl || featuredImg?.src || '';

    const articleData = {
        title: title,
        slug: slug,
        content: content,
        excerpt: document.getElementById('editor-excerpt')?.value?.trim() || '',
        featured_image: featuredImage,
        status: status,
        is_indexed: document.getElementById('editor-indexed')?.checked ?? true,
        meta_title: document.getElementById('editor-meta-title')?.value?.trim() || '',
        meta_description: document.getElementById('editor-meta-desc')?.value?.trim() || '',
        collection_id: document.getElementById('editor-collection')?.value || null,
        author_email: currentUser.email
    };

    // Si on publie pour la premiere fois, ajouter published_at
    if (status === 'published' && (!currentArticle || currentArticle.status !== 'published')) {
        articleData.published_at = new Date().toISOString();
    }

    try {
        if (mode === 'autosave') {
            updateAutoSaveStatus('saving');
        }

        let result;

        if (currentArticle?.id) {
            // Mise a jour
            result = await supabase
                .from('articles')
                .update(articleData)
                .eq('id', currentArticle.id)
                .select()
                .single();
        } else {
            // Creation
            result = await supabase
                .from('articles')
                .insert(articleData)
                .select()
                .single();
        }

        if (result.error) {
            if (result.error.code === '23505' || result.error.message?.includes('duplicate')) {
                showToast('Ce slug est deja utilise. Choisissez-en un autre.', 'error');
                return;
            }
            throw result.error;
        }

        currentArticle = result.data;
        isNewArticle = false;
        hasUnsavedChanges = false;
        slugManuallyEdited = false;

        // Mettre a jour l'URL si c'etait une creation
        if (!window.location.hash.includes(currentArticle.id)) {
            window.history.replaceState(null, '', `#articles/edit/${currentArticle.id}`);
        }

        if (mode === 'autosave') {
            updateAutoSaveStatus('saved');
        } else {
            const msg = status === 'published' ? 'Article publie' : 'Brouillon enregistre';
            showToast(msg, 'success');
        }
    } catch (err) {
        console.error('Erreur sauvegarde:', err);
        if (mode === 'autosave') {
            updateAutoSaveStatus('error');
        } else {
            showToast('Erreur lors de la sauvegarde', 'error');
        }
    }
}

function confirmDeleteCurrentArticle() {
    if (!currentArticle?.id) return;

    showConfirm(
        'Etes-vous sur de vouloir supprimer cet article ? Cette action est irreversible.',
        async () => {
            try {
                const { error } = await supabase.from('articles').delete().eq('id', currentArticle.id);
                if (error) throw error;
                hasUnsavedChanges = false;
                window.onbeforeunload = null;
                showToast('Article supprime', 'success');
                window.location.hash = '#articles';
            } catch (err) {
                console.error('Erreur suppression:', err);
                showToast('Erreur lors de la suppression', 'error');
            }
        }
    );
}

// ==========================================
// AUTO-SAVE
// ==========================================

function startAutoSave() {
    stopAutoSave();
    autoSaveTimer = setInterval(() => {
        if (hasUnsavedChanges && currentArticle?.id) {
            saveCurrentArticle('autosave');
        }
    }, 60000); // Toutes les 60 secondes
}

function stopAutoSave() {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
    }
}

function updateAutoSaveStatus(status) {
    const el = document.getElementById('autosave-status');
    if (!el) return;

    switch (status) {
        case 'saving':
            el.className = 'autosave-indicator saving';
            el.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Sauvegarde...';
            break;
        case 'saved':
            el.className = 'autosave-indicator saved';
            el.textContent = '\u2713 Sauvegarde automatique';
            break;
        case 'error':
            el.className = 'autosave-indicator';
            el.textContent = 'Erreur de sauvegarde';
            break;
        default:
            el.className = 'autosave-indicator';
            el.textContent = '';
    }
}

// ==========================================
// CHANGEMENTS NON SAUVEGARDÉS
// ==========================================

function markDirty() {
    hasUnsavedChanges = true;
}

function markClean() {
    hasUnsavedChanges = false;
}

// ==========================================
// COLLECTION RAPIDE (modale dans l'editeur)
// ==========================================

function showQuickCollectionModal() {
    showModal(`
        <div class="modal-header">
            <h3>Nouvelle collection</h3>
            <button class="modal-close" onclick="hideModal()">&times;</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Nom</label>
                <input type="text" id="quick-collection-name" class="form-input" placeholder="Ex: Anxiete" oninput="updateQuickCollectionSlug()">
            </div>
            <div class="form-group">
                <label class="form-label">Slug</label>
                <input type="text" id="quick-collection-slug" class="form-input" placeholder="anxiete">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-outline" onclick="hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="saveQuickCollection()">Creer</button>
        </div>
    `);
}

function updateQuickCollectionSlug() {
    const name = document.getElementById('quick-collection-name')?.value || '';
    document.getElementById('quick-collection-slug').value = slugify(name);
}

async function saveQuickCollection() {
    const name = document.getElementById('quick-collection-name')?.value?.trim();
    const slug = document.getElementById('quick-collection-slug')?.value?.trim();

    if (!name || !slug) {
        showToast('Le nom et le slug sont obligatoires', 'error');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('collections')
            .insert({ name, slug })
            .select()
            .single();

        if (error) throw error;

        // Ajouter au dropdown et selectionner
        const select = document.getElementById('editor-collection');
        if (select) {
            const option = document.createElement('option');
            option.value = data.id;
            option.dataset.slug = slug;
            option.textContent = name;
            option.selected = true;
            select.appendChild(option);
        }

        hideModal();
        showToast('Collection creee', 'success');
        markDirty();
        updateSlugCollectionPreview();
    } catch (err) {
        console.error('Erreur creation collection:', err);
        if (err.code === '23505') {
            showToast('Ce slug de collection existe deja', 'error');
        } else {
            showToast('Erreur lors de la creation', 'error');
        }
    }
}
