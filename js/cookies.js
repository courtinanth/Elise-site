// ========== COOKIE CONSENT MANAGEMENT ==========

(function() {
  const COOKIE_NAME = 'eliseandmind_cookie_consent';
  const COOKIE_DURATION_DAYS = 30;

  function getCookieConsent() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(COOKIE_NAME + '=')) {
        return cookie.split('=')[1];
      }
    }
    return null;
  }

  function setCookieConsent(value) {
    const date = new Date();
    date.setTime(date.getTime() + (COOKIE_DURATION_DAYS * 24 * 60 * 60 * 1000));
    document.cookie = COOKIE_NAME + '=' + value + '; expires=' + date.toUTCString() + '; path=/; SameSite=Lax';
  }

  function loadTrackingScripts() {
    // Ajouter ici Google Analytics ou tout autre script de tracking
    // Exemple :
    // var script = document.createElement('script');
    // script.src = 'https://www.googletagmanager.com/gtag/js?id=GA_TRACKING_ID';
    // document.head.appendChild(script);
    console.log('Cookies acceptés — scripts de tracking chargés.');
  }

  function removeTrackingCookies() {
    var trackingCookies = ['_ga', '_gid', '_gat'];
    trackingCookies.forEach(function(name) {
      document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    });
    console.log('Cookies refusés — cookies de tracking supprimés.');
  }

  function initCookieBanner() {
    var consent = getCookieConsent();
    var banner = document.getElementById('cookie-banner');

    if (!banner) return;

    if (consent === null) {
      banner.style.display = 'block';
    } else if (consent === 'accepted') {
      loadTrackingScripts();
    }

    var acceptBtn = document.getElementById('cookie-accept');
    if (acceptBtn) {
      acceptBtn.addEventListener('click', function() {
        setCookieConsent('accepted');
        banner.style.display = 'none';
        loadTrackingScripts();
      });
    }

    var refuseBtn = document.getElementById('cookie-refuse');
    if (refuseBtn) {
      refuseBtn.addEventListener('click', function() {
        setCookieConsent('refused');
        banner.style.display = 'none';
        removeTrackingCookies();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieBanner);
  } else {
    initCookieBanner();
  }
})();
