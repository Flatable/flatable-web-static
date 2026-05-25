/**
 * FlatableBrowse.js
 * ─────────────────────────────────────────────────────────────────────
 * Consolidated browse-flats interactivity for flatable-test.webflow.io
 * and (eventually) flatable.ch /browse-flats.
 *
 * Sections (search by `=== N. ` to navigate):
 *   1. CONFIG
 *   2. UTILITIES
 *   3. LENIS ISOLATION — block page scroll over map
 *   4. MAPLIBRE LOADER — fetch lib + tile style, create map
 *   5. CARDS DATA — extract per-card data from DOM
 *   6. MARKERS — rent-pill divIcons, dedupe overlapping, hover sync
 *   7. CARDS HIDE/REFLOW — viewport + filter combined
 *   8. CLICK SCROLL + PULSE — marker click → smart scroll
 *   9. TOOLBAR UI — inject search input + SVG icons in buttons
 *  10. SORT MENU — dropdown with 5 sort modes
 *  11. FILTER PANEL — full app-parity filter set
 *  12. SEARCH GEOCODING — Nominatim → flyTo
 *  13. FOOTER RELEASE — slide toolbar away when footer enters
 *  14. INJECTED CSS — orange marker hover, z-index pop, pulse keyframes
 *  15. BOOTSTRAP — sequencer that fires everything
 *
 * NOTE on innerHTML: every assignment in this file uses static hardcoded
 * strings (SVG icons, panel structure) or trusted CMS text already
 * sanitized by Webflow. No user input flows into innerHTML — no XSS surface.
 *
 * Hosted at: https://cdn.jsdelivr.net/gh/Flatable/flatable-web-static@<sha>/FlatableBrowse.js
 */
(() => {
  'use strict';

  // === 1. CONFIG ===
  const CFG = {
    mapMountId: 'lfb-map-leaflet',
    tileStyle: 'https://tiles.openfreemap.org/styles/liberty',
    initialCenter: [8.22, 46.8],
    initialZoom: 7.4,
    dedupeDecimals: 4,
    dedupeRadius: 0.0004,
    searchDebounce: 450,
    searchFlyZoom: 15,
    pulseDuration: 1200,
    toolbarTopOffset: 96,
    toolbarFooterMargin: 28,
    cardSelector: '.lfb__card-1, .lfb__card',
    gridSelector: '.lfb__grid',
    dynItemClass: 'w-dyn-item',
    countryCode: 'ch',
  };

  const AMENITIES = [
    'Wi-Fi', 'Laundry room', 'Dishwasher', 'Balcony',
    'Garden', 'Parking', 'Smoking allowed', 'Pets allowed',
  ];

  // Full list mirrors frontend `what_languages_speak_view.dart::_allLanguages`
  const LANGUAGES = [
    'English','German','French','Afar','Afrikaans','Albanian','American Sign Language',
    'Amharic','Arabic','Aramaic','Armenian','Assamese','Australian Sign Language',
    'Azerbaijani','Bahasa Indonesia','Bahasa Malaysia','Bengali','Bislama','Bosnian',
    'Bulgarian','Burmese','Cantonese','Catalan','Chinese','Croatian','Czech','Danish',
    'Dari','Dutch','Dzongkha','Estonian','Fijian','Filipino','Finnish','Georgian',
    'Greek','Gujarati','Haitian Creole','Hausa','Hebrew','Hindi','Hiri Motu','Hungarian',
    'Icelandic','Igbo','Irish','Italian','Japanese','Kannada','Kazakh','Khmer','Korean',
    'Kurdish','Lao','Latin','Latvian','Lithuanian','Luxembourgish','Macedonian','Malagasy',
    'Malayalam','Maltese','Maori','Marathi','Mongolian','Nepali','New Zealand Sign Language',
    'Norwegian','Oromo','Pashto','Persian','Polish','Portuguese','Punjabi','Romanian',
    'Russian','Samoan','Serbian','Shona','Sindhi','Sinhala','Slovak','Slovenian','Somali',
    'Southern Sotho','Spanish','Swahili','Swedish','Tagalog','Tajik','Tamil','Telugu',
    'Thai','Tigrinya','Tok Pisin','Tongan','Tswana','Turkish','Turkmen','Ukrainian',
    'Urdu','Uzbek','Vietnamese','Welsh','Xhosa','Yiddish','Yoruba','Zulu',
  ];

  // === 2. UTILITIES ===
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const getText = (card, bind) => {
    const el = card.querySelector('[data-bind="' + bind + '"]');
    return el ? el.textContent.trim() : '';
  };

  const parseNum = (str) => {
    if (!str) return NaN;
    // Strip every thousands-separator variant the CMS might emit before matching:
    // ASCII apostrophe, U+2019 right single-quote (Swiss CHF), commas, thin spaces.
    // Without this, "CHF 2'345" parses as `2` because U+2019 breaks the digit run.
    const cleaned = String(str).replace(/[’',\s]/g, '');
    const m = cleaned.match(/(-?\d+)/);
    return m ? parseInt(m[0], 10) : NaN;
  };

  const parseDate = (str) => {
    const m = (str || '').match(/(\d+)\s+(\w+)\s+(\d+)/);
    if (!m) return NaN;
    const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    return new Date(+m[3], months[m[2].slice(0, 3)], +m[1]).getTime();
  };

  const parseCoords = (str) => {
    if (!str) return null;
    const parts = str.split(',').map(x => parseFloat(x.trim()));
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
    const a = parts[0], b = parts[1];
    if (a >= 45 && a <= 48 && b >= 5 && b <= 11) return [a, b];
    if (b >= 45 && b <= 48 && a >= 5 && a <= 11) return [b, a];
    return [a, b];
  };

  const loadCss = (href, id) => {
    if (document.getElementById(id)) return Promise.resolve();
    return new Promise((res) => {
      const l = document.createElement('link');
      l.id = id; l.rel = 'stylesheet'; l.href = href;
      l.onload = res; l.onerror = res;
      document.head.appendChild(l);
    });
  };

  const loadJs = (src, id) => {
    if (document.getElementById(id)) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.id = id; s.src = src;
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  };

  // === 3. LENIS ISOLATION ===
  const isolateMap = () => {
    const tagMapNodes = () => {
      const targets = [
        '#' + CFG.mapMountId,
        '.maplibregl-canvas',
        '.maplibregl-canvas-container',
        '.maplibregl-marker',
        '.maplibregl-control-container',
      ];
      targets.forEach(sel => $$(sel).forEach(el => el.setAttribute('data-lenis-prevent', 'true')));
    };
    tagMapNodes();
    [500, 1500, 3000].forEach(t => setTimeout(tagMapNodes, t));

    const wireLenis = () => {
      const m = document.getElementById(CFG.mapMountId);
      if (!m || !window.lenis) return setTimeout(wireLenis, 150);
      const L = window.lenis;
      document.addEventListener('mousemove', (e) => {
        const r = m.getBoundingClientRect();
        const over = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (over && !L._lfbStopped) { L.stop(); L._lfbStopped = true; }
        else if (!over && L._lfbStopped) { L.start(); L._lfbStopped = false; }
      }, { passive: true });
      document.addEventListener('mouseleave', () => {
        if (L._lfbStopped) { L.start(); L._lfbStopped = false; }
      });
    };
    wireLenis();
  };

  // === 4. MAPLIBRE LOADER ===
  const initMap = async () => {
    await loadCss('https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css', 'lfb-ml-css');
    await loadJs('https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js', 'lfb-ml-js');

    const mount = document.getElementById(CFG.mapMountId);
    if (!mount) return null;

    const map = new window.maplibregl.Map({
      container: CFG.mapMountId,
      style: CFG.tileStyle,
      center: CFG.initialCenter,
      zoom: CFG.initialZoom,
      attributionControl: false,
    });
    map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new window.maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    return map;
  };

  // === 5. CARDS DATA ===
  const readCards = () => {
    return $$(CFG.cardSelector).map(card => {
      const coords = parseCoords(getText(card, 'approx-coordinates'));
      if (!coords) return null;
      return {
        card,
        wrap: card.closest('.' + CFG.dynItemClass),
        lat: coords[0],
        lng: coords[1],
        rent: getText(card, 'rent-text'),
        rentNum: parseNum(getText(card, 'rent-text')),
        roomSize: parseNum(getText(card, 'room-size')),
        availFrom: parseDate(getText(card, 'available-from-text')),
        availUntil: parseDate(getText(card, 'available-until-text')),
        permanent: getText(card, 'permanent-text').toLowerCase().indexOf('permanent') !== -1,
        furnished: getText(card, 'furnished-text').toLowerCase().indexOf('yes') !== -1,
        maxOcc: parseNum(getText(card, 'max-occupancy')),
        ageMin: parseNum(getText(card, 'age-range-min')),
        ageMax: parseNum(getText(card, 'age-range-max')),
        amenities: getText(card, 'amenity-tags-text').split(',').map(s => s.trim()).filter(Boolean),
        languages: getText(card, 'languages').split(',').map(s => s.trim()).filter(Boolean),
        male: parseNum(getText(card, 'current-male')) || 0,
        female: parseNum(getText(card, 'current-female')) || 0,
        other: parseNum(getText(card, 'current-other')) || 0,
        studentRequired: getText(card, 'student-text').toLowerCase().indexOf('yes') !== -1,
        slug: getText(card, 'slug'),
      };
    }).filter(Boolean);
  };

  // Fix card → detail-page navigation. Webflow's data-bind-href="slug" isn't
  // being auto-resolved on the published page, so each card link renders with
  // href="detail_flats" (the template page slug, no item slug). Set the real
  // href per card from the hidden data-bind="slug" carrier.
  // Attach a shimmer class to every browse card image, but only reveal it
  // after a 200ms delay so the placeholder doesn't flash on cached/fast loads.
  const CARD_LOADING_REVEAL_DELAY = 200;
  const wireCardImageLoading = (data) => {
    data.forEach(d => {
      const img = d.card.querySelector('.lfb__card__img-1') || d.card.querySelector('img');
      if (!img) return;
      if (img.complete && img.naturalWidth > 0) return;
      let revealTimer = setTimeout(() => {
        if (!(img.complete && img.naturalWidth > 0)) {
          img.classList.add('lf-img-loading');
        }
        revealTimer = null;
      }, CARD_LOADING_REVEAL_DELAY);
      const done = () => {
        if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
        img.classList.remove('lf-img-loading');
      };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  };

  const wireCardLinks = (data) => {
    data.forEach(d => {
      if (!d.slug) return;
      const link = d.card.querySelector('.lfb__card__link');
      if (!link) return;
      link.setAttribute('href', '/flats/' + d.slug);
    });
  };

  // === Tag emoji map ===
  // Sourced from the canonical Flutter list in `lib/v2/core/models/emoji_model.dart`
  // so the web stays in sync with the app. Unknown values intentionally fall through
  // with no emoji (cleaner than seeing the same fallback on half the chips).
  // Mirrored in FlatableDetail.js — keep both copies aligned.
  const TAG_EMOJI = {
    // socialEnergy
    'social butterfly': '🦋', 'outgoing': '🎤', 'more introverted': '🤓',
    'quiet thinker': '🧠', 'easy-going': '😎',
    // cleanlinessOrder
    'a bit messy': '🌀', 'clean freak': '🧼', 'tidy': '✨', "doesn't mind chaos": '🌪️',
    // routine
    'out most days': '🚶', 'night owl': '🦉', 'flexible schedule': '🕐',
    'early bird': '🌅', 'work-from-home': '💻',
    // lifestyle
    'active': '💪', 'chill': '🌴', 'foodie': '🍴', 'party-friendly': '🥳',
    'eco-conscious': '🌱', 'pet lover': '🐾',
    // personalityTone
    'calm': '🌙', 'reliable': '🤝', 'spontaneous': '💫', 'creative': '🎨',
    'organized': '📋', 'adventurous': '🧗',
    // socialDynamic
    'everyone does their thing': '🍃', 'like a small family': '👨‍👩‍👧',
    'open for deep talks': '💬', 'chill but connected': '☕',
    // atmosphere
    'quiet & peaceful': '🤫', 'fun & lively': '🎉',
    'calm weekdays, social weekends': '🌗',
    // Webflow sometimes splits the atmosphere value at the comma into two chips.
    'calm weekdays': '🌅', 'social weekends': '🎉',
    // sharedActivities
    'shared dinners': '🍽️', 'movie nights': '🎬', 'yoga or workouts': '🧘',
    'occasional drinks': '🍷', 'weekend adventures': '🏞️',
    // boundariesHabits
    'non-smoker': '🚭', 'pet-friendly': '🐶', 'visitors welcome': '👋',
    'respectful of space': '🙏', 'clean shared areas': '🧹',
    // interests
    'food': '🍴', 'travel': '✈️', 'movies': '🎬', 'diy': '🔨', 'gardening': '🌷',
    'art': '🎨', 'photography': '📷', 'sports': '⚽', 'music': '🎵',
    'cooking': '🍳', 'reading': '📖', 'dancing': '💃', 'fitness': '🏋️',
    'coding': '👨‍💻', 'gaming': '🎮',
    // featuresAmenities
    'wi-fi': '📶', 'garden': '🌿', 'balcony': '☀️', 'parking': '🚗',
    'laundry room': '🧺', 'dishwasher': '🍽️', 'smoking allowed': '🚬',
    'pets allowed': '🐾'
  };
  const emojiFor = (text) => {
    const key = (text || '').trim().toLowerCase();
    if (!key) return null;
    return TAG_EMOJI[key] || null;
  };
  // Walk every browse card chip and prepend an emoji span. Idempotent.
  const decorateCardChips = () => {
    document.querySelectorAll('.lfb__card__tag').forEach((chip) => {
      if (chip.querySelector('.lf-chip__emoji')) return;
      const original = chip.textContent.trim();
      if (!original) return;
      const emoji = emojiFor(original);
      if (!emoji) return;
      const span = document.createElement('span');
      span.className = 'lf-chip__emoji';
      span.textContent = emoji;
      chip.insertBefore(span, chip.firstChild);
    });
  };
  // FlatableChipSplitter runs after our boot and may rewrite chip children,
  // wiping our emoji spans. Watch the tags container and re-decorate on any
  // child mutation so emojis stick regardless of ordering.
  const observeCardChips = () => {
    const obs = new MutationObserver(() => decorateCardChips());
    document.querySelectorAll('.lfb__card__tags-track, .lfb__card__tags-wrap').forEach((root) => {
      obs.observe(root, { childList: true, subtree: true, characterData: true });
    });
  };

  // Wire the existing heart icon on each browse card to toggle saved state.
  // The heart element comes from Webflow as `.lfb__card__heart-1.w-button` (an
  // anchor). We hijack its click, persist the slug in localStorage, and toggle
  // the `is-saved` class for the filled-vs-outline visual state.
  const wireSavedHearts = (data, applyFn) => {
    data.forEach(d => {
      if (!d.slug) return;
      const heart = d.card.querySelector('.lfb__card__heart-1');
      if (!heart) return;
      if (SAVED.has(d.slug)) heart.classList.add('is-saved');
      heart.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (SAVED.has(d.slug)) {
          SAVED.delete(d.slug);
          heart.classList.remove('is-saved');
        } else {
          SAVED.add(d.slug);
          heart.classList.add('is-saved');
        }
        writeSavedSet(SAVED);
        // If the Saved-only view is on, re-apply so the just-removed card
        // disappears (or the just-added one stays in view).
        if (applyFn) applyFn();
      });
    });
  };

  // Wire the Saved toolbar toggle. Active state mirrors `state.savedOnly`.
  // After the toggle flips, scroll the results column back to the top so the
  // user sees the first saved flat instead of landing at the last row.
  const scrollResultsToTop = () => {
    const grid = document.querySelector(CFG.gridSelector);
    if (!grid) return;
    const r = grid.getBoundingClientRect();
    // Account for the fixed toolbar above the results so the first row isn't tucked under it.
    const offset = (CFG.toolbarTopOffset || 96) + 16;
    const target = Math.max(0, window.scrollY + r.top - offset);
    // Only scroll UP toward the grid top — never down. If the user is already
    // above the grid (e.g. scrollY=0 on a fresh visit), leave the scroll alone.
    // Scrolling down would jolt the sticky map a few pixels.
    if (window.scrollY > target + 4) {
      window.scrollTo({ top: target, behavior: 'smooth' });
    }
  };
  const wireSavedToggle = (state, applyFn) => {
    const btn = document.getElementById('lfb-saved-btn');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      // Defensive: this element is a <div role="button"> — stop bubbling so
      // no ancestor link/click handler can swallow the event and trigger a
      // hash-jump (root cause hunt for the first-click footer jump).
      e.preventDefault();
      e.stopPropagation();
      state.savedOnly = !state.savedOnly;
      btn.classList.toggle('is-active', state.savedOnly);
      if (applyFn) applyFn();
      scrollResultsToTop();
      // The results grid height just changed; nudge MapLibre to re-measure so
      // the map canvas doesn't drift relative to the toolbar.
      const ml = window.LfbB && window.LfbB.map;
      if (ml && typeof ml.resize === 'function') {
        requestAnimationFrame(() => ml.resize());
      }
    });
  };

  // === 6. MARKERS ===
  const placeMarkers = (map, data) => {
    const ml = window.maplibregl;

    const groups = {};
    data.forEach(d => {
      const k = d.lat.toFixed(CFG.dedupeDecimals) + ',' + d.lng.toFixed(CFG.dedupeDecimals);
      (groups[k] = groups[k] || []).push(d);
    });
    Object.values(groups).forEach(group => {
      if (group.length < 2) return;
      const origLat = group[0].lat;
      const origLng = group[0].lng;
      group.forEach((d, i) => {
        const angle = (i / group.length) * Math.PI * 2 - Math.PI / 2;
        d.lat = origLat + CFG.dedupeRadius * Math.cos(angle);
        d.lng = origLng + CFG.dedupeRadius * Math.sin(angle);
      });
    });

    data.forEach(d => {
      const el = document.createElement('div');
      el.className = 'lfb-mk__pill';
      el.textContent = d.rent;
      d.marker = new ml.Marker({ element: el }).setLngLat([d.lng, d.lat]).addTo(map);

      d.card.addEventListener('mouseenter', () => el.classList.add('lfb-mk--hover'));
      d.card.addEventListener('mouseleave', () => el.classList.remove('lfb-mk--hover'));
      el.addEventListener('mouseenter', () => d.card.classList.add('lfb__card--marker-hover'));
      el.addEventListener('mouseleave', () => d.card.classList.remove('lfb__card--marker-hover'));
    });
  };

  // === 6b. SAVED FLATS (localStorage) ===
  // Set of slugs the user has hearted on browse cards. Persisted across
  // sessions and read by `matchesFilters` when the Saved toolbar toggle is on.
  const SAVED_KEY = 'flatable.savedFlats';
  const readSavedSet = () => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? new Set(arr) : new Set();
    } catch (e) {
      return new Set();
    }
  };
  const writeSavedSet = (set) => {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from(set))); } catch (e) { /* */ }
  };
  let SAVED = readSavedSet();

  // === 6c. FILTER STATE PERSISTENCE ===
  // Persist filter state so Skip→/browse-flats restores the same view the user
  // left mid-flow. Saved/restored on every change.
  const FILTER_KEY = 'flatable.browseFilters';
  const readPersistedFilters = () => {
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
      return null;
    }
  };
  // Any filter (excluding the Saved toggle, which has its own button signal)
  // currently deviating from defaults? Used to colour the Filters button.
  const isAnyFilterActive = (state) => (
    state.rentMin !== null || state.rentMax !== null ||
    state.sizeMin !== null || state.sizeMax !== null ||
    state.from !== null || state.until !== null ||
    state.type !== 'any' || state.furn !== 'any' ||
    state.occMin !== null || state.occMax !== null ||
    state.ageMin !== null || state.ageMax !== null ||
    state.gender !== 'any' || state.student !== 'any' ||
    (state.amen && state.amen.length > 0) ||
    (state.lang && state.lang.length > 0)
  );

  const writePersistedFilters = (state) => {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify({
        rentMin: state.rentMin, rentMax: state.rentMax,
        sizeMin: state.sizeMin, sizeMax: state.sizeMax,
        from: state.from, until: state.until,
        type: state.type, furn: state.furn,
        occMin: state.occMin, occMax: state.occMax,
        ageMin: state.ageMin, ageMax: state.ageMax,
        gender: state.gender, student: state.student,
        amen: state.amen.slice(), lang: state.lang.slice(),
        savedOnly: state.savedOnly
      }));
    } catch (e) { /* localStorage unavailable */ }
  };

  // === 7. CARDS HIDE/REFLOW ===
  const matchesFilters = (d, state) => {
    if (state.savedOnly && !(d.slug && SAVED.has(d.slug))) return false;
    if (state.rentMin !== null && !isNaN(d.rentNum) && d.rentNum < state.rentMin) return false;
    if (state.rentMax !== null && !isNaN(d.rentNum) && d.rentNum > state.rentMax) return false;
    if (state.sizeMin !== null && !isNaN(d.roomSize) && d.roomSize < state.sizeMin) return false;
    if (state.sizeMax !== null && !isNaN(d.roomSize) && d.roomSize > state.sizeMax) return false;
    if (state.from !== null && !isNaN(d.availFrom) && d.availFrom > state.from) return false;
    if (state.until !== null && !isNaN(d.availUntil) && d.availUntil < state.until) return false;
    if (state.type === 'perm' && !d.permanent) return false;
    if (state.type === 'temp' && d.permanent) return false;
    if (state.furn === 'yes' && !d.furnished) return false;
    if (state.furn === 'no' && d.furnished) return false;
    if (state.occMin !== null && !isNaN(d.maxOcc) && d.maxOcc < state.occMin) return false;
    if (state.occMax !== null && !isNaN(d.maxOcc) && d.maxOcc > state.occMax) return false;
    if (state.ageMin !== null && !isNaN(d.ageMin) && d.ageMin < state.ageMin) return false;
    if (state.ageMax !== null && !isNaN(d.ageMax) && d.ageMax > state.ageMax) return false;
    if (state.student === 'yes' && !d.studentRequired) return false;
    if (state.student === 'no' && d.studentRequired) return false;
    if (state.gender === 'female' && d.female <= 0) return false;
    if (state.gender === 'male' && d.male <= 0) return false;
    if (state.gender === 'other' && d.other <= 0) return false;
    if (state.amen.length) {
      for (let i = 0; i < state.amen.length; i++) {
        if (d.amenities.indexOf(state.amen[i]) === -1) return false;
      }
    }
    if (state.lang.length) {
      let any = false;
      for (let j = 0; j < state.lang.length; j++) {
        if (d.languages.indexOf(state.lang[j]) !== -1) { any = true; break; }
      }
      if (!any) return false;
    }
    return true;
  };

  const applyAll = (map, data, state) => {
    if (!map) return;
    // Preserve scroll position across this layout pass. When filters/viewport
    // change drastically (most cards hidden) the document height shrinks and the
    // browser may auto-clamp scrollY, which feels like an unexpected jump.
    // We clamp ourselves to a sensible target so the user stays roughly where they were.
    const scrollBefore = window.scrollY;
    const bounds = map.getBounds();
    const visibleSlugs = [];
    data.forEach(d => {
      const inViewport = bounds.contains([d.lng, d.lat]);
      const passesFilters = matchesFilters(d, state);
      // Card-side: only render cards whose marker is inside the current viewport
      // AND that match the user's filters.
      const cardVisible = inViewport && passesFilters;
      const cardTarget = d.wrap || d.card;
      cardTarget.style.display = cardVisible ? '' : 'none';
      if (cardVisible && d.slug) visibleSlugs.push(d.slug);
      // Map-side: hide marker entirely when filters don't pass.
      // Viewport bounds don't matter for the marker — Leaflet/MapLibre clips
      // off-screen markers automatically, so we only act on filter result.
      if (d.marker) {
        d.marker.getElement().style.display = passesFilters ? '' : 'none';
      }
    });
    // Reorder so saved flats walk first when the user uses Skip on a detail page.
    // Within each bucket (saved / unsaved) we preserve the original applyAll order
    // so the user still sees the same on-page sequence.
    const orderedSlugs = visibleSlugs.slice().sort((a, b) => {
      const aSaved = SAVED.has(a) ? 0 : 1;
      const bSaved = SAVED.has(b) ? 0 : 1;
      if (aSaved !== bSaved) return aSaved - bSaved;
      return visibleSlugs.indexOf(a) - visibleSlugs.indexOf(b);
    });
    // Persist the ordered slug list so the detail page's Skip button can advance
    // through the same browse result set the user just saw (saved flats first).
    try {
      localStorage.setItem('flatable.browseList', JSON.stringify({
        slugs: orderedSlugs,
        ts: Date.now()
      }));
    } catch (e) { /* localStorage unavailable; skip persistence */ }

    // Snapshot the active filter state on every layout change. Skip-back from a
    // detail page rebuilds /browse-flats; we want that boot to restore here.
    writePersistedFilters(state);

    // Surface a visual indicator on the Filters button so the user knows a
    // filter is currently constraining the result set. Saved-only has its own
    // button indicator so it's excluded here.
    const fb = document.getElementById('lfb-filters-btn');
    if (fb) fb.classList.toggle('is-active', isAnyFilterActive(state));

    // Re-anchor scroll after the layout settles. If the document height now
    // can't reach the previous scrollY, the browser would clamp us to the new
    // bottom — pin to a safe upper bound so we don't appear to teleport to the footer.
    requestAnimationFrame(() => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const target = Math.min(scrollBefore, maxScroll);
      if (Math.abs(window.scrollY - target) > 2) {
        window.scrollTo(0, target);
      }
    });
  };

  // === 8. CLICK SCROLL + PULSE ===
  const wireClickScroll = (data) => {
    data.forEach(d => {
      if (!d.marker) return;
      d.marker.getElement().addEventListener('click', (e) => {
        e.stopPropagation();
        const t = d.card;
        if (!t || t.offsetParent === null) return;
        const r = t.getBoundingClientRect();
        const vh = window.innerHeight;
        const stickyOff = 180;
        const btmMargin = 16;
        let needScroll = true;
        let scY = 0;
        if (r.top >= stickyOff && r.bottom <= vh - btmMargin) needScroll = false;
        else if (r.top < stickyOff) scY = window.scrollY + (r.top - stickyOff - 16);
        else scY = window.scrollY + (r.bottom - vh + btmMargin);

        const pulse = () => {
          t.classList.remove('lfb__card--pulse');
          void t.offsetWidth;
          t.classList.add('lfb__card--pulse');
          setTimeout(() => t.classList.remove('lfb__card--pulse'), CFG.pulseDuration + 100);
        };

        if (!needScroll) { pulse(); return; }
        let done = false;
        const onEnd = () => {
          if (done) return;
          done = true;
          window.removeEventListener('scrollend', onEnd);
          clearTimeout(fallback);
          setTimeout(pulse, 80);
        };
        window.addEventListener('scrollend', onEnd, { once: true });
        const fallback = setTimeout(onEnd, 800);
        window.scrollTo({ top: scY, behavior: 'smooth' });
      });
    });
  };

  // === 9. TOOLBAR UI ===
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const makeSvgPath = (d) => {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    return p;
  };
  const makeSvgCircle = (cx, cy, r) => {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
    return c;
  };
  const makeSvg = (cls, w, h, kids) => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    if (cls) svg.setAttribute('class', cls);
    if (w) svg.setAttribute('width', w);
    if (h) svg.setAttribute('height', h);
    kids.forEach(k => svg.appendChild(k));
    return svg;
  };

  const injectToolbarUI = () => {
    const sw = document.getElementById('lfb-search-wrap');
    if (sw && !sw.querySelector('input')) {
      while (sw.firstChild) sw.removeChild(sw.firstChild);
      sw.appendChild(makeSvg('lfb__search-icon', null, null, [
        makeSvgCircle(11, 11, 7),
        makeSvgPath('m21 21-4.3-4.3'),
      ]));
      const inp = document.createElement('input');
      inp.className = 'lfb__search-input';
      inp.type = 'text';
      inp.id = 'lfb-search';
      inp.placeholder = 'Search location, city, neighborhood…';
      inp.autocomplete = 'off';
      sw.appendChild(inp);
    }
    const fb = document.getElementById('lfb-filters-btn');
    if (fb && !fb.querySelector('svg')) {
      while (fb.firstChild) fb.removeChild(fb.firstChild);
      fb.appendChild(makeSvg(null, 16, 16, [makeSvgPath('M22 3H2l8 9.46V19l4 2v-8.54L22 3z')]));
      const s = document.createElement('span');
      s.textContent = 'Filters';
      fb.appendChild(s);
    }
    const sb = document.getElementById('lfb-sort-btn');
    if (sb && !sb.querySelector('svg')) {
      while (sb.firstChild) sb.removeChild(sb.firstChild);
      sb.appendChild(makeSvg(null, 16, 16, [
        makeSvgPath('M3 6h18'),
        makeSvgPath('M7 12h10'),
        makeSvgPath('M10 18h4'),
      ]));
      const s = document.createElement('span');
      s.textContent = 'Sort';
      sb.appendChild(s);
    }
    // Inject a "Saved" toolbar button next to Sort. Re-uses the same
    // .lfb__toolbar-btn class so it visually matches Filters/Sort.
    const toolbar = document.querySelector('.lfb__toolbar');
    if (toolbar && !document.getElementById('lfb-saved-btn') && sb) {
      const btn = document.createElement('div');
      btn.id = 'lfb-saved-btn';
      btn.className = 'lfb__toolbar-btn';
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.appendChild(makeSvg(null, 16, 16, [
        makeSvgPath('M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z'),
      ]));
      const s = document.createElement('span');
      s.textContent = 'Saved';
      btn.appendChild(s);
      toolbar.insertBefore(btn, sb);
    }
  };

  // === 10. SORT MENU ===
  const SORT_OPTS = [
    ['movein', 'Move-in soonest'],
    ['rent-asc', 'Rent: low to high'],
    ['rent-desc', 'Rent: high to low'],
    ['room-asc', 'Flatmates: low to high'],
    ['newest', 'Newest'],
  ];

  const applySort = (mode) => {
    const grid = $(CFG.gridSelector);
    if (!grid) return;
    const items = $$(':scope > .' + CFG.dynItemClass, grid);
    items.sort((a, b) => {
      const ca = a.querySelector(CFG.cardSelector);
      const cb = b.querySelector(CFG.cardSelector);
      if (!ca || !cb) return 0;
      switch (mode) {
        case 'rent-asc':
          return (parseNum(getText(ca, 'rent-text')) || Infinity) -
                 (parseNum(getText(cb, 'rent-text')) || Infinity);
        case 'rent-desc':
          return (parseNum(getText(cb, 'rent-text')) || -Infinity) -
                 (parseNum(getText(ca, 'rent-text')) || -Infinity);
        case 'movein':
          return (parseDate(getText(ca, 'available-from-text')) || Infinity) -
                 (parseDate(getText(cb, 'available-from-text')) || Infinity);
        case 'room-asc':
          return (parseNum(getText(ca, 'max-occupancy')) || Infinity) -
                 (parseNum(getText(cb, 'max-occupancy')) || Infinity);
        default:
          return 0;
      }
    });
    items.forEach(it => grid.appendChild(it));
  };

  const buildSortMenu = () => {
    const btn = document.getElementById('lfb-sort-btn');
    if (!btn) return;
    const menu = document.createElement('div');
    menu.className = 'lfb__sp';
    SORT_OPTS.forEach(([val, label]) => {
      const b = document.createElement('button');
      b.dataset.sort = val;
      b.textContent = label;
      menu.appendChild(b);
    });
    btn.style.position = 'relative';
    btn.appendChild(menu);

    btn.addEventListener('click', (e) => {
      if (e.target.closest('[data-sort]')) return;
      e.stopPropagation();
      menu.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.remove('open');
    });
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sort]');
      if (!b) return;
      e.stopPropagation();
      applySort(b.dataset.sort);
      menu.classList.remove('open');
      $$('button', menu).forEach(c => c.classList.toggle('sel', c === b));
      const sp = btn.querySelector('span');
      if (sp) sp.textContent = b.textContent;
    });
    const def = menu.querySelector('[data-sort="movein"]');
    if (def) def.classList.add('sel');
  };

  // === 11. FILTER PANEL ===
  const makeChips = (key, opts, multi) => {
    const wrap = document.createElement('div');
    wrap.className = 'lfb__fp__cs';
    wrap.dataset.f = key;
    if (multi) wrap.dataset.m = '1';
    opts.forEach(([val, label]) => {
      const b = document.createElement('button');
      b.className = 'lfb__fp__ch' + ((!multi && val === 'any') ? ' act' : '');
      b.dataset.v = val;
      b.textContent = label;
      wrap.appendChild(b);
    });
    return wrap;
  };

  const makeGroup = (labelText, children) => {
    const g = document.createElement('div');
    g.className = 'lfb__fp__g';
    const lbl = document.createElement('label');
    lbl.textContent = labelText;
    g.appendChild(lbl);
    children.forEach(c => g.appendChild(c));
    return g;
  };

  // opts: {min, max, step, placeholderMin, placeholderMax}
  const makeRange = (idMin, idMax, opts) => {
    const o = opts || {};
    const rng = document.createElement('div');
    rng.className = 'lfb__fp__rng';
    const mkInput = (id, ph) => {
      const i = document.createElement('input');
      i.type = 'number'; i.id = id; i.placeholder = ph;
      if (o.min != null) i.min = o.min;
      if (o.max != null) i.max = o.max;
      if (o.step != null) i.step = o.step;
      return i;
    };
    rng.appendChild(mkInput(idMin, o.placeholderMin || 'Min'));
    rng.appendChild(mkInput(idMax, o.placeholderMax || 'Max'));
    return rng;
  };

  const makeDateInput = (id) => {
    const i = document.createElement('input');
    i.type = 'date'; i.id = id;
    return i;
  };

  // Type-ahead combobox for multi-select string values.
  // Selected values render as removable chips above the input.
  // Matching suggestions drop down below the input as the user types.
  const makeCombo = (key, options) => {
    const wrap = document.createElement('div');
    wrap.className = 'lfb__cb';
    wrap.dataset.cbKey = key;

    const chips = document.createElement('div');
    chips.className = 'lfb__cb__chips';
    wrap.appendChild(chips);

    const inputWrap = document.createElement('div');
    inputWrap.className = 'lfb__cb__iw';
    wrap.appendChild(inputWrap);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'lfb__cb__input';
    input.placeholder = 'Type to search…';
    input.autocomplete = 'off';
    inputWrap.appendChild(input);

    const list = document.createElement('div');
    list.className = 'lfb__cb__list';
    inputWrap.appendChild(list);

    wrap._lfbOptions = options;
    return wrap;
  };

  const buildFilterPanel = () => {
    const panel = document.createElement('div');
    panel.id = 'lfb-fp';
    panel.className = 'lfb__fp';
    // Prevent Lenis smooth-scroll from hijacking wheel events inside the panel
    // so its body scrolls independently from the page.
    panel.setAttribute('data-lenis-prevent', 'true');

    const bg = document.createElement('div');
    bg.className = 'lfb__fp__bg';
    bg.dataset.cl = '1';
    panel.appendChild(bg);

    const c = document.createElement('div');
    c.className = 'lfb__fp__c';
    c.setAttribute('data-lenis-prevent', 'true');
    panel.appendChild(c);

    const h = document.createElement('div');
    h.className = 'lfb__fp__h';
    const strong = document.createElement('strong');
    strong.textContent = 'Filters';
    h.appendChild(strong);
    const x = document.createElement('button');
    x.className = 'lfb__fp__x';
    x.dataset.cl = '1';
    x.textContent = '×';
    h.appendChild(x);
    c.appendChild(h);

    const body = document.createElement('div');
    body.className = 'lfb__fp__b';
    body.setAttribute('data-lenis-prevent', 'true');

    body.appendChild(makeGroup('Rent (CHF)',
      [makeRange('lfb-f-rmin', 'lfb-f-rmax', { min: 0, step: 100 })]));

    body.appendChild(makeGroup('Room size (m²)',
      [makeRange('lfb-f-szmin', 'lfb-f-szmax', { min: 0, step: 5 })]));

    // Move-in date FIRST
    body.appendChild(makeGroup('Move-in by', [makeDateInput('lfb-f-from')]));

    // Tenancy chips
    body.appendChild(makeGroup('Tenancy',
      [makeChips('type', [['any','Any'],['perm','Permanent'],['temp','Temporary']])]));

    // Move-out date: hidden by default; revealed only when type='temp'
    const moveOutGroup = makeGroup('Move-out no earlier than', [makeDateInput('lfb-f-until')]);
    moveOutGroup.id = 'lfb-f-untilGroup';
    moveOutGroup.style.display = 'none';
    body.appendChild(moveOutGroup);

    body.appendChild(makeGroup('Furnished',
      [makeChips('furn', [['any','Any'],['yes','Yes'],['no','No']])]));

    body.appendChild(makeGroup('Flatmates',
      [makeRange('lfb-f-omin', 'lfb-f-omax', { min: 0, max: 20, step: 1, placeholderMin: 'Min', placeholderMax: 'Max' })]));

    body.appendChild(makeGroup('Flatmates age range',
      [makeRange('lfb-f-amin', 'lfb-f-amax', { min: 0, max: 100, step: 1, placeholderMin: 'Min', placeholderMax: 'Max' })]));

    body.appendChild(makeGroup('Gender preference (same gender flat)',
      [makeChips('gender', [['any','Any'],['female','Female'],['male','Male'],['other','Other']])]));

    body.appendChild(makeGroup('Student-only flats',
      [makeChips('student', [['any','Any'],['yes','Only'],['no','Exclude']])]));

    body.appendChild(makeGroup('Amenities (all must match)',
      [makeChips('amen', AMENITIES.map(a => [a, a]), true)]));

    body.appendChild(makeGroup('Languages spoken (any match)',
      [makeCombo('lang', LANGUAGES)]));

    c.appendChild(body);

    const f = document.createElement('div');
    f.className = 'lfb__fp__f';
    const rs = document.createElement('button');
    rs.className = 'rs';
    rs.textContent = 'Reset';
    f.appendChild(rs);
    const ap = document.createElement('button');
    ap.className = 'ap';
    ap.dataset.cl = '1';
    ap.textContent = 'Done';
    f.appendChild(ap);
    c.appendChild(f);

    document.body.appendChild(panel);
    return panel;
  };

  const wireFilterPanel = (panel, state, onChange) => {
    const fb = document.getElementById('lfb-filters-btn');
    if (fb) fb.addEventListener('click', () => panel.classList.add('open'));
    panel.addEventListener('click', (e) => {
      if (e.target.getAttribute && e.target.getAttribute('data-cl')) {
        panel.classList.remove('open');
      }
    });

    const numericBind = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        state[key] = el.value ? +el.value : null;
        onChange();
      });
    };
    numericBind('lfb-f-rmin', 'rentMin');
    numericBind('lfb-f-rmax', 'rentMax');
    numericBind('lfb-f-szmin', 'sizeMin');
    numericBind('lfb-f-szmax', 'sizeMax');
    numericBind('lfb-f-omin', 'occMin');
    numericBind('lfb-f-omax', 'occMax');
    numericBind('lfb-f-amin', 'ageMin');
    numericBind('lfb-f-amax', 'ageMax');

    const dateBind = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        state[key] = el.value ? new Date(el.value).getTime() : null;
        onChange();
      });
    };
    dateBind('lfb-f-from', 'from');
    dateBind('lfb-f-until', 'until');

    // ───── Combobox (multi-select with type-ahead) ─────
    const renderComboChips = (comboWrap) => {
      // Exposed via panel._renderComboChips so restorePersistedFilters can repaint
      // multi-select chip groups from the persisted state on boot/bfcache.
      const key = comboWrap.dataset.cbKey;
      const chips = comboWrap.querySelector('.lfb__cb__chips');
      while (chips.firstChild) chips.removeChild(chips.firstChild);
      state[key].forEach(val => {
        const chip = document.createElement('span');
        chip.className = 'lfb__cb__chip';
        const lbl = document.createElement('span');
        lbl.textContent = val;
        chip.appendChild(lbl);
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'lfb__cb__x';
        x.textContent = '×';
        x.addEventListener('click', () => {
          const idx = state[key].indexOf(val);
          if (idx !== -1) state[key].splice(idx, 1);
          renderComboChips(comboWrap);
          onChange();
        });
        chip.appendChild(x);
        chips.appendChild(chip);
      });
    };

    const wireCombo = (comboWrap) => {
      const key = comboWrap.dataset.cbKey;
      const input = comboWrap.querySelector('.lfb__cb__input');
      const list = comboWrap.querySelector('.lfb__cb__list');
      const options = comboWrap._lfbOptions || [];

      const renderList = (query) => {
        const q = (query || '').toLowerCase().trim();
        const matches = options
          .filter(o => state[key].indexOf(o) === -1)
          .filter(o => q ? o.toLowerCase().indexOf(q) !== -1 : true)
          .slice(0, 50);
        while (list.firstChild) list.removeChild(list.firstChild);
        if (!matches.length) { list.classList.remove('open'); return; }
        matches.forEach(opt => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'lfb__cb__item';
          item.textContent = opt;
          item.addEventListener('mousedown', (e) => {
            e.preventDefault(); // keep focus on input
            state[key].push(opt);
            input.value = '';
            renderComboChips(comboWrap);
            renderList('');
            list.classList.remove('open');
            onChange();
          });
          list.appendChild(item);
        });
        list.classList.add('open');
      };

      input.addEventListener('focus', () => renderList(input.value));
      input.addEventListener('input', () => renderList(input.value));
      input.addEventListener('blur', () => {
        // Close on blur with small delay so item clicks register
        setTimeout(() => list.classList.remove('open'), 120);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const first = list.querySelector('.lfb__cb__item');
          if (first) first.dispatchEvent(new MouseEvent('mousedown'));
        } else if (e.key === 'Backspace' && input.value === '' && state[key].length) {
          state[key].pop();
          renderComboChips(comboWrap);
          renderList('');
          onChange();
        }
      });
    };

    panel.querySelectorAll('.lfb__cb').forEach(wireCombo);

    // Toggle move-out date group based on tenancy type
    const updateMoveOutVisibility = () => {
      const group = document.getElementById('lfb-f-untilGroup');
      if (!group) return;
      group.style.display = (state.type === 'temp') ? '' : 'none';
      if (state.type !== 'temp') {
        // Clear move-out value when leaving temp
        const inp = document.getElementById('lfb-f-until');
        if (inp && inp.value) {
          inp.value = '';
          state.until = null;
        }
      }
    };

    panel.querySelectorAll('[data-f]').forEach(group => {
      group.addEventListener('click', (e) => {
        const btn = e.target.closest('.lfb__fp__ch');
        if (!btn) return;
        const key = group.dataset.f;
        const val = btn.dataset.v;
        const multi = group.dataset.m;
        if (multi) {
          const arr = state[key];
          const idx = arr.indexOf(val);
          if (idx === -1) arr.push(val); else arr.splice(idx, 1);
          btn.classList.toggle('act');
        } else {
          state[key] = val;
          $$('.lfb__fp__ch', group).forEach(c => c.classList.toggle('act', c === btn));
          if (key === 'type') updateMoveOutVisibility();
        }
        onChange();
      });
    });

    panel.querySelector('.rs').addEventListener('click', () => {
      Object.assign(state, {
        rentMin: null, rentMax: null,
        sizeMin: null, sizeMax: null,
        from: null, until: null,
        type: 'any', furn: 'any',
        occMin: null, occMax: null,
        ageMin: null, ageMax: null,
        gender: 'any', student: 'any',
        amen: [], lang: [],
      });
      $$('input', panel).forEach(i => i.value = '');
      panel.querySelectorAll('[data-f]').forEach(group => {
        const multi = group.dataset.m;
        $$('.lfb__fp__ch', group).forEach(c => c.classList.toggle('act', !multi && c.dataset.v === 'any'));
      });
      panel.querySelectorAll('.lfb__cb').forEach(renderComboChips);
      updateMoveOutVisibility();
      // Reset clears all persisted filters too.
      try { localStorage.removeItem(FILTER_KEY); } catch (e) { /* */ }
      onChange();
    });

    // Expose the chip renderer so restorePersistedFilters can repaint multi-select groups.
    panel._renderComboChips = renderComboChips;
    panel._updateMoveOutVisibility = updateMoveOutVisibility;
  };

  // Push a persisted filter snapshot back into the live `state` object, the
  // form inputs in the filter panel, and the chip-selection UI. Called once
  // on boot (and again on bfcache restore) so the user sees what they left.
  const restorePersistedFilters = (panel, state) => {
    const saved = readPersistedFilters();
    if (!saved) return false;
    // 1. State object.
    [
      'rentMin','rentMax','sizeMin','sizeMax','from','until',
      'type','furn','occMin','occMax','ageMin','ageMax',
      'gender','student','savedOnly'
    ].forEach(k => { if (saved[k] !== undefined) state[k] = saved[k]; });
    if (Array.isArray(saved.amen)) state.amen = saved.amen.slice();
    if (Array.isArray(saved.lang)) state.lang = saved.lang.slice();

    // 2. Numeric inputs.
    const setIf = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = val == null ? '' : String(val);
    };
    setIf('lfb-f-rmin', state.rentMin);
    setIf('lfb-f-rmax', state.rentMax);
    setIf('lfb-f-szmin', state.sizeMin);
    setIf('lfb-f-szmax', state.sizeMax);
    setIf('lfb-f-omin', state.occMin);
    setIf('lfb-f-omax', state.occMax);
    setIf('lfb-f-amin', state.ageMin);
    setIf('lfb-f-amax', state.ageMax);

    // 3. Date inputs (state stores epoch ms; input wants yyyy-mm-dd).
    const toDateInputValue = (ms) => {
      if (!ms) return '';
      const d = new Date(ms);
      const pad = (n) => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    };
    setIf('lfb-f-from', toDateInputValue(state.from));
    setIf('lfb-f-until', toDateInputValue(state.until));

    // 4. Single-value chip groups (type, furn, gender, student).
    [['type', state.type], ['furn', state.furn], ['gender', state.gender], ['student', state.student]]
      .forEach(([k, v]) => {
        const group = panel.querySelector('[data-f="' + k + '"]');
        if (!group) return;
        $$('.lfb__fp__ch', group).forEach(c => c.classList.toggle('act', c.dataset.v === v));
      });

    // 5. Multi-value chip groups (amen, lang) use the combobox renderer.
    if (typeof panel._renderComboChips === 'function') {
      panel.querySelectorAll('.lfb__cb').forEach(panel._renderComboChips);
    }
    if (typeof panel._updateMoveOutVisibility === 'function') {
      panel._updateMoveOutVisibility();
    }

    // 6. Saved-only toolbar button visual state.
    const sb = document.getElementById('lfb-saved-btn');
    if (sb) sb.classList.toggle('is-active', !!state.savedOnly);

    return true;
  };

  // === 12. SEARCH GEOCODING ===
  const wireSearch = (map) => {
    const si = document.getElementById('lfb-search');
    if (!si) return;
    let debounce;
    si.addEventListener('input', () => {
      clearTimeout(debounce);
      const q = si.value.trim();
      if (q.length < 3) return;
      debounce = setTimeout(() => {
        const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=' +
          CFG.countryCode + '&q=' + encodeURIComponent(q);
        fetch(url).then(r => r.json()).then(j => {
          if (j && j[0]) {
            map.flyTo({
              center: [parseFloat(j[0].lon), parseFloat(j[0].lat)],
              zoom: CFG.searchFlyZoom,
              duration: 800,
            });
          }
        }).catch(() => {});
      }, CFG.searchDebounce);
    });
  };

  // === 13. FOOTER RELEASE ===
  const wireFooterRelease = () => {
    const t = $('.lfb__toolbar');
    const sh = $('.lfb__toolbar-shield');
    const f = $('footer') || $('.footer') || $('[class*="footer"]');
    if (!t || !f) return setTimeout(wireFooterRelease, 150);

    const update = () => {
      const fr = f.getBoundingClientRect();
      const bot = CFG.toolbarTopOffset + t.offsetHeight;
      if (fr.top < bot + CFG.toolbarFooterMargin) {
        const push = bot + CFG.toolbarFooterMargin - fr.top;
        t.style.transform = 'translateY(' + (-push) + 'px)';
        if (sh) sh.style.transform = 'translateY(' + (-push) + 'px)';
      } else {
        t.style.transform = '';
        if (sh) sh.style.transform = '';
      }
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  };

  // === 14. INJECTED CSS ===
  const injectCss = () => {
    if (document.getElementById('lfb-master-css')) return;
    const css = [
      '.lfb-mk__pill{background:#fff;color:#1a1714;font-size:12px;font-weight:600;',
      'padding:4px 10px;border-radius:999px;box-shadow:0 2px 8px rgba(20,16,12,.18);',
      'white-space:nowrap;border:1px solid rgba(20,16,12,.1);cursor:pointer;',
      'user-select:none;transition:background 150ms ease,color 150ms ease}',
      '.lfb-mk__pill.lfb-mk--hover,.lfb-mk__pill:hover{',
      'background:linear-gradient(135deg,#ff8b3d,#ff5e3a)!important;color:#fff!important;',
      'border-color:transparent!important;z-index:99999!important}',
      '.maplibregl-marker{will-change:transform}',
      '.lfb__card--marker-hover{box-shadow:0 14px 32px rgba(20,16,12,.18);transform:translateY(-2px)}',
      '@keyframes lfb-card-pulse{',
      '0%{box-shadow:0 0 0 0 rgba(255,139,61,.55),0 14px 36px rgba(20,16,12,.18);transform:translateY(-4px) scale(1.02)}',
      '60%{box-shadow:0 0 0 14px rgba(255,139,61,0),0 14px 36px rgba(20,16,12,.18);transform:translateY(-2px) scale(1.01)}',
      '100%{box-shadow:0 0 0 0 rgba(255,139,61,0),0 6px 14px rgba(20,16,12,.08);transform:none}}',
      '.lfb__card--pulse,.lfb__card-1.lfb__card--pulse{',
      'animation:lfb-card-pulse ' + CFG.pulseDuration + 'ms cubic-bezier(.32,.72,.36,1)}',
      '#' + CFG.mapMountId + ',.maplibregl-canvas-container,.maplibregl-canvas,.maplibregl-marker{',
      'touch-action:none;overscroll-behavior:contain}',
      '.lfb__sp{position:absolute;top:calc(100% + 8px);right:0;background:#fff;',
      'border:1px solid #ece8df;border-radius:12px;box-shadow:0 8px 24px rgba(20,16,12,.1);',
      'padding:6px;min-width:230px;z-index:1000;display:none}',
      '.lfb__sp.open{display:block}',
      '.lfb__sp button{display:block;width:100%;text-align:left;padding:10px 12px;',
      'background:none;border:0;border-radius:8px;cursor:pointer;font-size:14px;',
      'color:#1a1714;font-family:inherit}',
      '.lfb__sp button:hover{background:#fffaf2}',
      '.lfb__sp button.sel{font-weight:600;background:#fff5e8}',
      // Saved heart filled state on browse cards.
      '.lfb__card__heart-1{transition:background 160ms ease,color 160ms ease}',
      '.lfb__card__heart-1.is-saved{background:linear-gradient(135deg,#ff8b3d,#ff5e3a)!important;color:#fff!important;border-color:transparent!important}',
      '.lfb__card__heart-1.is-saved svg,.lfb__card__heart-1.is-saved .lfb__card__heart-icon{fill:#fff!important;stroke:#fff!important;color:#fff!important}',
      // Active state for Saved toolbar button mirrors marker-hover pill style.
      '#lfb-saved-btn.is-active{background:linear-gradient(135deg,#ff8b3d,#ff5e3a)!important;color:#fff!important;border-color:transparent!important}',
      '#lfb-saved-btn.is-active svg{stroke:#fff!important}',
      // Filters button mirrors the Saved button's active treatment so the user
      // can tell at a glance that a filter is constraining the results.
      '#lfb-filters-btn.is-active{background:linear-gradient(135deg,#ff8b3d,#ff5e3a)!important;color:#fff!important;border-color:transparent!important}',
      '#lfb-filters-btn.is-active svg{stroke:#fff!important}',
      // Browse card vibe/trait chips — orange gradient + white text + emoji prefix.
      '.lfb__card__tag{background:linear-gradient(135deg,#ff8b3d,#ff5e3a)!important;',
      'color:#fff!important;border-color:transparent!important;display:inline-flex;',
      'align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-weight:500}',
      '.lfb__card__tag .lf-chip__emoji{font-size:1em;line-height:1;flex:0 0 auto}',
      // Tenancy/permanent tag on browse card: orange outline, transparent fill.
      '.lfb__card__perm-tag{background:transparent!important;background-color:transparent!important;',
      'border:1px solid #ff5e3a!important;color:#ff5e3a!important;font-weight:600}',
      // Image loading shimmer — neutral grey so it doesn't read as an orange
      // box, only revealed after a 200ms delay (see JS) to skip cached loads.
      '@keyframes lf-img-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}',
      '.lf-img-loading{background:linear-gradient(90deg,#e8e8e8 0%,#f4f4f4 50%,#e8e8e8 100%)!important;',
      'background-size:200% 100%!important;animation:lf-img-shimmer 1.4s ease-in-out infinite}',
      '.lfb__fp{position:fixed;inset:0;z-index:1100;display:none}',
      '.lfb__fp.open{display:block}',
      '.lfb__fp__bg{position:absolute;inset:0;background:rgba(20,16,12,.4)}',
      '.lfb__fp__c{position:absolute;top:0;right:0;bottom:0;width:460px;max-width:92vw;',
      'background:#fff;display:flex;flex-direction:column;transform:translateX(100%);',
      'transition:transform 240ms cubic-bezier(.32,.72,.36,1);',
      'box-shadow:-16px 0 32px rgba(20,16,12,.12)}',
      '.lfb__fp.open .lfb__fp__c{transform:none}',
      '.lfb__fp__h{display:flex;align-items:center;justify-content:space-between;',
      'padding:20px 24px;border-bottom:1px solid #ece8df}',
      '.lfb__fp__h strong{font-size:18px}',
      '.lfb__fp__x{background:none;border:0;font-size:24px;cursor:pointer;color:#9c8a78;',
      'line-height:1;padding:0;width:32px;height:32px}',
      '.lfb__fp__b{flex:1;overflow-y:auto;padding:20px 24px;overscroll-behavior:contain}',
      '.lfb__fp__g{margin-bottom:22px}',
      '.lfb__fp__g>label{display:block;font-size:12px;font-weight:600;color:#9c8a78;',
      'text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}',
      '.lfb__fp__rng{display:flex;gap:8px}',
      '.lfb__fp__g input{padding:10px 14px;border:1px solid #ece8df;border-radius:10px;',
      'font-size:14px;font-family:inherit;background:#fff;width:100%;box-sizing:border-box}',
      '.lfb__fp__g input:focus{outline:0;border-color:#ff8b3d}',
      '.lfb__fp__ch{padding:6px 12px;border-radius:999px;border:1px solid #ece8df;',
      'background:#fff;font-size:13px;cursor:pointer;font-family:inherit;color:#1a1714;',
      'margin:2px 4px 2px 0}',
      '.lfb__fp__ch.act{background:linear-gradient(135deg,#ff8b3d,#ff5e3a);',
      'color:#fff;border-color:transparent}',
      '.lfb__fp__cs{display:flex;flex-wrap:wrap}',
      '.lfb__fp__f{padding:16px 24px;border-top:1px solid #ece8df;display:flex;',
      'gap:10px;justify-content:flex-end}',
      '.lfb__fp__f button{padding:10px 18px;border-radius:999px;font-size:14px;',
      'font-weight:500;cursor:pointer;font-family:inherit;border:1px solid #ece8df;',
      'background:#fff;color:#1a1714}',
      '.lfb__fp__f .ap{background:#1a1714;color:#fff;border-color:transparent}',
      /* Combobox */
      '.lfb__cb__chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}',
      '.lfb__cb__chips:empty{margin-bottom:0}',
      '.lfb__cb__chip{display:inline-flex;align-items:center;gap:6px;',
      'padding:5px 6px 5px 12px;border-radius:999px;',
      'background:linear-gradient(135deg,#ff8b3d,#ff5e3a);color:#fff;',
      'font-size:13px;font-family:inherit}',
      '.lfb__cb__x{background:rgba(255,255,255,.22);color:#fff;border:0;',
      'width:18px;height:18px;border-radius:50%;font-size:14px;line-height:1;',
      'cursor:pointer;display:flex;align-items:center;justify-content:center;',
      'padding:0;font-family:inherit}',
      '.lfb__cb__x:hover{background:rgba(255,255,255,.4)}',
      '.lfb__cb__iw{position:relative}',
      '.lfb__cb__input{width:100%;padding:10px 14px;border:1px solid #ece8df;',
      'border-radius:10px;font-size:14px;font-family:inherit;background:#fff;',
      'box-sizing:border-box}',
      '.lfb__cb__input:focus{outline:0;border-color:#ff8b3d}',
      '.lfb__cb__list{position:absolute;top:calc(100% + 4px);left:0;right:0;',
      'max-height:240px;overflow-y:auto;background:#fff;border:1px solid #ece8df;',
      'border-radius:10px;box-shadow:0 8px 24px rgba(20,16,12,.1);',
      'z-index:1200;display:none;overscroll-behavior:contain}',
      '.lfb__cb__list.open{display:block}',
      '.lfb__cb__item{display:block;width:100%;text-align:left;padding:8px 14px;',
      'background:none;border:0;cursor:pointer;font-size:14px;color:#1a1714;',
      'font-family:inherit}',
      '.lfb__cb__item:hover{background:#fffaf2}',
      // === MOBILE (≤767px) — scoped overrides ONLY. Desktop untouched. ===
      // Sticky stack (from top): header → toolbar (search + buttons) → map.
      // JS sets --lf-sticky-toolbar-top + --lf-sticky-map-top from real
      // measurements so the stack stays correct if the header height changes.
      '@media (max-width:767px){',
      // Header sticky lives in FlatableNavBrowse.js (site-wide so it stays
      // consistent everywhere). Here we only zero the 16px padding that
      // .nav_component adds above the header — that buffer was making the
      // toolbar scroll a few pixels before pinning instead of latching from start.
      '.nav_component{padding-top:0!important}',
      'section.lfb__main{display:block!important}',
      // Map: sticky below the toolbar, inset to match the card column width.
      // Override Webflow `.lfb__map { min-height: 480px }` so it can shrink.
      'aside.lfb__map{position:sticky!important;',
      'top:var(--lf-sticky-map-top,180px)!important;left:auto!important;right:auto!important;',
      'width:calc(100% - 24px)!important;height:28vh!important;min-height:0!important;',
      'max-height:280px!important;z-index:80!important;margin:0 12px!important}',
      '#' + CFG.mapMountId + ',.lfb__map-mount{height:100%!important;width:100%!important}',
      // Cards grid: single column, full width.
      '.lfb__grid,.w-dyn-list .w-dyn-items{grid-template-columns:1fr!important;',
      'display:grid!important;gap:16px!important;padding:12px!important;width:100%!important;',
      'box-sizing:border-box!important}',
      '.lfb__card-1,.w-dyn-item{width:100%!important;max-width:100%!important;',
      'min-width:0!important;box-sizing:border-box!important}',
      // Toolbar: full-width, two rows (search full row, buttons row), sticky below header.
      '.lfb__toolbar{position:sticky!important;',
      'top:var(--lf-sticky-toolbar-top,80px)!important;left:auto!important;',
      'right:auto!important;width:100%!important;display:flex!important;flex-wrap:wrap!important;',
      'gap:8px!important;padding:12px!important;box-sizing:border-box!important;',
      'background:#fff!important;border-bottom:1px solid #ece8df!important;transform:none!important;',
      'z-index:100!important}',
      '.lfb__toolbar #lfb-search-wrap{flex:1 0 100%!important;order:0!important;',
      'width:100%!important;max-width:100%!important}',
      '.lfb__toolbar #lfb-filters-btn,.lfb__toolbar #lfb-saved-btn,.lfb__toolbar #lfb-sort-btn{',
      'flex:1 1 0!important;order:1!important;justify-content:center!important;',
      'min-width:0!important;min-height:44px!important;padding:6px 10px!important;',
      'overflow:hidden!important;text-align:center!important}',
      // Long sort labels (e.g. "Rent: low to high") wrap inside the narrow
      // button instead of overflowing. Font shrinks a touch; button height stays.
      '.lfb__toolbar-btn span{white-space:normal!important;line-height:1.1!important;',
      'font-size:12px!important;text-align:center!important;display:inline-block!important}',
      // Sort dropdown — make sure long-press / wheel events on it still allow
      // the page to scroll. Without `touch-action: pan-y` the absolute menu
      // sometimes traps vertical scroll on mobile webkit.
      '.lfb__sp{touch-action:pan-y!important;overscroll-behavior:contain!important;',
      'max-height:50vh!important;overflow-y:auto!important;', 'right:8px!important;left:auto!important}',
      // Toolbar shield (the fixed-position shim used on desktop) — disable on mobile.
      '.lfb__toolbar-shield{display:none!important}',
      '}'
    ].join('');
    const s = document.createElement('style');
    s.id = 'lfb-master-css';
    s.textContent = css;
    document.head.appendChild(s);
  };

  // === 15. BOOTSTRAP ===
  const state = {
    rentMin: null, rentMax: null,
    sizeMin: null, sizeMax: null,
    from: null, until: null,
    type: 'any', furn: 'any',
    occMin: null, occMax: null,
    ageMin: null, ageMax: null,
    gender: 'any', student: 'any',
    amen: [], lang: [],
    savedOnly: false,
  };
  window.LfbFs = state;

  // === MOBILE DOM REORDER ===
  // On viewports ≤767px the user wants: search + buttons ABOVE the sticky map,
  // then cards beneath. The toolbar is otherwise nested inside the cards
  // column where it can't render before the map aside, so we physically lift
  // it to be a previous-sibling of the map. Desktop is untouched.
  const setupMobileLayout = () => {
    if (!window.matchMedia || !window.matchMedia('(max-width: 767px)').matches) return;
    const main = document.querySelector('section.lfb__main');
    const toolbar = document.querySelector('.lfb__toolbar');
    const mapAside = document.querySelector('aside.lfb__map');
    if (!main || !toolbar || !mapAside) return;
    if (toolbar.parentNode !== main || toolbar.nextElementSibling !== mapAside) {
      main.insertBefore(toolbar, mapAside);
    }
    updateMobileStickyOffsets();
    // Re-measure whenever orientation/resize changes the header or toolbar height.
    window.addEventListener('resize', updateMobileStickyOffsets, { passive: true });
    // And once after fonts/images settle so the first paint is accurate.
    window.setTimeout(updateMobileStickyOffsets, 400);
  };

  // Stack the sticky offsets so header → toolbar → map land exactly beneath
  // each other regardless of the actual header/toolbar height the breakpoint
  // produces. CSS vars are used by the @media rules above.
  const updateMobileStickyOffsets = () => {
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    const header = document.querySelector('.nav_mobile_wrap');
    const toolbar = document.querySelector('.lfb__toolbar');
    if (!toolbar) return;
    const headerH = header ? header.offsetHeight : 64;
    const toolbarH = toolbar.offsetHeight || 110;
    document.documentElement.style.setProperty('--lf-sticky-toolbar-top', headerH + 'px');
    document.documentElement.style.setProperty('--lf-sticky-map-top', (headerH + toolbarH) + 'px');
  };

  const boot = async () => {
    injectCss();
    isolateMap();
    injectToolbarUI();
    setupMobileLayout();
    const panel = buildFilterPanel();
    buildSortMenu();

    const map = await initMap();
    if (!map) return;

    map.on('load', () => {
      const data = readCards();
      window.LfbB = { map, data, ml: window.maplibregl };

      placeMarkers(map, data);
      wireCardLinks(data);
      wireCardImageLoading(data);
      wireClickScroll(data);
      // The chip splitter runs at body bottom and writes chips into cards.
      // Decorate after a microtask so we run after its initial pass, then
      // start observing for any later rewrites that would drop our emoji spans.
      requestAnimationFrame(() => {
        decorateCardChips();
        observeCardChips();
      });

      const onChange = () => applyAll(map, data, state);
      window.LfbApply = onChange;
      wireSavedHearts(data, onChange);
      wireSavedToggle(state, onChange);
      map.on('moveend', onChange);

      wireFilterPanel(panel, state, onChange);
      // Restore any persisted filter state BEFORE the first applyAll so the
      // user lands where they left off (e.g. after Skip → back to /browse-flats).
      restorePersistedFilters(panel, state);
      onChange();

      wireSearch(map);

      // Re-sync browse card hearts whenever the page is restored from bfcache
      // (browser back from a detail page). The user may have hearted a flat on
      // that page and the localStorage set is now ahead of what's painted here.
      window.addEventListener('pageshow', (e) => {
        if (!e.persisted) return;
        SAVED = readSavedSet();
        data.forEach(d => {
          if (!d.slug) return;
          const heart = d.card.querySelector('.lfb__card__heart-1');
          if (heart) heart.classList.toggle('is-saved', SAVED.has(d.slug));
        });
        onChange();
      });
    });

    wireFooterRelease();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
