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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }
})();
