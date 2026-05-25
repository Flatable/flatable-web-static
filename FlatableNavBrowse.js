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
  }

  // Mobile menu (hamburger drawer): also add a Browse Flats item there, since
  // FlatableNavBrowse's main job is to surface the CTA everywhere. Centered
  // alongside the rest of the menu via the injected styles below.
  function injectMobileMenuItem() {
    var menus = document.querySelectorAll('.nav_mobile_menu_wrap .nav_links_wrap');
    menus.forEach(function (ul) {
      if (ul.querySelector('[' + MARKER + '="browse"]')) return;
      // Clone the Home link as a template so we inherit Webflow's nav_links_link styling.
      var template = ul.querySelector('.nav_links_item');
      if (!template) return;
      var item = template.cloneNode(true);
      item.setAttribute(MARKER, 'browse');
      // Strip any sub-dropdown markup the template might have had.
      while (item.firstChild) item.removeChild(item.firstChild);
      var a = document.createElement('a');
      a.href = TARGET_HREF;
      a.className = 'nav_links_link w-inline-block';
      var span = document.createElement('div');
      span.className = 'nav_links_text';
      span.textContent = LABEL;
      a.appendChild(span);
      item.appendChild(a);
      ul.insertBefore(item, ul.firstChild);
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
      'li[' + MARKER + '="' + MARKER_VALUE + '"] .button_main_wrap{',
        'background:linear-gradient(135deg,#ff8b3d,#ff5e3a)!important;',
        'border-color:transparent!important;color:#fff!important}',
      'li[' + MARKER + '="' + MARKER_VALUE + '"] .button_main_text,',
      'li[' + MARKER + '="' + MARKER_VALUE + '"] .button_eye_text{color:#fff!important}',
      'li[' + MARKER + '="' + MARKER_VALUE + '"] .button_main_wrap:hover{',
        'filter:brightness(1.05)}',
      // === MOBILE (≤767px) — center the hamburger menu items and tint the
      // Browse Flats entry orange to match the desktop CTA.
      '@media (max-width:767px){',
        '.nav_mobile_menu_wrap .nav_links_wrap{text-align:center!important;align-items:center!important}',
        '.nav_mobile_menu_wrap .nav_links_item{display:flex!important;justify-content:center!important;width:100%!important}',
        '.nav_mobile_menu_wrap .nav_links_link{justify-content:center!important;text-align:center!important;width:auto!important;margin:0 auto!important}',
        '.nav_mobile_menu_wrap .nav_links_text{text-align:center!important}',
        '.nav_mobile_menu_wrap .nav_dropdown_component,.nav_mobile_menu_wrap .nav_dropdown_toggle{justify-content:center!important;text-align:center!important;margin:0 auto!important}',
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
