/* =============================================
   ELISE & MIND — Script principal
   Fonctionnalités :
   - Menu mobile (hamburger)
   - Navigation sticky au scroll
   - Scroll reveal avancé (multidirectionnel + stagger)
   - Filtres de catégories (blog)
   - Barre de progression du scroll
   - Particules flottantes
   - Parallax doux sur les blobs
   - Curseur personnalisé doré
   - Tilt 3D au hover sur les images
   - Texte machine à écrire (hero)
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {

  // Détecter si l'utilisateur préfère les mouvements réduits
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -----------------------------------------
     1. MENU MOBILE (HAMBURGER)
     ----------------------------------------- */
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      mobileMenu.classList.toggle('active');
      document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    });

    const mobileLinks = mobileMenu.querySelectorAll('a');
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  /* -----------------------------------------
     2. NAVIGATION STICKY AU SCROLL
     ----------------------------------------- */
  const navbar = document.getElementById('navbar');

  if (navbar) {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  /* -----------------------------------------
     3. BARRE DE PROGRESSION DU SCROLL
     Affiche une barre dorée en haut de page
     qui progresse avec le scroll
     ----------------------------------------- */
  if (!prefersReducedMotion) {
    const progressBar = document.createElement('div');
    progressBar.classList.add('scroll-progress');
    document.body.prepend(progressBar);

    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      progressBar.style.width = progress + '%';
    }, { passive: true });
  }

  /* -----------------------------------------
     4. SCROLL REVEAL AVANCÉ
     Supporte .reveal, .reveal-left, .reveal-right,
     .reveal-scale, .reveal-rotate
     Ajoute automatiquement un stagger (décalage)
     aux éléments dans une même grille
     ----------------------------------------- */
  const revealSelectors = '.reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-rotate';
  const revealElements = document.querySelectorAll(revealSelectors);

  if (revealElements.length > 0 && 'IntersectionObserver' in window) {
    // Ajouter automatiquement les classes stagger aux enfants des grilles
    const grilles = document.querySelectorAll('.cartes-grille, .articles-grille, .blog-grille, .valeurs-grille, .footer-grille');
    grilles.forEach(grille => {
      const enfants = grille.querySelectorAll(revealSelectors);
      enfants.forEach((enfant, index) => {
        enfant.classList.add('stagger-' + Math.min(index + 1, 6));
      });
    });

    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -50px 0px',
      threshold: 0.08
    };

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, observerOptions);

    revealElements.forEach(el => {
      revealObserver.observe(el);
    });
  } else {
    revealElements.forEach(el => el.classList.add('visible'));
  }

  /* -----------------------------------------
     5. FILTRES DE CATEGORIES (Blog)
     ----------------------------------------- */
  const filtreBtns = document.querySelectorAll('.filtre-btn');
  const blogGrille = document.getElementById('blogGrille');

  if (filtreBtns.length > 0 && blogGrille) {
    const articles = blogGrille.querySelectorAll('.article-carte');

    filtreBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filtreBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filtre = btn.dataset.filtre;
        let delai = 0;

        articles.forEach(article => {
          if (filtre === 'tous' || article.dataset.categorie === filtre) {
            article.style.display = '';
            article.classList.remove('visible');
            // Animation en cascade
            setTimeout(() => article.classList.add('visible'), delai);
            delai += 100;
          } else {
            article.style.display = 'none';
          }
        });
      });
    });
  }

  /* -----------------------------------------
     6. PARTICULES FLOTTANTES
     Crée des petites étoiles/points dorés
     qui flottent doucement en arrière-plan
     ----------------------------------------- */
  if (!prefersReducedMotion && window.innerWidth > 768) {
    const symboles = ['✦', '✧', '☆', '·', '✦'];
    const nbParticules = 12;

    for (let i = 0; i < nbParticules; i++) {
      const particule = document.createElement('span');
      particule.classList.add('particule');
      particule.textContent = symboles[Math.floor(Math.random() * symboles.length)];
      particule.style.left = Math.random() * 100 + 'vw';
      particule.style.fontSize = (6 + Math.random() * 10) + 'px';
      particule.style.animationDuration = (6 + Math.random() * 10) + 's';
      particule.style.animationDelay = Math.random() * 8 + 's';
      document.body.appendChild(particule);
    }
  }

  /* -----------------------------------------
     7. PARALLAX DOUX SUR LES BLOBS
     Les formes organiques bougent légèrement
     en fonction du scroll
     ----------------------------------------- */
  if (!prefersReducedMotion) {
    const blobs = document.querySelectorAll('.blob');

    if (blobs.length > 0) {
      window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        blobs.forEach((blob, index) => {
          const vitesse = index === 0 ? 0.03 : -0.02;
          const translateY = scrollY * vitesse;
          blob.style.transform = `translateY(${translateY}px)`;
        });
      }, { passive: true });
    }
  }

  /* -----------------------------------------
     8. CURSEUR PERSONNALISÉ DORÉ
     Un petit point doré qui suit la souris
     (Desktop uniquement)
     ----------------------------------------- */
  if (!prefersReducedMotion && window.innerWidth > 1024) {
    const cursorDot = document.createElement('div');
    cursorDot.classList.add('cursor-dot');
    document.body.appendChild(cursorDot);

    let mouseX = 0, mouseY = 0;
    let dotX = 0, dotY = 0;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    // Animation fluide avec interpolation
    function animateCursor() {
      dotX += (mouseX - dotX) * 0.15;
      dotY += (mouseY - dotY) * 0.15;
      cursorDot.style.left = dotX - 4 + 'px';
      cursorDot.style.top = dotY - 4 + 'px';
      requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // Grossir le point au survol des éléments interactifs
    const interactifs = document.querySelectorAll('a, button, .carte, .article-carte, .btn, .filtre-btn, .reseau-lien');
    interactifs.forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursorDot.style.transform = 'scale(2.5)';
        cursorDot.style.opacity = '0.4';
      });
      el.addEventListener('mouseleave', () => {
        cursorDot.style.transform = 'scale(1)';
        cursorDot.style.opacity = '0.6';
      });
    });

    // Cacher le point quand la souris quitte la fenêtre
    document.addEventListener('mouseleave', () => cursorDot.classList.add('hidden'));
    document.addEventListener('mouseenter', () => cursorDot.classList.remove('hidden'));
  }

  /* -----------------------------------------
     9. TILT 3D AU HOVER SUR LES IMAGES
     Effet perspective au mouvement de la souris
     sur les éléments .image-placeholder
     ----------------------------------------- */
  if (!prefersReducedMotion && window.innerWidth > 768) {
    const tiltElements = document.querySelectorAll('.image-placeholder, .mockup-placeholder');

    tiltElements.forEach(el => {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / centerY * -8;
        const rotateY = (x - centerX) / centerX * 8;

        el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
      });

      el.addEventListener('mouseleave', () => {
        // Remettre la rotation d'origine (polaroid)
        if (el.classList.contains('polaroid')) {
          el.style.transform = 'rotate(-2deg)';
        } else if (el.classList.contains('polaroid-right')) {
          el.style.transform = 'rotate(2deg)';
        } else {
          el.style.transform = '';
        }
      });
    });
  }

  /* -----------------------------------------
     10. TEXTE MACHINE À ÉCRIRE (HERO)
     Anime le sous-titre du hero lettre par lettre
     ----------------------------------------- */
  if (!prefersReducedMotion) {
    const heroSousTitre = document.querySelector('.hero-sous-titre');

    if (heroSousTitre) {
      const texteOriginal = heroSousTitre.textContent;
      heroSousTitre.textContent = '';
      heroSousTitre.style.borderRight = '2px solid ' + getComputedStyle(document.documentElement).getPropertyValue('--accent-dore');

      let index = 0;
      const vitesseTyping = 25;

      // Attendre que le reveal soit terminé
      setTimeout(() => {
        function typeLettre() {
          if (index < texteOriginal.length) {
            heroSousTitre.textContent += texteOriginal.charAt(index);
            index++;
            setTimeout(typeLettre, vitesseTyping);
          } else {
            // Curseur clignote puis disparaît
            setTimeout(() => {
              heroSousTitre.style.borderRight = 'none';
            }, 2000);
          }
        }
        typeLettre();
      }, 800);
    }
  }

  /* -----------------------------------------
     11. SMOOTH SCROLL POUR LES ANCRES
     ----------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  /* -----------------------------------------
     12. ANIMATION DES LIENS DE NAVIGATION
     Effet magnetique subtil au hover
     ----------------------------------------- */
  if (!prefersReducedMotion && window.innerWidth > 1024) {
    const navLinks = document.querySelectorAll('.navbar-links a');

    navLinks.forEach(link => {
      link.addEventListener('mousemove', (e) => {
        const rect = link.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        link.style.transform = `translate(${x * 0.2}px, ${y * 0.3}px)`;
      });

      link.addEventListener('mouseleave', () => {
        link.style.transform = '';
      });
    });
  }

  /* -----------------------------------------
     13. COMPTEUR ANIMÉ
     Anime les nombres de 0 à leur valeur
     sur les éléments .compteur
     ----------------------------------------- */
  const compteurs = document.querySelectorAll('.compteur');

  if (compteurs.length > 0 && 'IntersectionObserver' in window) {
    const compteurObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const cible = parseInt(el.dataset.cible, 10);
          const duree = 2000;
          const pas = Math.ceil(cible / (duree / 16));
          let actuel = 0;

          function animer() {
            actuel += pas;
            if (actuel >= cible) {
              el.textContent = cible.toLocaleString('fr-FR');
            } else {
              el.textContent = actuel.toLocaleString('fr-FR');
              requestAnimationFrame(animer);
            }
          }
          animer();
          compteurObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    compteurs.forEach(c => compteurObserver.observe(c));
  }

  /* -----------------------------------------
     14. EFFETS AU SCROLL SUR LES SECTIONS
     Légère parallax sur les textes hero
     ----------------------------------------- */
  if (!prefersReducedMotion) {
    const pageHero = document.querySelector('.hero-contenu, .page-hero .container');

    if (pageHero) {
      window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        if (scrollY < window.innerHeight) {
          const opacity = 1 - (scrollY / window.innerHeight) * 0.5;
          const translateY = scrollY * 0.15;
          pageHero.style.opacity = Math.max(opacity, 0.3);
          pageHero.style.transform = `translateY(${translateY}px)`;
        }
      }, { passive: true });
    }
  }

  /* -----------------------------------------
     15. FORMULAIRE NEWSLETTER — SOUMISSION AJAX
     Envoie le formulaire sans rechargement,
     affiche un message de succès inline
     ----------------------------------------- */
  const newsletterForm = document.getElementById('newsletter-form');

  if (newsletterForm) {
    newsletterForm.addEventListener('submit', function (e) {
      e.preventDefault();

      // URL Google Apps Script — REMPLACE PAR TON URL DE DÉPLOIEMENT
      const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkQcXmysRoCIRJwZDNun-0My2PqYe0wmDm7obCrOSZCsddP0_pu2VKvwqeURSh2lOwEw/exec';

      const email = newsletterForm.querySelector('input[name="email"]').value;
      const rgpdConsent = newsletterForm.querySelector('input[name="rgpd_consent"]').checked;
      const submitBtn = newsletterForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.innerHTML;

      // État de chargement
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Envoi en cours...';

      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, rgpd_consent: rgpdConsent })
      })
      .then(() => {
        // Masquer le formulaire et afficher le message de succès
        newsletterForm.style.display = 'none';
        const successMsg = document.getElementById('newsletter-success');
        if (successMsg) {
          successMsg.style.display = 'block';
          successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      })
      .catch(() => {
        // Afficher un message d'erreur
        let errorMsg = newsletterForm.querySelector('.form-message.form-error');
        if (!errorMsg) {
          errorMsg = document.createElement('div');
          errorMsg.className = 'form-message form-error';
          errorMsg.textContent = 'Oups, une erreur est survenue. Réessaie dans quelques instants.';
          newsletterForm.appendChild(errorMsg);
        }
        errorMsg.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      });
    });
  }

  /* -----------------------------------------
     16. SÉPARATEUR DORÉ — ANIMATION DE LARGEUR
     Le séparateur s'anime quand il est visible
     ----------------------------------------- */
  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    const separateurs = document.querySelectorAll('.separateur');

    const sepObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          sepObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    separateurs.forEach(sep => sepObserver.observe(sep));
  }

});
