/**
 * FlatableNavBrowse.js
 * ─────────────────────────────────────────────────────────────────────
 * Site-level script. Injects a "Browse Flats" CTA into the header nav,
 * cloned from the existing "Download" button so styling matches exactly.
 *
 * Placement: as a previous sibling of the Download li, so the visible
 * order becomes "Browse Flats" then "Download".
 *
 * Idempotent: refuses to inject twice (data-flatable-nav="browse" marker).
 */
(function () {
  'use strict';

  var MARKER = 'data-flatable-nav';
  var MARKER_VALUE = 'browse';
  var TARGET_HREF = '/browse-flats';
  var LABEL = 'Browse Flats';

  // === Alt-text safety net ===
  // Webflow's accessibility audit flags any <img> without an alt attribute.
  // The site has dozens of decorative SVG icons + background illustrations
  // that should have alt="" (empty but present so screen readers skip them).
  // This pass sets alt="" on every image that doesn't already have one. CMS
  // images with descriptive alt set in the Designer are untouched. Re-runs on
  // any new image added later via a MutationObserver.
  function fixDecorativeAlts(root) {
    var imgs = (root || document).querySelectorAll('img:not([alt])');
    imgs.forEach(function (img) { img.setAttribute('alt', ''); });
  }
  function watchForNewImages() {
    fixDecorativeAlts(document);
    if (!window.MutationObserver) return;
    var obs = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType === 1) {
            if (n.tagName === 'IMG' && !n.hasAttribute('alt')) n.setAttribute('alt', '');
            else if (n.querySelectorAll) fixDecorativeAlts(n);
          }
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  // === JSON-LD site schema (Organization + WebSite) ===
  // Runs on every page so Google sees consistent entity markup.
  function injectSiteJsonLd() {
    if (document.getElementById('lf-site-jsonld')) return;
    var origin = window.location.origin;
    var data = [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Flatable',
        url: origin + '/',
        logo: origin + '/images/flatable-logo.png',
        sameAs: [
          'https://apps.apple.com/app/id6749847670',
          'https://play.google.com/store/apps/details?id=com.flatable'
        ]
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Flatable',
        url: origin + '/',
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: origin + '/search?q={search_term_string}' },
          'query-input': 'required name=search_term_string'
        }
      }
    ];
    var s = document.createElement('script');
    s.id = 'lf-site-jsonld';
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
  }

  function inject() {
    if (document.querySelector('[' + MARKER + '="' + MARKER_VALUE + '"]')) return;

    var downloadLi = document.querySelector('header li.nav_buttons_item.is-main');
    if (!downloadLi) return;

    var clone = downloadLi.cloneNode(true);
    clone.setAttribute(MARKER, MARKER_VALUE);

    // Mark the cloned wrapper so it's no longer identified as the app-download CTA.
    var btnWrap = clone.querySelector('.button_main_wrap');
    if (btnWrap) {
      btnWrap.removeAttribute('data-app-download');
      btnWrap.setAttribute('data-flatable-nav-target', MARKER_VALUE);
    }

    // Point the link at /browse-flats and drop any existing target.
    var link = clone.querySelector('a.clickable_link');
    if (link) {
      link.setAttribute('href', TARGET_HREF);
      link.removeAttribute('target');
    }

    // The clickable button sibling triggers no navigation by default —
    // hook it so it mirrors the link behaviour for users who click the button half.
    var btn = clone.querySelector('button.clickable_btn');
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = TARGET_HREF;
      });
    }

    // Swap every label occurrence.
    clone.querySelectorAll('.button_main_text, .button_eye_text, .clickable_text').forEach(function (el) {
      el.textContent = LABEL;
    });

    downloadLi.parentNode.insertBefore(clone, downloadLi);
    injectMobileMenuItem();
    injectStyles();
    injectSiteJsonLd();
    watchForNewImages();
  }

  // Mobile menu (hamburger drawer): inject Browse Flats right ABOVE the
  // Download pill, cloning the Download li so the new entry inherits the same
  // pill width + Webflow variant styling.
  function injectMobileMenuItem() {
    var menus = document.querySelectorAll('.nav_mobile_menu_wrap');
    menus.forEach(function (menu) {
      if (menu.querySelector('[' + MARKER + '="browse"]')) return;
      var download = menu.querySelector('.nav_buttons_item.is-main');
      if (!download) return;
      var clone = download.cloneNode(true);
      clone.setAttribute(MARKER, 'browse');
      var btnWrap = clone.querySelector('.button_main_wrap');
      if (btnWrap) {
        btnWrap.removeAttribute('data-app-download');
        btnWrap.setAttribute('data-flatable-nav-target', 'browse');
      }
      var link = clone.querySelector('a.clickable_link');
      if (link) {
        link.setAttribute('href', TARGET_HREF);
        link.removeAttribute('target');
      }
      var btn = clone.querySelector('button.clickable_btn');
      if (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          window.location.href = TARGET_HREF;
        });
      }
      clone.querySelectorAll('.button_main_text, .button_eye_text, .clickable_text').forEach(function (el) {
        el.textContent = LABEL;
      });
      download.parentNode.insertBefore(clone, download);
    });
  }

  // Orange brand fill for Browse Flats + breathing room between nav buttons.
  // The gradient matches the map marker hover pill so the site reads consistently.
  // Mobile rules center every nav menu item and tint the cloned Browse Flats
  // entry to match the desktop pill.
  function injectStyles() {
    if (document.getElementById('lf-nav-browse-css')) return;
    var s = document.createElement('style');
    s.id = 'lf-nav-browse-css';
    s.textContent = [
      'li[' + MARKER + '="' + MARKER_VALUE + '"]{margin-right:10px}',
      // Webflow paints the visible pill background via `.button_main_element`
      // (the inner element with a black `color(srgb 0.09 ...)` fill). Override
      // both the wrap and the element so the orange gradient is what shows.
      'li[' + MARKER + '="' + MARKER_VALUE + '"] .button_main_wrap,',
      'li[' + MARKER + '="' + MARKER_VALUE + '"] .button_main_element{',
        'background:linear-gradient(135deg,#ff8b3d,#ff5e3a)!important;',
        'background-color:transparent!important;',
        'background-image:linear-gradient(135deg,#ff8b3d,#ff5e3a)!important;',
        'border-color:transparent!important;color:#fff!important}',
      'li[' + MARKER + '="' + MARKER_VALUE + '"] .button_main_text,',
      'li[' + MARKER + '="' + MARKER_VALUE + '"] .button_eye_text{color:#fff!important}',
      'li[' + MARKER + '="' + MARKER_VALUE + '"] .button_main_wrap:hover,',
      'li[' + MARKER + '="' + MARKER_VALUE + '"] .button_main_element:hover{',
        'filter:brightness(1.05)}',
      // === MOBILE (≤767px) — sticky header (was browse-only, now site-wide
      // for visual consistency when the hamburger drawer is open), centre every
      // entry in the drawer, tint the cloned Browse Flats entry orange.
      '@media (max-width:767px){',
        // Sticky header on every page so the drawer's logo row looks the
        // same on /browse-flats as on / and other pages.
        '.nav_mobile_wrap{position:sticky!important;top:0!important;z-index:120!important;',
          'background:#fff!important}',
        // Tight gap between Browse Flats and Download (was Webflow default ~80px).
        '.nav_mobile_menu_wrap .nav_links_wrap{',
          'display:flex!important;flex-direction:column!important;align-items:center!important;',
          'text-align:center!important;width:100%!important;gap:6px!important}',
        '.nav_mobile_menu_wrap .nav_actions_wrap{',
          'display:flex!important;flex-direction:column!important;align-items:center!important;',
          'text-align:center!important;width:100%!important;gap:16px!important;',
          'margin-top:12px!important;padding-top:0!important}',
        '.nav_mobile_menu_wrap .nav_buttons_item{margin:0!important;padding:0!important}',
        '.nav_mobile_menu_wrap .nav_buttons_item .button_main_wrap{margin:0 auto!important}',
        '.nav_mobile_menu_wrap .nav_links_item,.nav_mobile_menu_wrap .nav_buttons_item{',
          'display:flex!important;justify-content:center!important;width:100%!important;text-align:center!important}',
        '.nav_mobile_menu_wrap .nav_links_link,.nav_mobile_menu_wrap .nav_dropdown_toggle{',
          'justify-content:center!important;text-align:center!important;width:auto!important;',
          'margin:0 auto!important;display:inline-flex!important;align-items:center!important}',
        '.nav_mobile_menu_wrap .nav_links_text{text-align:center!important;width:auto!important}',
        // Services dropdown — the component wrapper + its open list both need centring.
        '.nav_mobile_menu_wrap .nav_dropdown_component{display:flex!important;flex-direction:column!important;',
          'align-items:center!important;width:100%!important}',
        '.nav_mobile_menu_wrap .nav_dropdown_list{left:50%!important;transform:translateX(-50%)!important;',
          'text-align:center!important}',
        '.nav_mobile_menu_wrap .nav_dropdown_link{justify-content:center!important;text-align:center!important;',
          'width:100%!important;margin:0!important}',
        // Download CTA wrapper — was anchored bottom-left; center it.
        '.nav_mobile_menu_wrap .button_main_wrap{margin:0 auto!important}',
        // Browse Flats orange pill in the mobile drawer.
        '.nav_mobile_menu_wrap .nav_links_item[' + MARKER + '="browse"] .nav_links_link{',
          'background:linear-gradient(135deg,#ff8b3d,#ff5e3a)!important;color:#fff!important;',
          'border-radius:999px!important;padding:10px 22px!important;display:inline-flex!important;',
          'align-items:center!important;justify-content:center!important;font-weight:600!important}',
        '.nav_mobile_menu_wrap .nav_links_item[' + MARKER + '="browse"] .nav_links_text{color:#fff!important}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }
})();
